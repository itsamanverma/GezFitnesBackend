import { Types } from 'mongoose';
import { Friendship } from './friendship.model.js';
import { User } from '../user/user.model.js';
import { NotFoundError, BadRequestError, ConflictError } from '../../utils/errors.js';
export const FriendsService = {
    async sendFriendRequest(requesterIdStr, recipientEmailOrId) {
        let recipient;
        // Check if input is a valid ObjectId, otherwise search by email
        if (Types.ObjectId.isValid(recipientEmailOrId)) {
            recipient = await User.findById(recipientEmailOrId);
        }
        else {
            recipient = await User.findOne({ email: recipientEmailOrId.trim().toLowerCase() });
        }
        if (!recipient) {
            throw new NotFoundError('Recipient user not found');
        }
        const requesterId = new Types.ObjectId(requesterIdStr);
        const recipientId = new Types.ObjectId(recipient._id);
        if (requesterId.equals(recipientId)) {
            throw new BadRequestError('You cannot send a friend request to yourself');
        }
        // Check existing friendship in either direction
        const existing = await Friendship.findOne({
            $or: [
                { requesterId, recipientId },
                { requesterId: recipientId, recipientId: requesterId }
            ]
        });
        if (existing) {
            if (existing.status === 'accepted') {
                throw new ConflictError('You are already friends with this user');
            }
            if (existing.status === 'pending') {
                if (existing.requesterId.equals(requesterId)) {
                    throw new ConflictError('Friend request already sent and is pending');
                }
                else {
                    // If a request already exists in the opposite direction, accept it automatically
                    existing.status = 'accepted';
                    await existing.save();
                    return existing;
                }
            }
            // If it was declined, we can reset it to pending
            existing.status = 'pending';
            existing.requesterId = requesterId;
            existing.recipientId = recipientId;
            await existing.save();
            return existing;
        }
        const friendship = await Friendship.create({
            requesterId,
            recipientId,
            status: 'pending'
        });
        return friendship;
    },
    async acceptFriendRequest(recipientIdStr, requestIdStr) {
        if (!Types.ObjectId.isValid(requestIdStr)) {
            throw new BadRequestError('Invalid request ID');
        }
        const recipientId = new Types.ObjectId(recipientIdStr);
        const requestId = new Types.ObjectId(requestIdStr);
        const friendship = await Friendship.findOne({ _id: requestId, recipientId });
        if (!friendship) {
            throw new NotFoundError('Friend request not found or not sent to you');
        }
        if (friendship.status === 'accepted') {
            throw new ConflictError('Friend request is already accepted');
        }
        friendship.status = 'accepted';
        await friendship.save();
        return friendship;
    },
    async declineFriendRequest(recipientIdStr, requestIdStr) {
        if (!Types.ObjectId.isValid(requestIdStr)) {
            throw new BadRequestError('Invalid request ID');
        }
        const recipientId = new Types.ObjectId(recipientIdStr);
        const requestId = new Types.ObjectId(requestIdStr);
        const friendship = await Friendship.findOne({ _id: requestId, recipientId });
        if (!friendship) {
            throw new NotFoundError('Friend request not found or not sent to you');
        }
        friendship.status = 'declined';
        await friendship.save();
        return friendship;
    },
    async listFriends(userIdStr) {
        const userId = new Types.ObjectId(userIdStr);
        const friendships = await Friendship.find({
            status: 'accepted',
            $or: [{ requesterId: userId }, { recipientId: userId }]
        }).populate('requesterId recipientId', 'name email image');
        // Format output to return user profile data of the friend
        return friendships.map(f => {
            const isRequester = f.requesterId._id.toString() === userIdStr;
            const friendObj = isRequester ? f.recipientId : f.requesterId;
            return {
                friendshipId: f._id,
                friend: friendObj,
                connectedAt: f.updatedAt
            };
        });
    },
    async listPendingRequests(userIdStr) {
        const userId = new Types.ObjectId(userIdStr);
        const requests = await Friendship.find({
            status: 'pending',
            recipientId: userId
        }).populate('requesterId', 'name email image');
        return requests.map(r => ({
            requestId: r._id,
            requester: r.requesterId,
            createdAt: r.createdAt
        }));
    }
};
