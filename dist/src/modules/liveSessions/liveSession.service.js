import { v4 as uuidv4 } from 'uuid';
import { Types } from 'mongoose';
import crypto from 'crypto';
import { LiveSession } from './liveSession.model.js';
import { LiveSessionStore } from './liveSession.store.js';
import { SESSION_STATUS } from '../../utils/constants.js';
export const LiveSessionService = {
    async start(userId, activityType, groupId) {
        if (groupId) {
            const { GroupService } = await import('../groups/group.service.js');
            const isMember = await GroupService.checkMembership(groupId, userId);
            if (!isMember) {
                throw Object.assign(new Error('You are not an active member of this group'), { code: 'NOT_GROUP_MEMBER' });
            }
        }
        const existing = await LiveSession.findOne({
            userId: new Types.ObjectId(userId),
            status: SESSION_STATUS.ACTIVE,
        });
        if (existing) {
            throw Object.assign(new Error('Active session already exists'), { code: 'SESSION_ALREADY_ACTIVE' });
        }
        const sessionId = uuidv4();
        await LiveSession.create({
            sessionId,
            userId: new Types.ObjectId(userId),
            activityType,
            status: SESSION_STATUS.ACTIVE,
            isPublic: false,
            groupId: groupId ? new Types.ObjectId(groupId) : undefined,
            startedAt: new Date(),
            expiresAt: new Date(Date.now() + 3 * 60 * 60 * 1000), // Default to 3 hours
            viewerCount: 0,
            isActive: true,
        });
        LiveSessionStore.init(sessionId, userId, groupId);
        return { sessionId, socketRoomId: `session:${sessionId}` };
    },
    async authorizeViewer(sessionId, viewerId) {
        const session = await LiveSession.findOne({ sessionId, status: SESSION_STATUS.ACTIVE });
        if (!session)
            return false;
        if (session.userId.toString() === viewerId)
            return true;
        if (session.isPublic)
            return true;
        return session.viewerIds.some(id => id.toString() === viewerId);
    },
    async addViewer(sessionId, viewerId) {
        await LiveSession.updateOne({ sessionId }, {
            $addToSet: { viewerIds: new Types.ObjectId(viewerId) },
            $inc: { viewersCount: 1, viewerCount: 1 },
        });
    },
    async pause(sessionId, userId) {
        await LiveSession.updateOne({ sessionId, userId: new Types.ObjectId(userId), status: SESSION_STATUS.ACTIVE }, { $set: { status: SESSION_STATUS.PAUSED, pausedAt: new Date() } });
        LiveSessionStore.pause(sessionId);
    },
    async resume(sessionId, userId) {
        await LiveSession.updateOne({ sessionId, userId: new Types.ObjectId(userId), status: SESSION_STATUS.PAUSED }, { $set: { status: SESSION_STATUS.ACTIVE }, $unset: { pausedAt: '' } });
        LiveSessionStore.resume(sessionId);
    },
    async end(sessionId, userId) {
        const { totalDistance, totalDuration } = await LiveSessionStore.end(sessionId);
        const averagePace = totalDistance > 0
            ? (totalDuration / 60) / (totalDistance / 1000)
            : 0;
        await LiveSession.updateOne({ sessionId, userId: new Types.ObjectId(userId) }, {
            $set: {
                status: SESSION_STATUS.FINISHED,
                endedAt: new Date(),
                totalDistance: Math.round(totalDistance),
                totalDuration,
                averagePace: Math.round(averagePace * 100) / 100,
                isActive: false,
            },
        });
        return { totalDistance, totalDuration, averagePace };
    },
    async generateShareLink(sessionId, userId) {
        const session = await LiveSession.findOne({
            sessionId,
            userId: new Types.ObjectId(userId),
            status: SESSION_STATUS.ACTIVE
        });
        if (!session) {
            throw Object.assign(new Error('Session not found or not active'), { code: 'NOT_FOUND' });
        }
        const shareCode = `NEX-${Math.floor(1000 + Math.random() * 9000)}`;
        const shareToken = crypto.randomBytes(4).toString('hex');
        const expiresAt = new Date(Date.now() + 3 * 60 * 60 * 1000); // 3 hours
        session.shareCode = shareCode;
        session.shareToken = shareToken;
        session.expiresAt = expiresAt;
        await session.save();
        return {
            shareCode,
            shareToken,
            expiresAt,
            qrPayload: {
                sessionId,
                shareToken
            }
        };
    },
    async joinSession(shareCode, shareToken) {
        const session = await LiveSession.findOne({
            shareCode,
            shareToken,
            status: SESSION_STATUS.ACTIVE,
            expiresAt: { $gt: new Date() }
        }).populate('userId', 'name');
        if (!session) {
            throw Object.assign(new Error('Invalid share code or token, or session expired'), { code: 'SESSION_NOT_FOUND' });
        }
        session.viewerCount = (session.viewerCount || 0) + 1;
        session.viewersCount = (session.viewersCount || 0) + 1;
        await session.save();
        const owner = session.userId;
        return {
            sessionId: session.sessionId,
            ownerUserId: owner._id.toString(),
            ownerName: owner.name || 'Unknown User',
            activityType: session.activityType,
            status: session.status,
            viewerCount: session.viewerCount
        };
    },
    async getViewersCount(sessionId) {
        const session = await LiveSession.findOne({ sessionId });
        if (!session) {
            throw Object.assign(new Error('Session not found'), { code: 'NOT_FOUND' });
        }
        return { viewerCount: session.viewerCount || 0 };
    },
    async getActive(userId) {
        return LiveSession.findOne({
            userId: new Types.ObjectId(userId),
            status: SESSION_STATUS.ACTIVE,
        });
    },
    async getById(sessionId) {
        return LiveSession.findOne({ sessionId });
    },
};
