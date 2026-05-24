import mongoose, { Schema, Document } from 'mongoose';

export interface IActivity extends Document {
  userId: string;
  activityType: string;
  distanceMeters: number;
  durationSeconds: number;
  avgPace: number;
  calories: number;
  startedAt: Date;
  endedAt: Date;
  clientActivityId?: string; // Client-generated UUID for idempotent offline sync
  routeCoordinates: number[][]; // Compressed: [[lat, lng], [lat, lng]]
  deviceMetadata?: {
    deviceId: string;
    platform: string;
    appVersion: string;
  };
  createdAt: Date;
  updatedAt: Date;
}

const ActivitySchema = new Schema(
  {
    userId: { type: String, required: true, index: true },
    activityType: { type: String, required: true, index: true },
    distanceMeters: { type: Number, required: true },
    durationSeconds: { type: Number, required: true },
    avgPace: { type: Number, required: true },
    calories: { type: Number, default: 0 },
    startedAt: { type: Date, required: true, index: true },
    endedAt: { type: Date, required: true },
    routeCoordinates: {
      type: [[Number]], 
      required: true,
      default: []
    },
    deviceMetadata: {
      deviceId: { type: String },
      platform: { type: String },
      appVersion: { type: String }
    }
  },
  { timestamps: true }
);

// Ensure a user cannot upload the same clientActivityId twice (idempotency key)
ActivitySchema.index(
  { userId: 1, clientActivityId: 1 }, 
  { unique: true, partialFilterExpression: { clientActivityId: { $exists: true, $type: "string" } } }
);

export const Activity = mongoose.model<IActivity>('Activity', ActivitySchema);
