import { Schema, model } from 'mongoose';
const GroupMemberSchema = new Schema({
    groupId: { type: Schema.Types.ObjectId, ref: 'Group', required: true },
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    role: { type: String, enum: ['admin', 'member'], default: 'member' },
    joinedAt: { type: Date, default: Date.now },
    status: { type: String, enum: ['active', 'suspended'], default: 'active' }
}, {
    versionKey: false
});
// Ensure a user can only be added to a group once
GroupMemberSchema.index({ groupId: 1, userId: 1 }, { unique: true });
export const GroupMember = model('GroupMember', GroupMemberSchema);
