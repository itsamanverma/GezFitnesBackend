import { Router } from 'express';
import { LiveSessionController } from './liveSession.controller.js';
import { requireAuth } from '../../auth/auth.middleware.js';

const router = Router();

// Public route for spectator joining
router.post('/join', LiveSessionController.join);

router.use(requireAuth);

router.post('/start',  LiveSessionController.start);
router.post('/end',    LiveSessionController.end);
router.post('/pause',  LiveSessionController.pause);
router.post('/resume', LiveSessionController.resume);
router.post('/:sessionId/share', LiveSessionController.share);
router.get('/:sessionId/viewers', LiveSessionController.viewers);
router.get('/:sessionId', LiveSessionController.getSession);

export default router;
