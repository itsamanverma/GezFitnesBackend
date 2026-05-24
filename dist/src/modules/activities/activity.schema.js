import { z } from 'zod';
export const createActivitySchema = z.object({
    body: z.object({
        activityType: z.enum(['run', 'ride', 'walk', 'swim', 'workout']),
        distanceMeters: z.number().nonnegative(),
        durationSeconds: z.number().positive(),
        avgPace: z.number().nonnegative(),
        calories: z.number().nonnegative().optional().default(0),
        startedAt: z.string().datetime(),
        endedAt: z.string().datetime(),
        clientActivityId: z.string().uuid().optional(),
        routeCoordinates: z.array(z.tuple([z.number(), z.number()])).optional().default([]),
        deviceMetadata: z.object({
            deviceId: z.string(),
            platform: z.string(),
            appVersion: z.string()
        }).optional()
    })
});
