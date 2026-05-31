import { Schema, model, Document, Types } from 'mongoose';

export interface IFriendship extends Document {
  requesterId: Types.ObjectId;
  recipientId: Types.ObjectId;
  status: 'pending' | 'accepted' | 'declined';
  createdAt: Date;
  updatedAt: Date;
}

const FriendshipSchema = new Schema<IFriendship>(
  {
    requesterId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    recipientId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    status: {
      type: String,
      enum: ['pending', 'accepted', 'declined'],
      default: 'pending'
    }
  },
  {
    timestamps: true,
    versionKey: false
  }
);

// Ensure a unique relationship pair in one direction (A -> B)
FriendshipSchema.index({ requesterId: 1, recipientId: 1 }, { unique: true });

export const Friendship = model<IFriendship>('Friendship', FriendshipSchema);
