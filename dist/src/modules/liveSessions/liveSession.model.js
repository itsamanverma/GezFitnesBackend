import { Schema, model } from 'mongoose';
import { SESSION_STATUS, ACTIVITY_TYPE } from '../../utils/constants.js';
const LiveSessionSchema = new Schema({
    sessionId: { type: String, required: true, unique: true, index: true },
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    status: { type: String, enum: Object.values(SESSION_STATUS), default: SESSION_STATUS.ACTIVE },
    activityType: { type: String, enum: Object.values(ACTIVITY_TYPE), required: true },
    startedAt: { type: Date, default: Date.now },
    endedAt: { type: Date },
    pausedAt: { type: Date },
    viewerIds: [{ type: Schema.Types.ObjectId, ref: 'User' }],
    viewersCount: { type: Number, default: 0 },
    isPublic: { type: Boolean, default: false },
    groupId: { type: Schema.Types.ObjectId, ref: 'Group', index: true },
    // Sharing & Lifecycle fields
    shareCode: { type: String, unique: true, sparse: true, index: true },
    shareToken: { type: String },
    expiresAt: { type: Date, required: true, default: () => new Date(Date.now() + 3 * 60 * 60 * 1000) },
    viewerCount: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true },
    lastLocation: {
        lat: Number,
        lng: Number,
        speed: Number,
        pace: Number,
        heading: Number,
        timestamp: Date,
    },
    totalDistance: { type: Number, default: 0 },
    averagePace: { type: Number, default: 0 },
    totalDuration: { type: Number, default: 0 },
}, {
    timestamps: true,
    versionKey: false,
});
LiveSessionSchema.index({ userId: 1, status: 1 });
LiveSessionSchema.index({ sessionId: 1, status: 1 });
export const LiveSession = model('LiveSession', LiveSessionSchema);
