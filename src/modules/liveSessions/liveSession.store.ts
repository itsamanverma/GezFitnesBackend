import { RoutePoint } from '../tracking/routePoint.model.js';
import { ROUTE_BATCH_SIZE } from '../../utils/constants.js';

interface LocationPayload {
  lat:       number;
  lng:       number;
  speed:     number;
  pace:      number;
  heading:   number;
  elevation: number;
  timestamp: number; // unix ms from client
}

interface LiveState {
  sessionId:    string;
  userId:       string;
  groupId?:     string;
  buffer:       LocationPayload[];
  lastLocation: LocationPayload | null;
  totalDistance: number;
  startedAt:    number;
  pausedDuration: number;
  pausedAt:     number | null;
}

const activeSessions = new Map<string, LiveState>();

export const LiveSessionStore = {
  init(sessionId: string, userId: string, groupId?: string): void {
    activeSessions.set(sessionId, {
      sessionId,
      userId,
      groupId,
      buffer:         [],
      lastLocation:   null,
      totalDistance:  0,
      startedAt:      Date.now(),
      pausedDuration: 0,
      pausedAt:       null,
    });
    console.log(`LiveSessionStore: session ${sessionId} initialized`);
  },

  async pushLocation(sessionId: string, payload: LocationPayload): Promise<{
    lastLocation: LocationPayload;
    totalDistance: number;
    shouldFlush: boolean;
  } | null> {
    const state = activeSessions.get(sessionId);
    if (!state) return null;

    if (state.lastLocation) {
      const delta = haversineMetres(
        state.lastLocation.lat, state.lastLocation.lng,
        payload.lat, payload.lng,
      );
      state.totalDistance += delta;
    }

    state.lastLocation = payload;
    state.buffer.push(payload);

    const shouldFlush = state.buffer.length >= ROUTE_BATCH_SIZE;
    if (shouldFlush) await LiveSessionStore.flushBuffer(sessionId);

    return {
      lastLocation:  payload,
      totalDistance: state.totalDistance,
      shouldFlush,
    };
  },

  async flushBuffer(sessionId: string): Promise<void> {
    const state = activeSessions.get(sessionId);
    if (!state || state.buffer.length === 0) return;

    const points = state.buffer.splice(0, state.buffer.length);

    try {
      await RoutePoint.insertMany(
        points.map(p => ({
          sessionId,
          lat:       p.lat,
          lng:       p.lng,
          speed:     p.speed,
          pace:      p.pace,
          heading:   p.heading,
          elevation: p.elevation,
          timestamp: new Date(p.timestamp),
        })),
        { ordered: false },
      );
    } catch (err) {
      console.error('Failed to flush route batch', err);
      state.buffer.unshift(...points);
    }
  },

  pause(sessionId: string): void {
    const state = activeSessions.get(sessionId);
    if (state && !state.pausedAt) {
      state.pausedAt = Date.now();
    }
  },

  resume(sessionId: string): void {
    const state = activeSessions.get(sessionId);
    if (state && state.pausedAt) {
      state.pausedDuration += Date.now() - state.pausedAt;
      state.pausedAt = null;
    }
  },

  getSnapshot(sessionId: string): Omit<LiveState, 'buffer'> | null {
    const state = activeSessions.get(sessionId);
    if (!state) return null;
    const { buffer: _, ...snapshot } = state;
    return snapshot;
  },

  async end(sessionId: string): Promise<{
    totalDistance: number;
    totalDuration: number;
  }> {
    const state = activeSessions.get(sessionId);
    if (!state) return { totalDistance: 0, totalDuration: 0 };

    await LiveSessionStore.flushBuffer(sessionId);

    const totalDuration = Math.floor(
      (Date.now() - state.startedAt - state.pausedDuration) / 1000
    );

    activeSessions.delete(sessionId);

    return { totalDistance: state.totalDistance, totalDuration };
  },

  isActive(sessionId: string): boolean {
    return activeSessions.has(sessionId);
  },

  size(): number {
    return activeSessions.size;
  },
};

// Auto-cleanup interval to end active sessions older than 3 hours
setInterval(async () => {
  const now = Date.now();
  for (const [sessionId, state] of activeSessions.entries()) {
    if (now - state.startedAt > 3 * 60 * 60 * 1000) {
      console.log(`Auto-expiring session ${sessionId} due to 3-hour limit`);
      try {
        const { LiveSessionService } = await import('./liveSession.service.js');
        await LiveSessionService.end(sessionId, state.userId);
      } catch (err) {
        console.error(`Failed to auto-expire session ${sessionId}:`, err);
        activeSessions.delete(sessionId);
      }
    }
  }
}, 60 * 1000); // Check every minute

function haversineMetres(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000;
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lng2 - lng1) * Math.PI) / 180;
  const a = Math.sin(Δφ / 2) ** 2 + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
