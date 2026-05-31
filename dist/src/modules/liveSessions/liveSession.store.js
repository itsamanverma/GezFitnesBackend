import { RoutePoint } from '../tracking/routePoint.model.js';
import { ROUTE_BATCH_SIZE } from '../../utils/constants.js';
const activeSessions = new Map();
export const LiveSessionStore = {
    init(sessionId, userId, groupId) {
        activeSessions.set(sessionId, {
            sessionId,
            userId,
            groupId,
            buffer: [],
            lastLocation: null,
            totalDistance: 0,
            startedAt: Date.now(),
            pausedDuration: 0,
            pausedAt: null,
        });
        console.log(`LiveSessionStore: session ${sessionId} initialized`);
    },
    async pushLocation(sessionId, payload) {
        const state = activeSessions.get(sessionId);
        if (!state)
            return null;
        if (state.lastLocation) {
            const delta = haversineMetres(state.lastLocation.lat, state.lastLocation.lng, payload.lat, payload.lng);
            state.totalDistance += delta;
        }
        state.lastLocation = payload;
        state.buffer.push(payload);
        const shouldFlush = state.buffer.length >= ROUTE_BATCH_SIZE;
        if (shouldFlush)
            await LiveSessionStore.flushBuffer(sessionId);
        return {
            lastLocation: payload,
            totalDistance: state.totalDistance,
            shouldFlush,
        };
    },
    async flushBuffer(sessionId) {
        const state = activeSessions.get(sessionId);
        if (!state || state.buffer.length === 0)
            return;
        const points = state.buffer.splice(0, state.buffer.length);
        try {
            await RoutePoint.insertMany(points.map(p => ({
                sessionId,
                lat: p.lat,
                lng: p.lng,
                speed: p.speed,
                pace: p.pace,
                heading: p.heading,
                elevation: p.elevation,
                timestamp: new Date(p.timestamp),
            })), { ordered: false });
        }
        catch (err) {
            console.error('Failed to flush route batch', err);
            state.buffer.unshift(...points);
        }
    },
    pause(sessionId) {
        const state = activeSessions.get(sessionId);
        if (state && !state.pausedAt) {
            state.pausedAt = Date.now();
        }
    },
    resume(sessionId) {
        const state = activeSessions.get(sessionId);
        if (state && state.pausedAt) {
            state.pausedDuration += Date.now() - state.pausedAt;
            state.pausedAt = null;
        }
    },
    getSnapshot(sessionId) {
        const state = activeSessions.get(sessionId);
        if (!state)
            return null;
        const { buffer: _, ...snapshot } = state;
        return snapshot;
    },
    async end(sessionId) {
        const state = activeSessions.get(sessionId);
        if (!state)
            return { totalDistance: 0, totalDuration: 0 };
        await LiveSessionStore.flushBuffer(sessionId);
        const totalDuration = Math.floor((Date.now() - state.startedAt - state.pausedDuration) / 1000);
        activeSessions.delete(sessionId);
        return { totalDistance: state.totalDistance, totalDuration };
    },
    isActive(sessionId) {
        return activeSessions.has(sessionId);
    },
    size() {
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
            }
            catch (err) {
                console.error(`Failed to auto-expire session ${sessionId}:`, err);
                activeSessions.delete(sessionId);
            }
        }
    }
}, 60 * 1000); // Check every minute
function haversineMetres(lat1, lng1, lat2, lng2) {
    const R = 6371000;
    const φ1 = (lat1 * Math.PI) / 180;
    const φ2 = (lat2 * Math.PI) / 180;
    const Δφ = ((lat2 - lat1) * Math.PI) / 180;
    const Δλ = ((lng2 - lng1) * Math.PI) / 180;
    const a = Math.sin(Δφ / 2) ** 2 + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
