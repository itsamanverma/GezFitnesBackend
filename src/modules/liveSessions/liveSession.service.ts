import { v4 as uuidv4 } from 'uuid';
import { Types } from 'mongoose';
import { LiveSession } from './liveSession.model.js';
import { LiveSessionStore } from './liveSession.store.js';
import { SESSION_STATUS, ActivityType } from '../../utils/constants.js';

export const LiveSessionService = {
  async start(userId: string, activityType: ActivityType): Promise<{
    sessionId: string;
    socketRoomId: string;
  }> {
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
      userId:       new Types.ObjectId(userId),
      activityType,
      status:       SESSION_STATUS.ACTIVE,
      isPublic:     false,
      startedAt:    new Date(),
    });

    LiveSessionStore.init(sessionId, userId);

    return { sessionId, socketRoomId: `session:${sessionId}` };
  },

  async authorizeViewer(sessionId: string, viewerId: string): Promise<boolean> {
    const session = await LiveSession.findOne({ sessionId, status: SESSION_STATUS.ACTIVE });
    if (!session) return false;
    if (session.userId.toString() === viewerId) return true;
    if (session.isPublic) return true;
    return session.viewerIds.some(id => id.toString() === viewerId);
  },

  async addViewer(sessionId: string, viewerId: string): Promise<void> {
    await LiveSession.updateOne(
      { sessionId },
      {
        $addToSet: { viewerIds: new Types.ObjectId(viewerId) },
        $inc:      { viewersCount: 1 },
      },
    );
  },

  async pause(sessionId: string, userId: string): Promise<void> {
    await LiveSession.updateOne(
      { sessionId, userId: new Types.ObjectId(userId), status: SESSION_STATUS.ACTIVE },
      { $set: { status: SESSION_STATUS.PAUSED, pausedAt: new Date() } },
    );
    LiveSessionStore.pause(sessionId);
  },

  async resume(sessionId: string, userId: string): Promise<void> {
    await LiveSession.updateOne(
      { sessionId, userId: new Types.ObjectId(userId), status: SESSION_STATUS.PAUSED },
      { $set: { status: SESSION_STATUS.ACTIVE }, $unset: { pausedAt: '' } },
    );
    LiveSessionStore.resume(sessionId);
  },

  async end(sessionId: string, userId: string): Promise<{
    totalDistance: number;
    totalDuration: number;
    averagePace:   number;
  }> {
    const { totalDistance, totalDuration } = await LiveSessionStore.end(sessionId);

    const averagePace = totalDistance > 0
      ? (totalDuration / 60) / (totalDistance / 1000)
      : 0;

    await LiveSession.updateOne(
      { sessionId, userId: new Types.ObjectId(userId) },
      {
        $set: {
          status:        SESSION_STATUS.FINISHED,
          endedAt:       new Date(),
          totalDistance: Math.round(totalDistance),
          totalDuration,
          averagePace:   Math.round(averagePace * 100) / 100,
        },
      },
    );

    return { totalDistance, totalDuration, averagePace };
  },

  async getActive(userId: string) {
    return LiveSession.findOne({
      userId: new Types.ObjectId(userId),
      status: SESSION_STATUS.ACTIVE,
    });
  },

  async getById(sessionId: string) {
    return LiveSession.findOne({ sessionId });
  },
};
