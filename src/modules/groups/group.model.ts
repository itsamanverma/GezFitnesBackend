import { Schema, model, Document, Types } from 'mongoose';

export interface IGroup extends Document {
  name: string;
  slug: string;
  type: 'open' | 'invite';
  creatorId: Types.ObjectId;
  description?: string;
  avatar?: string;
  memberCount: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const GroupSchema = new Schema<IGroup>({
  name: { type: String, required: true, trim: true },
  slug: { type: String, required: true, unique: true, index: true },
  type: { type: String, enum: ['open', 'invite'], required: true },
  creatorId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  description: { type: String },
  avatar: { type: String },
  memberCount: { type: Number, default: 1 },
  isActive: { type: Boolean, default: true }
}, {
  timestamps: true,
  versionKey: false
});

export const Group = model<IGroup>('Group', GroupSchema);
