import { Router } from 'express';
import { requireAuth } from '../../auth/auth.middleware.js';
import { validateRequest } from '../../middleware/validate.middleware.js';
import { createActivitySchema } from './activity.schema.js';
import { createActivity, getActivities, getActivityById, deleteActivity } from './activity.controller.js';

const router = Router();

// All activity routes are protected
router.use(requireAuth);

router.post('/', validateRequest(createActivitySchema), createActivity);
router.get('/', getActivities);
router.get('/:id', getActivityById);
router.delete('/:id', deleteActivity);

export default router;
