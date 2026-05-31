import { Request, Response } from 'express';
import { Activity } from '../activities/activity.model.js';
import { success, error as errorResponse } from '../../utils/response.js';

export const getReplayData = async (req: Request, res: Response) => {
  try {
    const { activityId } = req.params;
    const userId = req.user?.id;

    const activity = await Activity.findOne({ _id: activityId, userId });
    
    if (!activity) {
      return errorResponse(res, 'NOT_FOUND', 'Activity not found', 404);
    }

    // ARCHITECTURE NOTE (Phase 4):
    // In the future, this endpoint will evolve to handle:
    // 1. Route simplification (e.g. Douglas-Peucker) for massive routes over 10k points
    // 2. Interpolation generation for smooth 60fps cinematic replays
    // 3. Precomputed bounding boxes for map auto-zoom
    
    // For now (MVP), we wrap the raw coordinates in a scalable replay payload structure.
    const replayPayload = {
      activityId: activity._id,
      metadata: {
        activityType: activity.activityType,
        totalDistance: activity.distanceMeters,
        totalDuration: activity.durationSeconds,
        startedAt: activity.startedAt,
      },
      // Prepare for future 'frames' or 'simplified' coordinates
      routePolyline: activity.routePolyline,
      // Placeholder for future cinematic config
      cinematicConfig: {
        ready: false, // True once background workers precompute interpolation
        version: "1.0"
      }
    };

    return success(res, replayPayload);
  } catch (error: any) {
    return errorResponse(res, 'SERVER_ERROR', error.message, 500);
  }
};
