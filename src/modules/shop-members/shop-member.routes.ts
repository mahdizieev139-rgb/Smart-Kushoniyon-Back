/**
 * Shop member routes — nested under /api/v1/shops/:id/members.
 */
import { Router } from 'express';
import * as shopMemberController from './shop-member.controller';
import { validate } from '../../middlewares/validate';
import { authenticate } from '../../middlewares/authenticate';
import { authorize } from '../../middlewares/authorize';
import { asyncHandler } from '../../utils/async-handler';
import { addMemberSchema, memberParamSchema } from './shop-member.validation';

const router = Router({ mergeParams: true });

router.use(authenticate, authorize('SELLER', 'ADMIN', 'SUPER_ADMIN'));

router.get('/', asyncHandler(shopMemberController.list));
router.post('/', validate({ body: addMemberSchema }), asyncHandler(shopMemberController.add));
router.delete('/:memberId', validate({ params: memberParamSchema }), asyncHandler(shopMemberController.remove));

export default router;
