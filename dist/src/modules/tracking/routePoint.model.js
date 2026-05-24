import { Schema, model } from 'mongoose';
const RoutePointSchema = new Schema({
    sessionId: { type: String, required: true, index: true },
    lat: { type: Number, required: true },
    lng: { type: Number, required: true },
    speed: { type: Number, default: 0 },
    pace: { type: Number, default: 0 },
    heading: { type: Number, default: 0 },
    elevation: { type: Number, default: 0 },
    timestamp: { type: Date, required: true },
}, {
    versionKey: false,
});
RoutePointSchema.index({ sessionId: 1, timestamp: 1 });
export const RoutePoint = model('RoutePoint', RoutePointSchema);
