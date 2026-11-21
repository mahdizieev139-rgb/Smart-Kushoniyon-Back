/**
 * Audit log controller (SUPER_ADMIN only — wired in the admin routes).
 */
import type { Request, Response } from 'express';
import { auditLogService } from './audit-log.service';
import { sendSuccess } from '../../utils/api-response';

export async function list(req: Request, res: Response) {
  const result = await auditLogService.list(req.query as never);
  return sendSuccess(res, result.items, 'Audit logs', 200, result.meta);
}
