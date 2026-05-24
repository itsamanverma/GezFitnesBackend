import { Router } from 'express';
import { LiveSessionController } from './liveSession.controller.js';
import { requireAuth } from '../../auth/auth.middleware.js';

const router = Router();

router.use(requireAuth);

router.post('/start',  LiveSessionController.start);
router.post('/end',    LiveSessionController.end);
router.post('/pause',  LiveSessionController.pause);
router.post('/resume', LiveSessionController.resume);
router.get('/:sessionId', LiveSessionController.getSession);

export default router;
