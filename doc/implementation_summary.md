# Express 5 Monolithic Backend Implementation Summary

This document provides a walkthrough of the implementation details of the backend starter project, which is designed as a modular monolith in TypeScript using **Express 5**, **Better Auth**, **BullMQ**, and **Mongoose**.

---

## 🛠️ Tech Stack & Key Choices

1. **Framework & Language**: Node.js, TypeScript (Strict NodeNext ESM), Express 5.
2. **Authentication**: **Better Auth** using the official MongoDB adapter (`better-auth/adapters/mongodb`) with native `MongoClient` extracted from the Mongoose connection for high stability.
3. **Database**: **MongoDB Atlas M0** via **Mongoose** (with auto-indexing and custom schemas).
4. **Caching & Queues**: **Upstash Redis** via **ioredis** used for rate-limiting, session cache, user profile cache, and background queue orchestration.
5. **Background Jobs**: **BullMQ** running async email delivery tasks using **Resend** with exponential backoff retries and auto-complete cleanups.

---

## 📁 Project Architecture & Files Created

The codebase is organized as follows:

```
/home/aman/Documents/AMAN/Strava
├── src/
│   ├── app.ts                  # App factory, mounts CORS, rate limiters, Better Auth, and routes
│   ├── server.ts               # Server entry point, boots queues and workers
│   ├── auth/
│   │   ├── auth.ts             # Better Auth configuration and adapter initialization
│   │   └── auth.middleware.ts  # requireAuth and requireWorkspaceRole RBAC route guards
│   ├── config/
│   │   ├── env.ts              # Env config and validation (Zod schema)
│   │   ├── db.ts               # Mongoose connection (uses top-level await)
│   │   └── redis.ts            # Redis client initialization (with BullMQ settings)
│   ├── jobs/
│   │   ├── queue.ts            # BullMQ email queue definition
│   │   └── workers/
│   │       └── email.worker.ts # BullMQ email worker consuming Resend emails
│   ├── middleware/
│   │   ├── requestId.middleware.ts  # Traces request headers
│   │   ├── logger.middleware.ts     # Pino HTTP logs
│   │   ├── rateLimit.middleware.ts  # Redis-backed rate limiter
│   │   └── error.middleware.ts      # Global exception catching
│   ├── modules/
│   │   ├── user/
│   │   │   ├── user.model.ts        # User schema mapping to Better Auth users
│   │   │   ├── user.schema.ts       # User update schema validations
│   │   │   ├── user.service.ts      # User CRUD, caching, and GDPR deletions
│   │   │   ├── user.controller.ts   # User HTTP route handlers
│   │   │   └── user.routes.ts       # User routes mapping
│   │   └── workspace/
│   │       ├── workspace.model.ts   # Workspace, Member, and Invite schemas
│   │       ├── workspace.schema.ts  # Workspace validation Zod schemas
│   │       ├── workspace.service.ts # Workspace creation, invite, accept, RBAC changes
│   │       ├── workspace.controller.ts # Workspace controller handlers
│   │       └── workspace.routes.ts     # Workspace route definitions
│   └── utils/
│       ├── errors.ts           # AppError sub-classes (e.g. ValidationError, UnauthorizedError)
│       ├── logger.ts           # Pino logger configuration
│       ├── paginate.ts         # Mongoose pagination helper
│       └── response.ts         # Enveloped JSON success/error structures
└── tests/
    ├── unit/
    │   └── user.service.test.ts      # User unit tests
    └── integration/
        ├── user.test.ts              # User profile endpoints integration tests
        └── workspace.test.ts         # Workspace, Members, and Invites CRUD integration tests
```

---

## 🔐 Auth & RBAC Middleware Flow

- **Session Check**: We use `requireAuth` to extract authorization cookies and headers.
  - **Caching**: The session is cached in Upstash Redis (`cache:session:{token_hash}`) for **5 minutes** (1-step cache hit ~1ms). Cache misses query MongoDB and write back to Redis.
- **RBAC Guards**: We use `requireWorkspaceRole(['owner', 'admin', 'member', 'viewer'])` to enforce workspace isolation and permissions.
  - **Permissions Matrix**:
    - **Owner**: Full permissions, including workspace deletion and member demotion/removal.
    - **Admin**: Can update workspace details, invite members, change member roles, and remove members.
    - **Member**: Read-only workspace info, cannot modify settings/members.
    - **Viewer**: Read-only workspace info.

---

## 📈 Endpoint Schema Details

### Health Check
- `GET /health` -> Liveness (always `200 ok`).
- `GET /health/ready` -> Readiness (parallel DB & Redis ping checks; returns `200 ready`, `503 degraded`, or `503 down`).

### Authentication
- `/api/auth/{*any}` -> Better Auth endpoints (SignUp, SignIn, OAuth).

### User Module
- `GET /v1/users/me` -> Retrieves authenticated user profile.
- `PATCH /v1/users/me` -> Updates name and image (strict properties validation).
- `DELETE /v1/users/me` -> Permanent account deletion (deletes user, active sessions, owned workspaces, memberships, and clears cookie).

### Workspace Module
- `POST /v1/workspaces` -> Creates new workspace with generated unique slug and marks creator as `owner`.
- `GET /v1/workspaces` -> Lists all workspaces where the current user is a member.
- `GET /v1/workspaces/:id` -> Retrieves details of a workspace (cached 10 min).
- `PATCH /v1/workspaces/:id` -> Updates workspace name and settings.
- `DELETE /v1/workspaces/:id` -> Deletes workspace (cascades memberships & invites).
- `POST /v1/workspaces/:id/invite` -> Creates invitation token (expires in 48 hours via TTL index) and queues invite email.
- `GET /v1/workspaces/invite/:token` -> Public route to preview invitation workspace name and slug.
- `POST /v1/workspaces/invite/:token/accept` -> Accepts invitation and adds invitee as member.
- `GET /v1/workspaces/:id/members` -> Lists members of a workspace.
- `PATCH /v1/workspaces/:id/members/:uid` -> Changes member's role.
- `DELETE /v1/workspaces/:id/members/:uid` -> Removes a member.

---

## 🧪 Testing Coverage & Verification

We implemented **17 unit and integration tests** under Vitest running Supertest requests:
1. **Isolated DB State**: Tests clean up only their designated test user records, completely avoiding race conditions or DB state pollution during parallel file execution.
2. **All Tests Passed**:
```bash
Test Files  3 passed (3)
     Tests  17 passed (17)
  Duration  9.57s
```
