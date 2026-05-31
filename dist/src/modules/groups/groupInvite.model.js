import { Schema, model } from 'mongoose';
const GroupInviteSchema = new Schema({
    groupId: { type: Schema.Types.ObjectId, ref: 'Group', required: true },
    token: { type: String, required: true, unique: true },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    expiresAt: { type: Date, required: true }
}, {
    timestamps: true,
    versionKey: false
});
// TTL index to automatically remove expired invites from database
GroupInviteSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
export const GroupInvite = model('GroupInvite', GroupInviteSchema);
