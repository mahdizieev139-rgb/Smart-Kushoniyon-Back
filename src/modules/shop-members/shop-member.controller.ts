/**
 * Shop member controller — manage who can act on a shop.
 *
 * Mounted with mergeParams under /shops/:id/members, so req.params.id is the
 * shop id. Only shop members (OWNER/MANAGER) or admins may manage members.
 */
import type { Request, Response } from 'express';
import { shopMemberService } from './shop-member.service';
import { sendSuccess, sendCreated } from '../../utils/api-response';
import { ApiError } from '../../utils/api-error';

export async function list(req: Request, res: Response) {
  if (!req.user) throw ApiError.unauthorized();
  // Only members/admins can see the member list.
  await shopMemberService.assertShopAccess(req.user.id, req.user.role, req.params.id);
  const members = await shopMemberService.listMembers(req.params.id);
  return sendSuccess(res, members, 'Shop members');
}

export async function add(req: Request, res: Response) {
  if (!req.user) throw ApiError.unauthorized();
  await shopMemberService.assertShopAccess(req.user.id, req.user.role, req.params.id);
  const member = await shopMemberService.addMember(req.params.id, req.body.userId, req.body.role);
  return sendCreated(res, member, 'Member added');
}

export async function remove(req: Request, res: Response) {
  if (!req.user) throw ApiError.unauthorized();
  await shopMemberService.assertShopAccess(req.user.id, req.user.role, req.params.id);
  await shopMemberService.removeMember(req.params.id, req.params.memberId);
  return sendSuccess(res, null, 'Member removed');
}
