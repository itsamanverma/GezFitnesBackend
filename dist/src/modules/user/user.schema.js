import { z } from 'zod';
export const UpdateUserSchema = z.object({
    name: z.string().min(2).max(100).optional(),
    image: z.string().url().or(z.string().length(0)).optional(), // URL or empty string
}).strict(); // strict ensures no extra properties can be passed (anti mass-assignment)
