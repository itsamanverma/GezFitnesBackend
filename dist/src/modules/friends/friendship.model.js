import { Schema, model } from 'mongoose';
const FriendshipSchema = new Schema({
    requesterId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    recipientId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    status: {
        type: String,
        enum: ['pending', 'accepted', 'declined'],
        default: 'pending'
    }
}, {
    timestamps: true,
    versionKey: false
});
// Ensure a unique relationship pair in one direction (A -> B)
FriendshipSchema.index({ requesterId: 1, recipientId: 1 }, { unique: true });
export const Friendship = model('Friendship', FriendshipSchema);
