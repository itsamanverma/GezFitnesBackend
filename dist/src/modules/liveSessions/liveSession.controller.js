import { z } from 'zod';
import { LiveSessionService } from './liveSession.service.js';
import { ACTIVITY_TYPE } from '../../utils/constants.js';
import { success, error as errorResponse } from '../../utils/response.js';
const StartSchema = z.object({
    activityType: z.enum([
        ACTIVITY_TYPE.RUN, ACTIVITY_TYPE.WALK, ACTIVITY_TYPE.CYCLE, ACTIVITY_TYPE.HIKE
    ]),
});
const EndSchema = z.object({
    sessionId: z.string().uuid(),
});
const PauseResumeSchema = z.object({
    sessionId: z.string().uuid(),
});
export const LiveSessionController = {
    async start(req, res, next) {
        try {
            const { activityType } = StartSchema.parse(req.body);
            const userId = req.user.id;
            const result = await LiveSessionService.start(userId, activityType);
            return success(res, result, 'Live session started', 201);
        }
        catch (err) {
            if (err.code === 'SESSION_ALREADY_ACTIVE') {
                return errorResponse(res, 'SESSION_ALREADY_ACTIVE', 'You already have an active session', 409);
            }
            next(err);
        }
    },
    async end(req, res, next) {
        try {
            const { sessionId } = EndSchema.parse(req.body);
            const userId = req.user.id;
            const stats = await LiveSessionService.end(sessionId, userId);
            return success(res, stats, 'Session ended successfully', 200);
        }
        catch (err) {
            next(err);
        }
    },
    async pause(req, res, next) {
        try {
            const { sessionId } = PauseResumeSchema.parse(req.body);
            await LiveSessionService.pause(sessionId, req.user.id);
            return success(res, null, 'Session paused', 200);
        }
        catch (err) {
            next(err);
        }
    },
    async resume(req, res, next) {
        try {
            const { sessionId } = PauseResumeSchema.parse(req.body);
            await LiveSessionService.resume(sessionId, req.user.id);
            return success(res, null, 'Session resumed', 200);
        }
        catch (err) {
            next(err);
        }
    },
    async getSession(req, res, next) {
        try {
            const sessionId = req.params.sessionId;
            const session = await LiveSessionService.getById(sessionId);
            if (!session) {
                return errorResponse(res, 'NOT_FOUND', 'Session not found', 404);
            }
            return success(res, session);
        }
        catch (err) {
            next(err);
        }
    },
};
