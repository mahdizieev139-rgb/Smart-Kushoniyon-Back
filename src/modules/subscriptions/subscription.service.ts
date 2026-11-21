/**
 * Subscription service — B2B monthly SaaS billing.
 *
 * Design choices:
 *   - Plans (Basic / Extended) are CONFIGURABLE, stored in SystemSetting under
 *     the key "subscription_plans". We ship sensible defaults (1500 / 2500 TJS)
 *     that an admin can change without a code deploy.
 *   - We do NOT integrate any payment gateway (per the spec). Payments are
 *     tracked manually via SubscriptionInvoice rows (UNPAID/PAID/...).
 *   - The architecture is ready for a future gateway: a payment webhook would
 *     simply update the matching invoice's status.
 *
 * Monetary values use Decimal (passed as strings) — never Float.
 */
import { Prisma } from '@prisma/client';
import type { InvoiceStatus, SubscriptionStatus, BillingPeriod } from '@prisma/client';
import { prisma } from '../../config/database';
import { ApiError } from '../../utils/api-error';
import { getPagination, buildMeta } from '../../utils/pagination';
import { auditLogService } from '../audit-logs/audit-log.service';
import type { CreateSubscriptionInput, UpdateSubscriptionInput } from './subscription.validation';

const PLANS_SETTING_KEY = 'subscription_plans';

// Default plans — proposals that an admin can override via SystemSetting.
const DEFAULT_PLANS = [
  { name: 'Basic', amount: '1500.00', currency: 'TJS', billingPeriod: 'MONTHLY' },
  { name: 'Extended', amount: '2500.00', currency: 'TJS', billingPeriod: 'MONTHLY' },
];

async function getPlans() {
  const setting = await prisma.systemSetting.findUnique({ where: { key: PLANS_SETTING_KEY } });
  return setting?.value ?? DEFAULT_PLANS;
}

async function setPlans(plans: unknown, actorId: string) {
  const saved = await prisma.systemSetting.upsert({
    where: { key: PLANS_SETTING_KEY },
    create: { key: PLANS_SETTING_KEY, value: plans as Prisma.InputJsonValue },
    update: { value: plans as Prisma.InputJsonValue },
  });
  await auditLogService.record({
    userId: actorId,
    action: 'SUBSCRIPTION_PLANS_UPDATED',
    entityType: 'SystemSetting',
    entityId: saved.id,
  });
  return saved.value;
}

// Compute an expiry date from a start date + billing period.
function computeExpiry(startsAt: Date, period: BillingPeriod): Date {
  const expiry = new Date(startsAt);
  const monthsToAdd = period === 'YEARLY' ? 12 : period === 'QUARTERLY' ? 3 : 1;
  expiry.setMonth(expiry.getMonth() + monthsToAdd);
  return expiry;
}

interface ListParams {
  page?: number;
  limit?: number;
  shopId?: string;
  status?: SubscriptionStatus;
}

async function list(params: ListParams) {
  const { skip, take, page, limit } = getPagination(params);
  const where: Prisma.SubscriptionWhereInput = {
    ...(params.shopId ? { shopId: params.shopId } : {}),
    ...(params.status ? { status: params.status } : {}),
  };
  const [items, total] = await Promise.all([
    prisma.subscription.findMany({
      where,
      include: { invoices: { orderBy: { createdAt: 'desc' } } },
      orderBy: { createdAt: 'desc' },
      skip,
      take,
    }),
    prisma.subscription.count({ where }),
  ]);
  return { items, meta: buildMeta(total, page, limit) };
}

async function getById(id: string) {
  const subscription = await prisma.subscription.findUnique({
    where: { id },
    include: { invoices: { orderBy: { createdAt: 'desc' } } },
  });
  if (!subscription) throw ApiError.notFound('Subscription');
  return subscription;
}

async function create(input: CreateSubscriptionInput, actorId: string) {
  const shop = await prisma.shop.findUnique({ where: { id: input.shopId } });
  if (!shop) throw ApiError.badRequest('Shop does not exist');

  const startsAt = input.startsAt ?? new Date();
  const billingPeriod = input.billingPeriod ?? 'MONTHLY';
  const expiresAt = input.expiresAt ?? computeExpiry(startsAt, billingPeriod);

  // Create the subscription AND its first (unpaid) invoice together.
  const subscription = await prisma.$transaction(async (tx) => {
    const created = await tx.subscription.create({
      data: {
        shopId: input.shopId,
        planName: input.planName,
        amount: new Prisma.Decimal(input.amount.toFixed(2)),
        currency: input.currency ?? 'TJS',
        billingPeriod,
        status: 'ACTIVE',
        startsAt,
        expiresAt,
      },
    });
    await tx.subscriptionInvoice.create({
      data: {
        subscriptionId: created.id,
        amount: created.amount,
        currency: created.currency,
        status: 'UNPAID',
        periodStart: startsAt,
        periodEnd: expiresAt,
      },
    });
    return tx.subscription.findUniqueOrThrow({ where: { id: created.id }, include: { invoices: true } });
  });

  await auditLogService.record({
    userId: actorId,
    action: 'SUBSCRIPTION_CREATED',
    entityType: 'Subscription',
    entityId: subscription.id,
    metadata: { shopId: input.shopId, planName: input.planName },
  });
  return subscription;
}

async function update(id: string, input: UpdateSubscriptionInput, actorId: string) {
  const existing = await prisma.subscription.findUnique({ where: { id } });
  if (!existing) throw ApiError.notFound('Subscription');

  const subscription = await prisma.subscription.update({
    where: { id },
    data: {
      ...(input.planName ? { planName: input.planName } : {}),
      ...(input.amount !== undefined ? { amount: new Prisma.Decimal(input.amount.toFixed(2)) } : {}),
      ...(input.status ? { status: input.status } : {}),
      ...(input.expiresAt ? { expiresAt: input.expiresAt } : {}),
    },
    include: { invoices: { orderBy: { createdAt: 'desc' } } },
  });

  await auditLogService.record({
    userId: actorId,
    action: 'SUBSCRIPTION_UPDATED',
    entityType: 'Subscription',
    entityId: id,
  });
  return subscription;
}

// Manually mark the latest invoice's payment status (until a gateway exists).
async function recordInvoice(
  subscriptionId: string,
  status: InvoiceStatus,
  note: string | undefined,
  actorId: string,
) {
  const subscription = await prisma.subscription.findUnique({ where: { id: subscriptionId } });
  if (!subscription) throw ApiError.notFound('Subscription');

  const latestInvoice = await prisma.subscriptionInvoice.findFirst({
    where: { subscriptionId },
    orderBy: { createdAt: 'desc' },
  });
  if (!latestInvoice) throw ApiError.notFound('Invoice');

  const invoice = await prisma.subscriptionInvoice.update({
    where: { id: latestInvoice.id },
    data: { status, note: note ?? null, paidAt: status === 'PAID' ? new Date() : null },
  });

  await auditLogService.record({
    userId: actorId,
    action: `INVOICE_${status}`,
    entityType: 'SubscriptionInvoice',
    entityId: invoice.id,
  });
  return invoice;
}

export const subscriptionService = {
  getPlans,
  setPlans,
  list,
  getById,
  create,
  update,
  recordInvoice,
};
