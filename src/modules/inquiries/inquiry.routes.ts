/**
 * Inquiry routes — mounted at /api/v1/inquiries.
 *
 * All routes require authentication. We do NOT restrict by global role here
 * because both customers and sellers use inquiries; fine-grained access
 * (who may read/append/resolve a given thread) is enforced in the service.
 */
import { Router } from 'express';
import * as inquiryController from './inquiry.controller';
import { authenticate } from '../../middlewares/authenticate';
import { validate } from '../../middlewares/validate';
import { asyncHandler } from '../../utils/async-handler';
import {
  createInquirySchema,
  addMessageSchema,
  listInquiriesQuerySchema,
  idParamSchema,
} from './inquiry.validation';

const router = Router();
router.use(authenticate);

router.post('/', validate({ body: createInquirySchema }), asyncHandler(inquiryController.create));
router.get('/', validate({ query: listInquiriesQuerySchema }), asyncHandler(inquiryController.list));
router.get('/:id', validate({ params: idParamSchema }), asyncHandler(inquiryController.getById));
router.post('/:id/messages', validate({ params: idParamSchema, body: addMessageSchema }), asyncHandler(inquiryController.addMessage));
router.patch('/:id/resolve', validate({ params: idParamSchema }), asyncHandler(inquiryController.resolve));

export default router;
