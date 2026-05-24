export const ROUTE_BATCH_SIZE = 10;

export const SESSION_STATUS = {
  ACTIVE: 'ACTIVE',
  PAUSED: 'PAUSED',
  FINISHED: 'FINISHED',
} as const;
export type SessionStatus = typeof SESSION_STATUS[keyof typeof SESSION_STATUS];

export const ACTIVITY_TYPE = {
  RUN: 'RUN',
  WALK: 'WALK',
  CYCLE: 'CYCLE',
  HIKE: 'HIKE',
} as const;
export type ActivityType = typeof ACTIVITY_TYPE[keyof typeof ACTIVITY_TYPE];

export const CLIENT_EVENTS = {
  JOIN_SESSION: 'live:join-session',
  WATCH_SESSION: 'live:watch-session',
  LOCATION_UPDATE: 'live:location-update',
  PAUSE_SESSION: 'live:pause-session',
  RESUME_SESSION: 'live:resume-session',
  END_SESSION: 'live:end-session',
};

export const SERVER_EVENTS = {
  ERROR: 'error',
  SESSION_STARTED: 'session:started',
  VIEWER_UPDATE: 'viewer:update',
  SESSION_PAUSED: 'session:paused',
  SESSION_RESUMED: 'session:resumed',
  SESSION_ENDED: 'session:ended',
};

export const roomId = (sessionId: string) => `session:${sessionId}`;
