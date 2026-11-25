/**
 * Notification routes — mounted at /api/v1/notifications.
 * All routes require authentication and act only on the user's own rows.
 *
 * Note: `/read-all` is declared before `/:id/read` so the literal path is not
 * swallowed by the id parameter.
 */
import { Router } from 'express';
import * as notificationController from './notification.controller';
import { authenticate } from '../../middlewares/authenticate';
import { validate } from '../../middlewares/validate';
import { asyncHandler } from '../../utils/async-handler';
import { z } from 'zod';

const idParam = z.object({ id: z.string().uuid('Invalid id') });

const router = Router();
router.use(authenticate);

router.get('/', asyncHandler(notificationController.list));
router.patch('/read-all', asyncHandler(notificationController.markAllRead));
router.patch('/:id/read', validate({ params: idParam }), asyncHandler(notificationController.markRead));
router.delete('/:id', validate({ params: idParam }), asyncHandler(notificationController.remove));

export default router;
