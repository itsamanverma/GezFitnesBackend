import { Schema, model, Document, Types } from 'mongoose';

export interface IDevice extends Document {
  userId: Types.ObjectId;
  deviceToken: string;
  platform: 'ios' | 'android' | 'web';
  deviceId: string;
  appVersion: string;
  lastRegisteredAt: Date;
}

const DeviceSchema = new Schema<IDevice>({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  deviceToken: { type: String, required: true },
  platform: { type: String, enum: ['ios', 'android', 'web'], required: true },
  deviceId: { type: String, required: true },
  appVersion: { type: String, required: true },
  lastRegisteredAt: { type: Date, default: Date.now }
}, {
  timestamps: true,
  versionKey: false
});

DeviceSchema.index({ userId: 1, deviceId: 1 }, { unique: true });

export const Device = model<IDevice>('Device', DeviceSchema);
