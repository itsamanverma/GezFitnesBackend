import { z } from 'zod';
import { GroupService } from './group.service.js';
import { success } from '../../utils/response.js';
const CreateGroupSchema = z.object({
    name: z.string().min(2).max(100),
    type: z.enum(['open', 'invite']),
    description: z.string().max(500).optional(),
    avatar: z.string().url().optional().or(z.string().length(0)),
});
export const GroupController = {
    async create(req, res, next) {
        try {
            const parsedBody = CreateGroupSchema.parse(req.body);
            const userId = req.user.id;
            // Handle empty string for avatar
            const avatar = parsedBody.avatar || undefined;
            const group = await GroupService.create(userId, parsedBody.name, parsedBody.type, parsedBody.description, avatar);
            return success(res, group, 'Group created successfully', 201);
        }
        catch (err) {
            next(err);
        }
    },
    async join(req, res, next) {
        try {
            const groupId = req.params.id;
            const userId = req.user.id;
            const member = await GroupService.join(groupId, userId);
            return success(res, member, 'Joined group successfully', 200);
        }
        catch (err) {
            next(err);
        }
    },
    async joinByToken(req, res, next) {
        try {
            const token = req.params.token;
            const userId = req.user.id;
            const member = await GroupService.joinByToken(token, userId);
            return success(res, member, 'Joined group via invite token successfully', 200);
        }
        catch (err) {
            next(err);
        }
    },
    async createInvite(req, res, next) {
        try {
            const groupId = req.params.id;
            const adminUserId = req.user.id;
            const invite = await GroupService.createInvite(groupId, adminUserId);
            return success(res, invite, 'Invite token created successfully', 201);
        }
        catch (err) {
            next(err);
        }
    },
    async list(req, res, next) {
        try {
            const query = req.query.q;
            const groups = await GroupService.list(query);
            return success(res, groups, 'Groups retrieved successfully', 200);
        }
        catch (err) {
            next(err);
        }
    },
    async getDetails(req, res, next) {
        try {
            const groupId = req.params.id;
            const userId = req.user.id;
            const details = await GroupService.getDetails(groupId, userId);
            return success(res, details, 'Group details retrieved successfully', 200);
        }
        catch (err) {
            next(err);
        }
    }
};
