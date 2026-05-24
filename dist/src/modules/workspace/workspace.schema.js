import { z } from 'zod';
export const CreateWorkspaceSchema = z.object({
    name: z.string().min(2, 'Name must be at least 2 characters').max(100, 'Name must be at most 100 characters'),
}).strict();
export const UpdateWorkspaceSchema = z.object({
    name: z.string().min(2, 'Name must be at least 2 characters').max(100, 'Name must be at most 100 characters').optional(),
    settings: z.object({
        allowInvites: z.boolean().optional(),
        maxMembers: z.number().min(1).max(100).optional(),
    }).optional(),
}).strict();
export const InviteMemberSchema = z.object({
    email: z.string().email('Invalid email address'),
    role: z.enum(['admin', 'member', 'viewer']),
}).strict();
export const ChangeRoleSchema = z.object({
    role: z.enum(['admin', 'member', 'viewer']),
}).strict();
