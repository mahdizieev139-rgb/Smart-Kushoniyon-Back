/**
 * Notification service — in-app notifications (no WebSockets).
 *
 * Other modules call `create` / `createForManyUsers` to notify users about
 * events (price changed, product available again, inquiry received/replied).
 * Users read/clear their own notifications via the controller.
 *
 * Ownership: every read/update/delete is scoped by `userId`, so a user can only
 * ever touch their own notifications.
 */
import type { Prisma, NotificationType } from '@prisma/client';
import { prisma } from '../../config/database';
import { ApiError } from '../../utils/api-error';
import { getPagination, buildMeta } from '../../utils/pagination';
import { logger } from '../../config/logger';

interface CreateInput {
  userId: string;
  type: NotificationType;
  title: string;
  body?: string;
  data?: Prisma.InputJsonValue;
}

async function create(input: CreateInput) {
  return prisma.notification.create({
    data: {
      userId: input.userId,
      type: input.type,
      title: input.title,
      body: input.body ?? null,
      data: input.data,
    },
  });
}

/**
 * Create the same notification for many users at once (e.g. everyone who
 * favorited a product whose price changed). Deduplicates against recent UNREAD
 * notifications of the same type for the same entity so one event does not spam
 * a user with repeats. Never throws — notifications must not break the caller.
 */
async function createForManyUsers(
  userIds: string[],
  input: Omit<CreateInput, 'userId'> & { dedupeKey?: string },
) {
  if (userIds.length === 0) return;
  try {
    // Skip users who already have an unread notification for this exact event.
    let alreadyNotified = new Set<string>();
    if (input.dedupeKey) {
      const existing = await prisma.notification.findMany({
        where: {
          userId: { in: userIds },
          type: input.type,
          readAt: null,
          data: { path: ['dedupeKey'], equals: input.dedupeKey },
        },
        select: { userId: true },
      });
      alreadyNotified = new Set(existing.map((n) => n.userId));
    }

    const rows = userIds
      .filter((userId) => !alreadyNotified.has(userId))
      .map((userId) => ({
        userId,
        type: input.type,
        title: input.title,
        body: input.body ?? null,
        data: input.dedupeKey
          ? ({ ...(input.data as object), dedupeKey: input.dedupeKey } as Prisma.InputJsonValue)
          : input.data,
      }));

    if (rows.length > 0) await prisma.notification.createMany({ data: rows });
  } catch (error) {
    logger.error({ error, type: input.type }, 'Failed to create bulk notifications');
  }
}

async function list(userId: string, query: { page?: number; limit?: number; unreadOnly?: boolean }) {
  const { skip, take, page, limit } = getPagination(query);
  const where: Prisma.NotificationWhereInput = {
    userId,
    ...(query.unreadOnly ? { readAt: null } : {}),
  };

  const [items, total, unreadCount] = await Promise.all([
    prisma.notification.findMany({ where, orderBy: { createdAt: 'desc' }, skip, take }),
    prisma.notification.count({ where }),
    prisma.notification.count({ where: { userId, readAt: null } }),
  ]);

  return { items, meta: { ...buildMeta(total, page, limit), unreadCount } };
}

async function markRead(userId: string, id: string) {
  // updateMany with userId in the filter guarantees ownership.
  const result = await prisma.notification.updateMany({
    where: { id, userId, readAt: null },
    data: { readAt: new Date() },
  });
  if (result.count === 0) {
    // Either it doesn't exist, isn't ours, or was already read.
    const exists = await prisma.notification.findFirst({ where: { id, userId } });
    if (!exists) throw ApiError.notFound('Notification');
  }
  return prisma.notification.findFirst({ where: { id, userId } });
}

async function markAllRead(userId: string) {
  const result = await prisma.notification.updateMany({
    where: { userId, readAt: null },
    data: { readAt: new Date() },
  });
  return { updated: result.count };
}

async function remove(userId: string, id: string) {
  const result = await prisma.notification.deleteMany({ where: { id, userId } });
  if (result.count === 0) throw ApiError.notFound('Notification');
}

export const notificationService = { create, createForManyUsers, list, markRead, markAllRead, remove };
