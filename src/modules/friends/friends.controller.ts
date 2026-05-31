import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { FriendsService } from './friends.service.js';
import { success } from '../../utils/response.js';

const FriendRequestSchema = z.object({
  recipient: z.string().min(1, 'Recipient ID or Email is required')
});

const ActionRequestSchema = z.object({
  requestId: z.string().min(1, 'Request ID is required')
});

export const FriendsController = {
  async sendRequest(req: Request, res: Response, next: NextFunction) {
    try {
      const { recipient } = FriendRequestSchema.parse(req.body);
      const userId = (req as any).user!.id;

      const friendship = await FriendsService.sendFriendRequest(userId, recipient);
      
      const message = friendship.status === 'accepted' 
        ? 'Friend request accepted automatically' 
        : 'Friend request sent successfully';

      return success(res, friendship, message, 201);
    } catch (err) {
      next(err);
    }
  },

  async acceptRequest(req: Request, res: Response, next: NextFunction) {
    try {
      const { requestId } = ActionRequestSchema.parse(req.body);
      const userId = (req as any).user!.id;

      const friendship = await FriendsService.acceptFriendRequest(userId, requestId);

      return success(res, friendship, 'Friend request accepted successfully', 200);
    } catch (err) {
      next(err);
    }
  },

  async declineRequest(req: Request, res: Response, next: NextFunction) {
    try {
      const { requestId } = ActionRequestSchema.parse(req.body);
      const userId = (req as any).user!.id;

      const friendship = await FriendsService.declineFriendRequest(userId, requestId);

      return success(res, friendship, 'Friend request declined successfully', 200);
    } catch (err) {
      next(err);
    }
  },

  async listFriends(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = (req as any).user!.id;
      const friends = await FriendsService.listFriends(userId);

      return success(res, friends, 'Friends list retrieved successfully', 200);
    } catch (err) {
      next(err);
    }
  },

  async listPending(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = (req as any).user!.id;
      const requests = await FriendsService.listPendingRequests(userId);

      return success(res, requests, 'Pending friend requests retrieved successfully', 200);
    } catch (err) {
      next(err);
    }
  }
};
