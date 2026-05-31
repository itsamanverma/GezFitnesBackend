import { Schema, model } from 'mongoose';
const HealthSyncSchema = new Schema({
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
export const HealthSync = model('HealthSync', HealthSyncSchema);
