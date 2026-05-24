import { Server as SocketIOServer } from 'socket.io';
import { z } from 'zod';
import { CLIENT_EVENTS, SERVER_EVENTS, roomId } from '../utils/constants.js';
import { LiveSessionService } from '../modules/liveSessions/liveSession.service.js';
import { LiveSessionStore } from '../modules/liveSessions/liveSession.store.js';
const JoinSchema = z.object({
    sessionId: z.string().uuid(),
    userId: z.string(),
});
const WatchSchema = z.object({
    sessionId: z.string().uuid(),
});
const LocationSchema = z.object({
    sessionId: z.string().uuid(),
    lat: z.number().min(-90).max(90),
    lng: z.number().min(-180).max(180),
    speed: z.number().min(0).default(0),
    pace: z.number().min(0).default(0),
    heading: z.number().min(0).max(360).default(0),
    elevation: z.number().default(0),
    timestamp: z.number(),
});
const SessionIdSchema = z.object({ sessionId: z.string().uuid() });
function emitError(socket, message, code) {
    socket.emit(SERVER_EVENTS.ERROR, { code, message });
}
export function createSocketServer(httpServer) {
    const io = new SocketIOServer(httpServer, {
        cors: {
            origin: '*', // Adjust based on env
            credentials: true
        }
    });
    io.use((socket, next) => {
        // In a real app, verify JWT here
        // For now, we will simulate auth or expect the client to send a token in handshake.auth
        const token = socket.handshake.auth.token;
        if (!token) {
            // Allow connection but they can't do authenticated actions
            // In production, reject here or decode JWT and set socket.data.userId
        }
        // We will assume the payload includes userId or we do real JWT decoding
        next();
    });
    io.on('connection', (socket) => {
        console.log(`Socket connected: ${socket.id}`);
        socket.on(CLIENT_EVENTS.JOIN_SESSION, async (payload) => {
            try {
                const { sessionId, userId } = JoinSchema.parse(payload);
                socket.data.userId = userId; // Setting it here for simplicity
                const socketUserId = socket.data.userId;
                if (userId !== socketUserId) {
                    return emitError(socket, 'User mismatch', 'AUTH_MISMATCH');
                }
                if (!LiveSessionStore.isActive(sessionId)) {
                    return emitError(socket, 'Session not found or not active', 'SESSION_NOT_FOUND');
                }
                socket.join(roomId(sessionId));
                socket.data.sessionId = sessionId;
                socket.data.role = 'owner';
                socket.emit(SERVER_EVENTS.SESSION_STARTED, {
                    sessionId,
                    roomId: roomId(sessionId),
                    timestamp: Date.now(),
                });
                console.log(`Owner joined socket room for session: ${sessionId}`);
            }
            catch (err) {
                emitError(socket, 'Invalid payload', 'VALIDATION_ERROR');
            }
        });
        socket.on(CLIENT_EVENTS.WATCH_SESSION, async (payload) => {
            try {
                const { sessionId } = WatchSchema.parse(payload);
                const socketUserId = socket.data.userId;
                const authorized = await LiveSessionService.authorizeViewer(sessionId, socketUserId);
                if (!authorized) {
                    return emitError(socket, 'Not authorized to view this session', 'UNAUTHORIZED');
                }
                socket.join(roomId(sessionId));
                socket.data.sessionId = sessionId;
                socket.data.role = 'viewer';
                await LiveSessionService.addViewer(sessionId, socketUserId);
                const snapshot = LiveSessionStore.getSnapshot(sessionId);
                if (snapshot?.lastLocation) {
                    socket.emit(SERVER_EVENTS.VIEWER_UPDATE, {
                        ...snapshot.lastLocation,
                        totalDistance: snapshot.totalDistance,
                        sessionId,
                    });
                }
            }
            catch (err) {
                emitError(socket, 'Could not join session', 'WATCH_ERROR');
            }
        });
        socket.on(CLIENT_EVENTS.LOCATION_UPDATE, async (payload) => {
            try {
                const data = LocationSchema.parse(payload);
                if (socket.data.role !== 'owner') {
                    return emitError(socket, 'Only session owner can push location', 'FORBIDDEN');
                }
                const result = await LiveSessionStore.pushLocation(data.sessionId, {
                    lat: data.lat,
                    lng: data.lng,
                    speed: data.speed,
                    pace: data.pace,
                    heading: data.heading,
                    elevation: data.elevation,
                    timestamp: data.timestamp,
                });
                if (!result) {
                    return emitError(socket, 'Session not found in memory', 'SESSION_NOT_FOUND');
                }
                socket.to(roomId(data.sessionId)).emit(SERVER_EVENTS.VIEWER_UPDATE, {
                    sessionId: data.sessionId,
                    lat: data.lat,
                    lng: data.lng,
                    speed: data.speed,
                    pace: data.pace,
                    heading: data.heading,
                    totalDistance: result.totalDistance,
                    timestamp: data.timestamp,
                });
            }
            catch (err) {
                emitError(socket, 'Invalid location payload', 'VALIDATION_ERROR');
            }
        });
        socket.on(CLIENT_EVENTS.PAUSE_SESSION, async (payload) => {
            try {
                const { sessionId } = SessionIdSchema.parse(payload);
                if (socket.data.role !== 'owner')
                    return;
                const socketUserId = socket.data.userId;
                await LiveSessionService.pause(sessionId, socketUserId);
                io.to(roomId(sessionId)).emit(SERVER_EVENTS.SESSION_PAUSED, {
                    sessionId,
                    timestamp: Date.now(),
                });
            }
            catch (err) {
                console.error('live:pause-session error', err);
            }
        });
        socket.on(CLIENT_EVENTS.RESUME_SESSION, async (payload) => {
            try {
                const { sessionId } = SessionIdSchema.parse(payload);
                if (socket.data.role !== 'owner')
                    return;
                const socketUserId = socket.data.userId;
                await LiveSessionService.resume(sessionId, socketUserId);
                io.to(roomId(sessionId)).emit(SERVER_EVENTS.SESSION_RESUMED, {
                    sessionId,
                    timestamp: Date.now(),
                });
            }
            catch (err) {
                console.error('live:resume-session error', err);
            }
        });
        socket.on(CLIENT_EVENTS.END_SESSION, async (payload) => {
            try {
                const { sessionId } = SessionIdSchema.parse(payload);
                if (socket.data.role !== 'owner')
                    return;
                const socketUserId = socket.data.userId;
                const stats = await LiveSessionService.end(sessionId, socketUserId);
                io.to(roomId(sessionId)).emit(SERVER_EVENTS.SESSION_ENDED, {
                    sessionId,
                    stats,
                    timestamp: Date.now(),
                });
                const socketsInRoom = await io.in(roomId(sessionId)).fetchSockets();
                socketsInRoom.forEach(s => s.leave(roomId(sessionId)));
                console.log(`Session ended via socket: ${sessionId}`);
            }
            catch (err) {
                console.error('live:end-session error', err);
            }
        });
        socket.on('disconnect', (reason) => {
            console.log(`Socket disconnected: ${socket.id}, reason: ${reason}`);
        });
    });
    return io;
}
