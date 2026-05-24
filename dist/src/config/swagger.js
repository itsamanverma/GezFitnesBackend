import { env } from './env.js';
export const swaggerDocument = {
    openapi: '3.0.0',
    info: {
        title: 'Strava Backend Starter API',
        version: '1.0.0',
        description: 'API documentation for the Express 5 modular monolith starter. Configured with Better Auth, Redis caching, and BullMQ background workers.',
    },
    servers: [
        {
            url: 'http://localhost:3000',
            description: 'Localhost Fallback',
        },
        {
            url: env.APP_URL,
            description: 'Active Development Server (Local/Pinggy Tunnel)',
        },
    ],
    components: {
        securitySchemes: {
            cookieAuth: {
                type: 'apiKey',
                in: 'cookie',
                name: 'better-auth.session_token',
                description: 'Session cookie set automatically by Better Auth after sign-in.',
            },
            bearerAuth: {
                type: 'http',
                scheme: 'bearer',
                description: 'Standard session token passed in the Authorization header as "Bearer <token>".',
            },
            apiKeyAuth: {
                type: 'apiKey',
                in: 'header',
                name: 'x-api-key',
                description: 'Optional API key authentication header.',
            },
        },
        schemas: {
            User: {
                type: 'object',
                properties: {
                    _id: { type: 'string', example: 'user-id-uuid-string' },
                    name: { type: 'string', example: 'Jane Doe' },
                    email: { type: 'string', example: 'jane@example.com' },
                    emailVerified: { type: 'boolean', example: true },
                    image: { type: 'string', example: 'https://lh3.googleusercontent.com/a/avatar' },
                    createdAt: { type: 'string', format: 'date-time' },
                    updatedAt: { type: 'string', format: 'date-time' },
                },
            },
            Workspace: {
                type: 'object',
                properties: {
                    _id: { type: 'string', example: '664cc39ebc441b8045610db0' },
                    name: { type: 'string', example: 'Acme Corp' },
                    slug: { type: 'string', example: 'acme-corp' },
                    ownerId: { type: 'string', example: 'user-id-uuid-string' },
                    plan: { type: 'string', enum: ['free', 'pro', 'enterprise'], example: 'free' },
                    settings: {
                        type: 'object',
                        properties: {
                            allowInvites: { type: 'boolean', example: true },
                            maxMembers: { type: 'number', example: 5 },
                        },
                    },
                    createdAt: { type: 'string', format: 'date-time' },
                    updatedAt: { type: 'string', format: 'date-time' },
                },
            },
            WorkspaceMember: {
                type: 'object',
                properties: {
                    _id: { type: 'string', example: '664cc39ebc441b8045610db1' },
                    workspaceId: { type: 'string', example: '664cc39ebc441b8045610db0' },
                    userId: { type: 'string', example: 'user-id-uuid-string' },
                    role: { type: 'string', enum: ['owner', 'admin', 'member', 'viewer'], example: 'owner' },
                    invitedBy: { type: 'string', example: 'user-id-uuid-string' },
                    joinedAt: { type: 'string', format: 'date-time' },
                },
            },
            Activity: {
                type: 'object',
                properties: {
                    _id: { type: 'string', example: 'activity-uuid-string' },
                    userId: { type: 'string', example: 'user-id-uuid-string' },
                    activityType: { type: 'string', example: 'run' },
                    distanceMeters: { type: 'number', example: 5000 },
                    durationSeconds: { type: 'number', example: 1800 },
                    avgPace: { type: 'number', example: 6.0 },
                    calories: { type: 'number', example: 450 },
                    startedAt: { type: 'string', format: 'date-time' },
                    endedAt: { type: 'string', format: 'date-time' },
                    clientActivityId: { type: 'string', example: 'uuid-from-client' },
                    createdAt: { type: 'string', format: 'date-time' },
                }
            },
            LiveSession: {
                type: 'object',
                properties: {
                    sessionId: { type: 'string', example: 'session-uuid' },
                    userId: { type: 'string', example: 'user-id-uuid-string' },
                    status: { type: 'string', example: 'ACTIVE' },
                    activityType: { type: 'string', example: 'RUN' },
                    startedAt: { type: 'string', format: 'date-time' },
                }
            }
        },
    },
    // Default security applied globally to paths unless overridden
    security: [
        {
            cookieAuth: [],
        },
        {
            bearerAuth: [],
        },
        {
            apiKeyAuth: [],
        },
    ],
    paths: {
        '/api/auth/v1/signup': {
            post: {
                tags: ['Auth'],
                summary: 'Register a new user',
                description: 'Creates a new user account. Returns tokens for mobile app.',
                security: [], // Public route
                requestBody: {
                    required: true,
                    content: {
                        'application/json': {
                            schema: {
                                type: 'object',
                                required: ['name', 'email', 'password'],
                                properties: {
                                    name: { type: 'string', example: 'John Doe' },
                                    email: { type: 'string', example: 'john@example.com' },
                                    password: { type: 'string', example: 'password123' },
                                    deviceId: { type: 'string', example: 'device-123' },
                                    platform: { type: 'string', example: 'ios' },
                                    appVersion: { type: 'string', example: '1.0.0' },
                                },
                            },
                        },
                    },
                },
                responses: {
                    201: {
                        description: 'User created successfully',
                        content: {
                            'application/json': {
                                schema: {
                                    type: 'object',
                                    properties: {
                                        success: { type: 'boolean', example: true },
                                        data: {
                                            type: 'object',
                                            properties: {
                                                accessToken: { type: 'string', example: 'access-token-string' },
                                                refreshToken: { type: 'string', example: 'refresh-token-string' },
                                                expiresIn: { type: 'number', example: 900 },
                                                user: { $ref: '#/components/schemas/User' },
                                            }
                                        }
                                    },
                                },
                            },
                        },
                    },
                    400: { description: 'Bad Request' },
                },
            },
        },
        '/api/auth/v1/login': {
            post: {
                tags: ['Auth'],
                summary: 'Sign in with Email/Password',
                description: 'Authenticates a user and returns mobile app tokens.',
                security: [], // Public route
                requestBody: {
                    required: true,
                    content: {
                        'application/json': {
                            schema: {
                                type: 'object',
                                required: ['email', 'password'],
                                properties: {
                                    email: { type: 'string', example: 'john@example.com' },
                                    password: { type: 'string', example: 'password123' },
                                    deviceId: { type: 'string', example: 'device-123' },
                                    platform: { type: 'string', example: 'ios' },
                                    appVersion: { type: 'string', example: '1.0.0' },
                                },
                            },
                        },
                    },
                },
                responses: {
                    200: {
                        description: 'User signed in successfully',
                        content: {
                            'application/json': {
                                schema: {
                                    type: 'object',
                                    properties: {
                                        success: { type: 'boolean', example: true },
                                        data: {
                                            type: 'object',
                                            properties: {
                                                accessToken: { type: 'string', example: 'access-token-string' },
                                                refreshToken: { type: 'string', example: 'refresh-token-string' },
                                                expiresIn: { type: 'number', example: 900 },
                                                user: { $ref: '#/components/schemas/User' },
                                            }
                                        }
                                    },
                                },
                            },
                        },
                    },
                    401: { description: 'Unauthorized - Invalid credentials' },
                },
            },
        },
        '/api/auth/v1/refresh': {
            post: {
                tags: ['Auth'],
                summary: 'Refresh access token',
                description: 'Issues a new access and refresh token pair.',
                security: [],
                requestBody: {
                    required: true,
                    content: {
                        'application/json': {
                            schema: {
                                type: 'object',
                                required: ['refreshToken'],
                                properties: {
                                    refreshToken: { type: 'string', example: 'refresh-token-string' },
                                },
                            },
                        },
                    },
                },
                responses: {
                    200: {
                        description: 'Token refreshed',
                        content: {
                            'application/json': {
                                schema: {
                                    type: 'object',
                                    properties: {
                                        success: { type: 'boolean', example: true },
                                        data: {
                                            type: 'object',
                                            properties: {
                                                accessToken: { type: 'string', example: 'new-access-token' },
                                                refreshToken: { type: 'string', example: 'new-refresh-token' },
                                                expiresIn: { type: 'number', example: 900 },
                                            }
                                        }
                                    },
                                },
                            },
                        },
                    },
                    401: { description: 'Unauthorized - Invalid refresh token' },
                },
            },
        },
        '/api/auth/v1/logout': {
            post: {
                tags: ['Auth'],
                summary: 'Logout current session',
                description: 'Invalidates the current session and refresh token.',
                security: [{ bearerAuth: [] }],
                responses: {
                    200: { description: 'Logged out successfully' },
                    401: { description: 'Unauthorized' },
                },
            },
        },
        '/api/auth/v1/logout-all': {
            post: {
                tags: ['Auth'],
                summary: 'Logout all sessions',
                description: 'Invalidates all active sessions for the user.',
                security: [{ bearerAuth: [] }],
                responses: {
                    200: { description: 'All sessions logged out' },
                    401: { description: 'Unauthorized' },
                },
            },
        },
        '/api/auth/v1/me': {
            get: {
                tags: ['Auth'],
                summary: 'Get current user info',
                description: 'Returns the current authenticated user details.',
                security: [{ bearerAuth: [] }],
                responses: {
                    200: {
                        description: 'User details',
                        content: {
                            'application/json': {
                                schema: {
                                    type: 'object',
                                    properties: {
                                        success: { type: 'boolean', example: true },
                                        data: {
                                            type: 'object',
                                            properties: {
                                                user: { $ref: '#/components/schemas/User' },
                                            }
                                        }
                                    },
                                },
                            },
                        },
                    },
                    401: { description: 'Unauthorized' },
                },
            },
        },
        '/api/auth/v1/verify-email': {
            post: {
                tags: ['Auth'],
                summary: 'Verify user email',
                description: 'Verifies email using a token.',
                security: [],
                requestBody: {
                    required: true,
                    content: {
                        'application/json': {
                            schema: {
                                type: 'object',
                                required: ['token'],
                                properties: {
                                    token: { type: 'string', example: 'verification-token' },
                                },
                            },
                        },
                    },
                },
                responses: {
                    200: { description: 'Email verified' },
                    400: { description: 'Verification failed' },
                },
            },
        },
        '/api/auth/v1/resend-verification': {
            post: {
                tags: ['Auth'],
                summary: 'Resend verification email',
                description: 'Sends a new verification email.',
                security: [],
                requestBody: {
                    required: true,
                    content: {
                        'application/json': {
                            schema: {
                                type: 'object',
                                required: ['email'],
                                properties: {
                                    email: { type: 'string', example: 'user@example.com' },
                                },
                            },
                        },
                    },
                },
                responses: {
                    200: { description: 'Verification email sent' },
                    400: { description: 'Failed to send' },
                },
            },
        },
        '/api/auth/v1/forgot-password': {
            post: {
                tags: ['Auth'],
                summary: 'Request password reset',
                description: 'Sends a password reset link to email.',
                security: [],
                requestBody: {
                    required: true,
                    content: {
                        'application/json': {
                            schema: {
                                type: 'object',
                                required: ['email'],
                                properties: {
                                    email: { type: 'string', example: 'user@example.com' },
                                },
                            },
                        },
                    },
                },
                responses: {
                    200: { description: 'Password reset link sent' },
                    400: { description: 'Request failed' },
                },
            },
        },
        '/api/auth/v1/reset-password': {
            post: {
                tags: ['Auth'],
                summary: 'Reset password',
                description: 'Resets password using a token.',
                security: [],
                requestBody: {
                    required: true,
                    content: {
                        'application/json': {
                            schema: {
                                type: 'object',
                                required: ['token', 'newPassword'],
                                properties: {
                                    token: { type: 'string', example: 'reset-token' },
                                    newPassword: { type: 'string', example: 'new-password123' },
                                },
                            },
                        },
                    },
                },
                responses: {
                    200: { description: 'Password reset successful' },
                    400: { description: 'Reset failed' },
                },
            },
        },
        '/api/auth/sign-in/social': {
            post: {
                tags: ['Auth'],
                summary: 'Sign in with Social Provider (Google)',
                description: 'Initiates OAuth login with Google (or others). Returns a URL to redirect the user to.',
                security: [], // Public route
                requestBody: {
                    required: true,
                    content: {
                        'application/json': {
                            schema: {
                                type: 'object',
                                required: ['provider'],
                                properties: {
                                    provider: { type: 'string', example: 'google' },
                                    idToken: {
                                        type: 'object',
                                        properties: {
                                            token: { type: 'string', example: 'eyJhbG...' }
                                        }
                                    }
                                },
                            },
                        },
                    },
                },
                responses: {
                    200: {
                        description: 'Returns the authorization URL',
                        content: {
                            'application/json': {
                                schema: {
                                    type: 'object',
                                    properties: {
                                        url: { type: 'string', example: 'https://accounts.google.com/o/oauth2/v2/auth?...' },
                                    },
                                },
                            },
                        },
                    },
                },
            },
        },
        '/health': {
            get: {
                tags: ['System'],
                summary: 'Liveness check',
                description: 'Verifies the API server is alive.',
                security: [], // Public
                responses: {
                    200: {
                        description: 'Liveness check successful',
                        content: {
                            'application/json': {
                                schema: {
                                    type: 'object',
                                    properties: {
                                        status: { type: 'string', example: 'ok' },
                                        timestamp: { type: 'string', example: '2026-05-22T17:40:00Z' },
                                    },
                                },
                            },
                        },
                    },
                },
            },
        },
        '/health/ready': {
            get: {
                tags: ['System'],
                summary: 'Readiness check',
                description: 'Checks MongoDB and Redis connections in parallel.',
                security: [], // Public
                responses: {
                    200: {
                        description: 'Services are ready',
                        content: {
                            'application/json': {
                                schema: {
                                    type: 'object',
                                    properties: {
                                        status: { type: 'string', example: 'ready' },
                                        db: { type: 'string', example: 'ok' },
                                        redis: { type: 'string', example: 'ok' },
                                    },
                                },
                            },
                        },
                    },
                    503: {
                        description: 'Services are degraded or down',
                        content: {
                            'application/json': {
                                schema: {
                                    type: 'object',
                                    properties: {
                                        status: { type: 'string', example: 'degraded' },
                                        db: { type: 'string', example: 'error' },
                                        redis: { type: 'string', example: 'ok' },
                                    },
                                },
                            },
                        },
                    },
                },
            },
        },
        '/v1/users/me': {
            get: {
                tags: ['Users'],
                summary: 'Get authenticated user profile',
                description: 'Retrieves current user details. Checked via Upstash Redis session cache.',
                responses: {
                    200: {
                        description: 'Successfully fetched user info',
                        content: {
                            'application/json': {
                                schema: {
                                    type: 'object',
                                    properties: {
                                        success: { type: 'boolean', example: true },
                                        data: { $ref: '#/components/schemas/User' },
                                    },
                                },
                            },
                        },
                    },
                    401: { description: 'Unauthorized' },
                },
            },
            patch: {
                tags: ['Users'],
                summary: 'Update user profile',
                description: 'Updates profile fields and invalidates Redis user cache.',
                requestBody: {
                    required: true,
                    content: {
                        'application/json': {
                            schema: {
                                type: 'object',
                                properties: {
                                    name: { type: 'string', example: 'Jane Smith' },
                                    image: { type: 'string', format: 'url', example: 'https://example.com/avatar.png' },
                                },
                            },
                        },
                    },
                },
                responses: {
                    200: {
                        description: 'User details updated',
                        content: {
                            'application/json': {
                                schema: {
                                    type: 'object',
                                    properties: {
                                        success: { type: 'boolean', example: true },
                                        data: { $ref: '#/components/schemas/User' },
                                        message: { type: 'string', example: 'Profile updated successfully' },
                                    },
                                },
                            },
                        },
                    },
                    400: { description: 'Validation failed' },
                    401: { description: 'Unauthorized' },
                },
            },
            delete: {
                tags: ['Users'],
                summary: 'Delete user account (GDPR)',
                description: 'Performs permanent account cleanup, invalidates sessions, and clears cookie.',
                responses: {
                    204: { description: 'Successfully deleted account' },
                    401: { description: 'Unauthorized' },
                },
            },
        },
        '/v1/workspaces': {
            post: {
                tags: ['Workspaces'],
                summary: 'Create a new workspace',
                description: 'Generates a unique slug and adds the creator as Owner.',
                requestBody: {
                    required: true,
                    content: {
                        'application/json': {
                            schema: {
                                type: 'object',
                                required: ['name'],
                                properties: {
                                    name: { type: 'string', example: 'Acme Corp' },
                                },
                            },
                        },
                    },
                },
                responses: {
                    201: {
                        description: 'Workspace created',
                        content: {
                            'application/json': {
                                schema: {
                                    type: 'object',
                                    properties: {
                                        success: { type: 'boolean', example: true },
                                        data: { $ref: '#/components/schemas/Workspace' },
                                    },
                                },
                            },
                        },
                    },
                    401: { description: 'Unauthorized' },
                },
            },
            get: {
                tags: ['Workspaces'],
                summary: 'List user workspaces',
                description: 'Retrieves all workspaces where the current user is a member.',
                responses: {
                    200: {
                        description: 'Workspaces retrieved',
                        content: {
                            'application/json': {
                                schema: {
                                    type: 'object',
                                    properties: {
                                        success: { type: 'boolean', example: true },
                                        data: {
                                            type: 'array',
                                            items: { $ref: '#/components/schemas/Workspace' },
                                        },
                                    },
                                },
                            },
                        },
                    },
                    401: { description: 'Unauthorized' },
                },
            },
        },
        '/v1/workspaces/{id}': {
            get: {
                tags: ['Workspaces'],
                summary: 'Get workspace by ID',
                description: 'Retrieves specific workspace details (cached in Redis for 10 minutes).',
                parameters: [
                    { name: 'id', in: 'path', required: true, schema: { type: 'string' } },
                ],
                responses: {
                    200: {
                        description: 'Workspace details retrieved',
                        content: {
                            'application/json': {
                                schema: {
                                    type: 'object',
                                    properties: {
                                        success: { type: 'boolean', example: true },
                                        data: { $ref: '#/components/schemas/Workspace' },
                                    },
                                },
                            },
                        },
                    },
                    401: { description: 'Unauthorized' },
                    403: { description: 'Forbidden / Non-member access' },
                    404: { description: 'Workspace not found' },
                },
            },
            patch: {
                tags: ['Workspaces'],
                summary: 'Update workspace settings',
                description: 'Modifies workspace options (requires Owner or Admin role).',
                parameters: [
                    { name: 'id', in: 'path', required: true, schema: { type: 'string' } },
                ],
                requestBody: {
                    required: true,
                    content: {
                        'application/json': {
                            schema: {
                                type: 'object',
                                properties: {
                                    name: { type: 'string', example: 'Acme Holdings' },
                                    settings: {
                                        type: 'object',
                                        properties: {
                                            allowInvites: { type: 'boolean', example: false },
                                            maxMembers: { type: 'number', example: 10 },
                                        },
                                    },
                                },
                            },
                        },
                    },
                },
                responses: {
                    200: {
                        description: 'Workspace settings updated',
                        content: {
                            'application/json': {
                                schema: {
                                    type: 'object',
                                    properties: {
                                        success: { type: 'boolean', example: true },
                                        data: { $ref: '#/components/schemas/Workspace' },
                                    },
                                },
                            },
                        },
                    },
                    401: { description: 'Unauthorized' },
                    403: { description: 'Forbidden / Insufficient permissions' },
                },
            },
            delete: {
                tags: ['Workspaces'],
                summary: 'Delete workspace',
                description: 'Deletes a workspace and cascaded membership records (requires Owner role).',
                parameters: [
                    { name: 'id', in: 'path', required: true, schema: { type: 'string' } },
                ],
                responses: {
                    200: { description: 'Workspace deleted successfully' },
                    401: { description: 'Unauthorized' },
                    403: { description: 'Forbidden / Insufficient permissions' },
                },
            },
        },
        '/v1/workspaces/{id}/invite': {
            post: {
                tags: ['Workspace Members'],
                summary: 'Invite member',
                description: 'Generates a 48-hour invite token and queues verification email (requires Admin or Owner role).',
                parameters: [
                    { name: 'id', in: 'path', required: true, schema: { type: 'string' } },
                ],
                requestBody: {
                    required: true,
                    content: {
                        'application/json': {
                            schema: {
                                type: 'object',
                                required: ['email', 'role'],
                                properties: {
                                    email: { type: 'string', format: 'email', example: 'new-employee@example.com' },
                                    role: { type: 'string', enum: ['admin', 'member', 'viewer'], example: 'member' },
                                },
                            },
                        },
                    },
                },
                responses: {
                    200: { description: 'Invitation queued successfully' },
                    401: { description: 'Unauthorized' },
                    403: { description: 'Forbidden' },
                },
            },
        },
        '/v1/workspaces/invite/{token}': {
            get: {
                tags: ['Workspace Members'],
                summary: 'Get invite details',
                description: 'Public endpoint to view workspace metadata and invitation role before joining.',
                security: [], // Public route
                parameters: [
                    { name: 'token', in: 'path', required: true, schema: { type: 'string' } },
                ],
                responses: {
                    200: {
                        description: 'Invite metadata preview',
                        content: {
                            'application/json': {
                                schema: {
                                    type: 'object',
                                    properties: {
                                        success: { type: 'boolean', example: true },
                                        data: {
                                            type: 'object',
                                            properties: {
                                                invite: {
                                                    type: 'object',
                                                    properties: {
                                                        email: { type: 'string', example: 'new-employee@example.com' },
                                                        role: { type: 'string', example: 'member' },
                                                    },
                                                },
                                                workspace: {
                                                    type: 'object',
                                                    properties: {
                                                        name: { type: 'string', example: 'Acme Corp' },
                                                        slug: { type: 'string', example: 'acme-corp' },
                                                    },
                                                },
                                            },
                                        },
                                    },
                                },
                            },
                        },
                    },
                    404: { description: 'Invitation not found' },
                    410: { description: 'Invitation expired' },
                },
            },
        },
        '/v1/workspaces/invite/{token}/accept': {
            post: {
                tags: ['Workspace Members'],
                summary: 'Accept workspace invite',
                description: 'Enrolls the current authenticated user as a member of the workspace.',
                parameters: [
                    { name: 'token', in: 'path', required: true, schema: { type: 'string' } },
                ],
                responses: {
                    200: { description: 'Joined workspace successfully' },
                    401: { description: 'Unauthorized' },
                    403: { description: 'Email address mismatch' },
                    404: { description: 'Invitation not found' },
                },
            },
        },
        '/v1/workspaces/{id}/members': {
            get: {
                tags: ['Workspace Members'],
                summary: 'List workspace members',
                description: 'Lists all users joined as members of the workspace.',
                parameters: [
                    { name: 'id', in: 'path', required: true, schema: { type: 'string' } },
                ],
                responses: {
                    200: {
                        description: 'Members list retrieved',
                        content: {
                            'application/json': {
                                schema: {
                                    type: 'object',
                                    properties: {
                                        success: { type: 'boolean', example: true },
                                        data: {
                                            type: 'array',
                                            items: { $ref: '#/components/schemas/WorkspaceMember' },
                                        },
                                    },
                                },
                            },
                        },
                    },
                    401: { description: 'Unauthorized' },
                    403: { description: 'Forbidden / Non-member access' },
                },
            },
        },
        '/v1/workspaces/{id}/members/{uid}': {
            patch: {
                tags: ['Workspace Members'],
                summary: 'Change member role',
                description: 'Updates workspace permission tier for a member (requires Admin or Owner role).',
                parameters: [
                    { name: 'id', in: 'path', required: true, schema: { type: 'string' } },
                    { name: 'uid', in: 'path', required: true, schema: { type: 'string' } },
                ],
                requestBody: {
                    required: true,
                    content: {
                        'application/json': {
                            schema: {
                                type: 'object',
                                required: ['role'],
                                properties: {
                                    role: { type: 'string', enum: ['admin', 'member', 'viewer'], example: 'admin' },
                                },
                            },
                        },
                    },
                },
                responses: {
                    200: { description: 'Member role changed successfully' },
                    400: { description: 'Invalid role update / Self demotion block' },
                    401: { description: 'Unauthorized' },
                    403: { description: 'Forbidden / Insufficient permission' },
                },
            },
            delete: {
                tags: ['Workspace Members'],
                summary: 'Remove workspace member',
                description: 'Evicts a member from the workspace (requires Admin or Owner role).',
                parameters: [
                    { name: 'id', in: 'path', required: true, schema: { type: 'string' } },
                    { name: 'uid', in: 'path', required: true, schema: { type: 'string' } },
                ],
                responses: {
                    200: { description: 'Member removed successfully' },
                    400: { description: 'Invalid eviction / Cannot remove owner' },
                    401: { description: 'Unauthorized' },
                    403: { description: 'Forbidden' },
                },
            },
        },
        '/v1/activities': {
            post: {
                tags: ['Activities'],
                summary: 'Create activity',
                description: 'Upload a completed workout with optional clientActivityId for idempotency.',
                requestBody: {
                    required: true,
                    content: {
                        'application/json': {
                            schema: {
                                type: 'object',
                                required: ['activityType', 'distanceMeters', 'durationSeconds', 'avgPace', 'startedAt', 'endedAt'],
                                properties: {
                                    activityType: { type: 'string', example: 'run' },
                                    distanceMeters: { type: 'number', example: 5000 },
                                    durationSeconds: { type: 'number', example: 1500 },
                                    avgPace: { type: 'number', example: 5.0 },
                                    calories: { type: 'number', example: 300 },
                                    startedAt: { type: 'string', format: 'date-time' },
                                    endedAt: { type: 'string', format: 'date-time' },
                                    clientActivityId: { type: 'string', example: 'uuid-string' },
                                    routeCoordinates: { type: 'array', items: { type: 'array', items: { type: 'number' } }, example: [[40.71, -74.00]] }
                                }
                            }
                        }
                    }
                },
                responses: {
                    201: { description: 'Activity created' },
                    200: { description: 'Idempotent response - activity already exists' }
                }
            },
            get: {
                tags: ['Activities'],
                summary: 'List user activities',
                responses: {
                    200: { description: 'List of activities' }
                }
            }
        },
        '/v1/activities/{id}': {
            get: {
                tags: ['Activities'],
                summary: 'Get activity details',
                parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
                responses: { 200: { description: 'Activity found' }, 404: { description: 'Not found' } }
            },
            patch: {
                tags: ['Activities'],
                summary: 'Update activity',
                parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
                responses: { 200: { description: 'Activity updated' } }
            },
            delete: {
                tags: ['Activities'],
                summary: 'Delete activity',
                parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
                responses: { 204: { description: 'Activity deleted' } }
            }
        },
        '/v1/replay/{activityId}': {
            get: {
                tags: ['Replay'],
                summary: 'Get activity cinematic replay data',
                parameters: [{ name: 'activityId', in: 'path', required: true, schema: { type: 'string' } }],
                responses: { 200: { description: 'Replay data returned' } }
            }
        },
        '/v1/live-sessions/start': {
            post: {
                tags: ['Live Sessions'],
                summary: 'Start a live session',
                requestBody: {
                    required: true,
                    content: { 'application/json': { schema: { type: 'object', properties: { activityType: { type: 'string', example: 'RUN' } } } } }
                },
                responses: { 201: { description: 'Live session started' }, 409: { description: 'Session already active' } }
            }
        },
        '/v1/live-sessions/end': {
            post: {
                tags: ['Live Sessions'],
                summary: 'End live session',
                requestBody: {
                    required: true,
                    content: { 'application/json': { schema: { type: 'object', properties: { sessionId: { type: 'string' } } } } }
                },
                responses: { 200: { description: 'Live session ended' } }
            }
        },
        '/v1/live-sessions/pause': {
            post: {
                tags: ['Live Sessions'],
                summary: 'Pause live session',
                requestBody: {
                    required: true,
                    content: { 'application/json': { schema: { type: 'object', properties: { sessionId: { type: 'string' } } } } }
                },
                responses: { 200: { description: 'Live session paused' } }
            }
        },
        '/v1/live-sessions/resume': {
            post: {
                tags: ['Live Sessions'],
                summary: 'Resume live session',
                requestBody: {
                    required: true,
                    content: { 'application/json': { schema: { type: 'object', properties: { sessionId: { type: 'string' } } } } }
                },
                responses: { 200: { description: 'Live session resumed' } }
            }
        },
        '/v1/live-sessions/{sessionId}': {
            get: {
                tags: ['Live Sessions'],
                summary: 'Get live session details',
                parameters: [{ name: 'sessionId', in: 'path', required: true, schema: { type: 'string' } }],
                responses: { 200: { description: 'Live session details returned' } }
            }
        }
    },
};
