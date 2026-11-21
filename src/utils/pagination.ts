/**
 * Pagination helpers.
 *
 * We use simple page/limit pagination. `skip`/`take` map directly to Prisma.
 * We clamp limit so a client cannot request a million rows at once.
 */
export interface PaginationParams {
  page: number;
  limit: number;
}

export interface PaginationResult {
  skip: number;
  take: number;
  page: number;
  limit: number;
}

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

export function getPagination(params: Partial<PaginationParams>): PaginationResult {
  const page = Math.max(1, params.page ?? 1);
  const limit = Math.min(MAX_LIMIT, Math.max(1, params.limit ?? DEFAULT_LIMIT));
  return { skip: (page - 1) * limit, take: limit, page, limit };
}

export function buildMeta(total: number, page: number, limit: number) {
  return { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) };
}
