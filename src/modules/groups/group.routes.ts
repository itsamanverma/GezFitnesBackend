import { Router } from 'express';
import { GroupController } from './group.controller.js';
import { requireAuth } from '../../auth/auth.middleware.js';

const router = Router();

router.use(requireAuth);

router.post('/', GroupController.create);
router.get('/', GroupController.list);
router.get('/:id', GroupController.getDetails);
router.post('/:id/join', GroupController.join);
router.post('/:id/invites', GroupController.createInvite);
router.post('/join/:token', GroupController.joinByToken);

export default router;
