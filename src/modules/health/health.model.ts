import { Schema, model, Document, Types } from 'mongoose';

export interface IHealthSync extends Document {
  userId: Types.ObjectId;
  provider: 'apple' | 'android';
  dataPoints: Array<{
    type: string;
    value: number;
    timestamp: Date;
  }>;
  syncedAt: Date;
}

const HealthSyncSchema = new Schema<IHealthSync>({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  provider: { type: String, enum: ['apple', 'android'], required: true },
  dataPoints: [{
    type: { type: String, required: true },
    value: { type: Number, required: true },
    timestamp: { type: Date, required: true }
  }],
  syncedAt: { type: Date, default: Date.now }
}, {
  timestamps: true,
  versionKey: false
});

export const HealthSync = model<IHealthSync>('HealthSync', HealthSyncSchema);
