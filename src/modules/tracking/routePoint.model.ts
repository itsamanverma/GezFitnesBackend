import { Schema, model, Document } from 'mongoose';

export interface IRoutePoint extends Document {
  sessionId: string;
  lat:       number;
  lng:       number;
  speed:     number;      // m/s
  pace:      number;      // min/km
  heading:   number;      // degrees 0–360
  elevation: number;      // metres
  timestamp: Date;
}

const RoutePointSchema = new Schema<IRoutePoint>({
  sessionId: { type: String, required: true, index: true },
  lat:       { type: Number, required: true },
  lng:       { type: Number, required: true },
  speed:     { type: Number, default: 0 },
  pace:      { type: Number, default: 0 },
  heading:   { type: Number, default: 0 },
  elevation: { type: Number, default: 0 },
  timestamp: { type: Date,   required: true },
}, {
  versionKey: false,
});

RoutePointSchema.index({ sessionId: 1, timestamp: 1 });

export const RoutePoint = model<IRoutePoint>('RoutePoint', RoutePointSchema);
