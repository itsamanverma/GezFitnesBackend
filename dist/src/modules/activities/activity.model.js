import mongoose, { Schema } from 'mongoose';
const ActivitySchema = new Schema({
    userId: { type: String, required: true, index: true },
    activityType: { type: String, required: true, index: true },
    distanceMeters: { type: Number, required: true },
    durationSeconds: { type: Number, required: true },
    avgPace: { type: Number, required: true },
    calories: { type: Number, default: 0 },
    startedAt: { type: Date, required: true, index: true },
    endedAt: { type: Date, required: true },
    routePolyline: {
        type: String,
        required: true,
        default: ''
    },
    deviceMetadata: {
        deviceId: { type: String },
        platform: { type: String },
        appVersion: { type: String }
    }
}, { timestamps: true });
// Ensure a user cannot upload the same clientActivityId twice (idempotency key)
ActivitySchema.index({ userId: 1, clientActivityId: 1 }, { unique: true, partialFilterExpression: { clientActivityId: { $exists: true, $type: "string" } } });
export const Activity = mongoose.model('Activity', ActivitySchema);
