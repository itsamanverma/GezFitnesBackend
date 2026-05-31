import { Schema, model } from 'mongoose';
const DeviceSchema = new Schema({
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
export const Device = model('Device', DeviceSchema);
