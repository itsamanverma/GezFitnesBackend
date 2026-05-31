import { z } from 'zod';
import { LiveSessionService } from './liveSession.service.js';
import { ACTIVITY_TYPE } from '../../utils/constants.js';
import { success, error as errorResponse } from '../../utils/response.js';
const StartSchema = z.object({
    activityType: z.enum([
        ACTIVITY_TYPE.RUN, ACTIVITY_TYPE.WALK, ACTIVITY_TYPE.CYCLE, ACTIVITY_TYPE.HIKE
    ]),
    groupId: z.string().optional(),
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
            const { activityType, groupId } = StartSchema.parse(req.body);
            const userId = req.user.id;
            const result = await LiveSessionService.start(userId, activityType, groupId);
            return success(res, result, 'Live session started', 201);
        }
        catch (err) {
            if (err.code === 'SESSION_ALREADY_ACTIVE') {
                return errorResponse(res, 'SESSION_ALREADY_ACTIVE', 'You already have an active session', 409);
            }
            if (err.code === 'NOT_GROUP_MEMBER') {
                return errorResponse(res, 'NOT_GROUP_MEMBER', err.message, 403);
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
    async share(req, res, next) {
        try {
            const sessionId = req.params.sessionId;
            const userId = req.user.id;
            const result = await LiveSessionService.generateShareLink(sessionId, userId);
            return success(res, result, 'Share link created successfully', 200);
        }
        catch (err) {
            if (err.code === 'NOT_FOUND') {
                return errorResponse(res, 'NOT_FOUND', 'Session not found or not active', 404);
            }
            next(err);
        }
    },
    async join(req, res, next) {
        try {
            const { shareCode, shareToken } = req.body;
            if (!shareCode || !shareToken) {
                return errorResponse(res, 'BAD_REQUEST', 'shareCode and shareToken are required', 400);
            }
            const result = await LiveSessionService.joinSession(shareCode, shareToken);
            return success(res, result, 'Joined live session successfully', 200);
        }
        catch (err) {
            if (err.code === 'SESSION_NOT_FOUND') {
                return errorResponse(res, 'NOT_FOUND', err.message, 404);
            }
            next(err);
        }
    },
    async viewers(req, res, next) {
        try {
            const sessionId = req.params.sessionId;
            const result = await LiveSessionService.getViewersCount(sessionId);
            return success(res, result, 'Viewer count retrieved successfully', 200);
        }
        catch (err) {
            if (err.code === 'NOT_FOUND') {
                return errorResponse(res, 'NOT_FOUND', 'Session not found', 404);
            }
            next(err);
        }
    },
};
