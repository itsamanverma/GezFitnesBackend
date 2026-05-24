import { Router } from 'express';
import { requireAuth } from '../../auth/auth.middleware.js';
import * as userController from './user.controller.js';

const router = Router();

// All user profile routes require authentication
router.use(requireAuth);

router.get('/me', userController.getMe);
router.patch('/me', userController.updateMe);
router.delete('/me', userController.deleteMe);

export { router as userRoutes };
