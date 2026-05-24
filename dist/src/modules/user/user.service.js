import { User } from './user.model.js';
import { redisClient } from '../../config/redis.js';
import { NotFoundError } from '../../utils/errors.js';
import mongoose from 'mongoose';
export async function getUserById(id) {
    const cacheKey = `cache:user:${id}`;
    try {
        const cached = await redisClient.get(cacheKey);
        if (cached) {
            return JSON.parse(cached);
        }
    }
    catch (err) {
        // Ignore cache error, fallback to DB query
    }
    const user = await User.findById(id);
    if (!user) {
        throw new NotFoundError('User not found');
    }
    try {
        await redisClient.setex(cacheKey, 300, JSON.stringify(user));
    }
    catch (err) {
        // Ignore cache error
    }
    return user;
}
export async function updateUser(id, data) {
    const user = await User.findByIdAndUpdate(id, { $set: data }, { new: true });
    if (!user) {
        throw new NotFoundError('User not found');
    }
    // Invalidate Redis cache
    try {
        await redisClient.del(`cache:user:${id}`);
    }
    catch (err) {
        // Ignore cache error
    }
    return user;
}
export async function deleteUser(id) {
    // Use a transaction or sequential operations to delete user data
    const user = await User.findByIdAndDelete(id);
    if (!user) {
        throw new NotFoundError('User not found');
    }
    const userId = id; // Better Auth uses string IDs
    // 1. Delete all user sessions from sessions collection (managed by Better Auth)
    const db = mongoose.connection.db;
    if (db) {
        await db.collection('sessions').deleteMany({ userId });
        await db.collection('accounts').deleteMany({ userId });
    }
    // 2. Delete workspaces owned by this user
    const Workspace = mongoose.model('Workspace');
    const WorkspaceMember = mongoose.model('WorkspaceMember');
    const ownedWorkspaces = await Workspace.find({ ownerId: userId });
    const ownedWorkspaceIds = ownedWorkspaces.map((w) => w._id);
    if (ownedWorkspaceIds.length > 0) {
        // Delete memberships of the owned workspaces
        await WorkspaceMember.deleteMany({ workspaceId: { $in: ownedWorkspaceIds } });
        // Delete the owned workspaces
        await Workspace.deleteMany({ _id: { $in: ownedWorkspaceIds } });
        // Invalidate workspace cache keys
        for (const wId of ownedWorkspaceIds) {
            try {
                await redisClient.del(`cache:workspace:${wId.toString()}`);
            }
            catch (err) {
                // Ignore cache errors
            }
        }
    }
    // 3. Remove user memberships in other workspaces
    await WorkspaceMember.deleteMany({ userId });
    // 4. Invalidate Redis user cache
    try {
        await redisClient.del(`cache:user:${id}`);
    }
    catch (err) {
        // Ignore cache error
    }
    return true;
}
