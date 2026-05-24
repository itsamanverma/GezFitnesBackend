import { Schema, model, Document, Types } from 'mongoose';
import { SESSION_STATUS, ACTIVITY_TYPE, SessionStatus, ActivityType } from '../../utils/constants.js';

export interface ILiveSession extends Document {
  sessionId:    string;
  userId:       Types.ObjectId;
  status:       SessionStatus;
  activityType: ActivityType;
  startedAt:    Date;
  endedAt?:     Date;
  pausedAt?:    Date;
  viewerIds:    Types.ObjectId[];
  viewersCount: number;
  isPublic:     boolean;
  lastLocation?: {
    lat:       number;
    lng:       number;
    speed:     number;
    pace:      number;
    heading:   number;
    timestamp: Date;
  };
  totalDistance:  number;
  averagePace:    number;
  totalDuration:  number;
}

const LiveSessionSchema = new Schema<ILiveSession>({
  sessionId:    { type: String, required: true, unique: true, index: true },
  userId:       { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  status:       { type: String, enum: Object.values(SESSION_STATUS), default: SESSION_STATUS.ACTIVE },
  activityType: { type: String, enum: Object.values(ACTIVITY_TYPE), required: true },
  startedAt:    { type: Date, default: Date.now },
  endedAt:      { type: Date },
  pausedAt:     { type: Date },
  viewerIds:    [{ type: Schema.Types.ObjectId, ref: 'User' }],
  viewersCount: { type: Number, default: 0 },
  isPublic:     { type: Boolean, default: false },

  lastLocation: {
    lat:       Number,
    lng:       Number,
    speed:     Number,
    pace:      Number,
    heading:   Number,
    timestamp: Date,
  },

  totalDistance: { type: Number, default: 0 },
  averagePace:   { type: Number, default: 0 },
  totalDuration: { type: Number, default: 0 },
}, {
  timestamps: true,
  versionKey: false,
});

LiveSessionSchema.index({ userId: 1, status: 1 });
LiveSessionSchema.index({ sessionId: 1, status: 1 });

export const LiveSession = model<ILiveSession>('LiveSession', LiveSessionSchema);
