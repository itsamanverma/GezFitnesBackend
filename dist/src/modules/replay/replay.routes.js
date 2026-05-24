import { Router } from 'express';
import { requireAuth } from '../../auth/auth.middleware.js';
import { getReplayData } from './replay.controller.js';
const router = Router();
// All replay routes are protected
router.use(requireAuth);
router.get('/:activityId', getReplayData);
export default router;
