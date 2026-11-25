/**
 * Inquiry service — a simple threaded Q&A between a customer and a shop.
 *
 * This is NOT a real-time chat; it is database-backed messages with
 * notifications. Security is strict:
 *   - A customer can only see/append to inquiries THEY opened.
 *   - A seller can only see/append to inquiries for shops they are a member of.
 *   - Admins can access any inquiry.
 * The sender id and ownership always come from the verified token, never the
 * request body, so roles cannot be spoofed.
 */
import type { Prisma, UserRole } from '@prisma/client';
import { prisma } from '../../config/database';
import { ApiError } from '../../utils/api-error';
import { getPagination, buildMeta } from '../../utils/pagination';
import { shopMemberService } from '../shop-members/shop-member.service';
import { notificationService } from '../notifications/notification.service';
import type { CreateInquiryInput, ListInquiriesQuery } from './inquiry.validation';

type Actor = { id: string; role: UserRole };

// Notify all members of a shop (e.g. new customer inquiry/message).
async function notifyShopMembers(shopId: string, inquiryId: string, title: string) {
  const members = await prisma.shopMember.findMany({ where: { shopId }, select: { userId: true } });
  await notificationService.createForManyUsers(
    members.map((m) => m.userId),
    { type: 'INQUIRY_RECEIVED', title, data: { inquiryId, shopId } },
  );
}

async function create(input: CreateInquiryInput, customer: Actor) {
  const shop = await prisma.shop.findFirst({ where: { id: input.shopId, deletedAt: null } });
  if (!shop) throw ApiError.badRequest('Shop does not exist');

  // If a product is referenced, make sure it belongs to this shop.
  if (input.productId) {
    const product = await prisma.product.findFirst({
      where: { id: input.productId, shopId: input.shopId, deletedAt: null },
      select: { id: true },
    });
    if (!product) throw ApiError.badRequest('Product does not belong to this shop');
  }

  const inquiry = await prisma.$transaction(async (tx) => {
    const created = await tx.inquiry.create({
      data: {
        customerId: customer.id,
        shopId: input.shopId,
        productId: input.productId ?? null,
        subject: input.subject ?? null,
        status: 'OPEN',
      },
    });
    await tx.inquiryMessage.create({
      data: { inquiryId: created.id, senderId: customer.id, body: input.message },
    });
    return created;
  });

  await notifyShopMembers(input.shopId, inquiry.id, 'New customer inquiry');
  return getById(inquiry.id, customer);
}

// Build the where-clause that limits results to what the actor may see.
function accessScope(actor: Actor, query?: ListInquiriesQuery): Prisma.InquiryWhereInput {
  if (shopMemberService.isAdmin(actor.role)) {
    // Admins see everything (optionally narrowed by filters).
    return {};
  }
  // Non-admins: only their own inquiries (as customer) or their shops (as seller).
  const asCustomer: Prisma.InquiryWhereInput = { customerId: actor.id };
  const asSeller: Prisma.InquiryWhereInput = { shop: { members: { some: { userId: actor.id } } } };

  if (query?.role === 'customer') return asCustomer;
  if (query?.role === 'seller') return asSeller;
  return { OR: [asCustomer, asSeller] };
}

async function list(actor: Actor, query: ListInquiriesQuery) {
  const { skip, take, page, limit } = getPagination(query);
  const where: Prisma.InquiryWhereInput = {
    ...accessScope(actor, query),
    ...(query.status ? { status: query.status } : {}),
    ...(query.shopId ? { shopId: query.shopId } : {}),
  };

  const [items, total] = await Promise.all([
    prisma.inquiry.findMany({
      where,
      orderBy: { updatedAt: 'desc' },
      skip,
      take,
      include: {
        shop: { select: { id: true, slug: true } },
        _count: { select: { messages: true } },
      },
    }),
    prisma.inquiry.count({ where }),
  ]);

  return { items, meta: buildMeta(total, page, limit) };
}

// Load an inquiry and verify the actor is allowed to access it.
async function loadWithAccess(id: string, actor: Actor) {
  const inquiry = await prisma.inquiry.findUnique({ where: { id } });
  if (!inquiry) throw ApiError.notFound('Inquiry');

  const isCustomer = inquiry.customerId === actor.id;
  const isAdmin = shopMemberService.isAdmin(actor.role);
  const isSeller = isAdmin ? false : await shopMemberService.isMember(actor.id, inquiry.shopId);

  if (!isCustomer && !isAdmin && !isSeller) {
    throw ApiError.forbidden('You do not have access to this inquiry');
  }
  return { inquiry, isCustomer };
}

async function getById(id: string, actor: Actor) {
  await loadWithAccess(id, actor);
  return prisma.inquiry.findUniqueOrThrow({
    where: { id },
    include: {
      shop: { select: { id: true, slug: true } },
      product: { select: { id: true } },
      messages: {
        orderBy: { createdAt: 'asc' },
        include: { sender: { select: { id: true, name: true, role: true } } },
      },
    },
  });
}

async function addMessage(id: string, actor: Actor, message: string) {
  const { inquiry, isCustomer } = await loadWithAccess(id, actor);

  await prisma.$transaction([
    prisma.inquiryMessage.create({ data: { inquiryId: id, senderId: actor.id, body: message } }),
    // Touch updatedAt so the thread moves to the top of lists.
    prisma.inquiry.update({ where: { id }, data: { updatedAt: new Date() } }),
  ]);

  // Notify the OTHER party.
  if (isCustomer) {
    await notifyShopMembers(inquiry.shopId, id, 'New message on a customer inquiry');
  } else {
    await notificationService.create({
      userId: inquiry.customerId,
      type: 'INQUIRY_REPLIED',
      title: 'The seller replied to your inquiry',
      data: { inquiryId: id, shopId: inquiry.shopId },
    });
  }

  return getById(id, actor);
}

// Only a shop member (or admin) can mark an inquiry resolved.
async function resolve(id: string, actor: Actor) {
  const inquiry = await prisma.inquiry.findUnique({ where: { id } });
  if (!inquiry) throw ApiError.notFound('Inquiry');
  await shopMemberService.assertShopAccess(actor.id, actor.role, inquiry.shopId);

  await prisma.inquiry.update({ where: { id }, data: { status: 'RESOLVED' } });
  return getById(id, actor);
}

export const inquiryService = { create, list, getById, addMessage, resolve };
