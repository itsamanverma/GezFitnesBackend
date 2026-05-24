# SYSTEM_DESIGN.md
## Node.js Monolithic Backend — System Design

**Infra:** Railway · MongoDB Atlas M0 · Upstash Redis · Resend · BetterAuth
**MVP Cost: ₹0/month**

---

## 1. System Goals

| Goal | Target | Constraint |
|---|---|---|
| API Response Time (p95) | < 200ms | Atlas M0 shared RAM — optimize queries |
| Uptime | 99.9% | Railway Hobby ($5/mo) needed for always-on |
| Concurrent Users (MVP) | 100–500 | Atlas M0 = 100 ops/sec max |
| Auth Session TTL | 7 days (sliding) | MongoDB TTL index on sessions |
| Max DB Query Time | < 100ms | Covered by indexes below |
| Background Job Latency | < 5 seconds | BullMQ over Upstash Redis |
| Email Delivery | < 30 seconds | Resend p95 delivery time |
| Free tier headroom | 500 DAU | Upstash 500K cmds/mo ÷ ~100 cmds/req |

---

## 2. High-Level System Diagram

```
┌──────────────────────────────────────────────────────────────────┐
│                        CLIENT LAYER                              │
│       Web App (React/Next.js) │ Mobile App │ API Consumers       │
└───────────────────────┬──────────────────────────────────────────┘
                        │ HTTPS
                        ▼
┌──────────────────────────────────────────────────────────────────┐
│               RAILWAY (auto SSL · custom domain)                 │
└───────────────────────┬──────────────────────────────────────────┘
                        │
┌───────────────────────▼──────────────────────────────────────────┐
│                NODE.JS MONOLITH (Express v5)                     │
│                                                                  │
│  Global Middleware: helmet · cors · pino-http · rateLimit        │
│  ─────────────────────────────────────────────────────────────   │
│  ┌────────────┐  ┌──────────┐  ┌────────────┐  ┌────────────┐   │
│  │ BetterAuth │  │  /users  │  │/workspaces │  │ /notifs    │   │
│  │ /api/auth/*│  │  Module  │  │  Module    │  │  Module    │   │
│  └────────────┘  └──────────┘  └────────────┘  └────────────┘   │
│  ─────────────────────────────────────────────────────────────   │
│  ┌──────────────────────────────────────────────────────────┐    │
│  │   BullMQ Workers  (email · webhook · cleanup)            │    │
│  │   Connected to Upstash Redis via UPSTASH_REDIS_URL        │    │
│  └──────────────────────────────────────────────────────────┘    │
└──────┬──────────────────────────────────┬────────────────────────┘
       │                                  │
┌──────▼──────────────┐      ┌────────────▼──────────────────────┐
│  MongoDB Atlas M0   │      │    Upstash Redis (free tier)      │
│  cloud.mongodb.com  │      │    console.upstash.com            │
│                     │      │                                   │
│  • users            │      │  • rate limit counters            │
│  • sessions         │      │  • user/workspace cache           │
│  • accounts         │      │  • BullMQ: email queue            │
│  • workspaces       │      │  • BullMQ: webhook queue          │
│  • notifications    │      │                                   │
│  Free: 512MB        │      │  Free: 500K cmds/mo               │
└─────────────────────┘      └───────────────────────────────────┘
       │                                  │
       └──────────────┬───────────────────┘
                      │ BullMQ email job
                      ▼
              ┌───────────────┐
              │  Resend API   │
              │  resend.com   │
              │  Free: 3K/mo  │
              └───────────────┘
```

---

## 3. Authentication System Design

### 3.1 Signup Flow (Email + Password)

```
POST /api/auth/signup
{ name, email, password }
         │
         ▼
BetterAuth validates input (built-in)
         │
         ▼
Check duplicate email → MongoDB Atlas M0
         │
         ├── exists → 409 Conflict { code: 'EMAIL_EXISTS' }
         │
         ▼
Hash password (bcrypt, 12 rounds — BetterAuth internal)
         │
         ▼
Insert user → MongoDB users collection
         │
         ▼
Enqueue verification email → Upstash BullMQ → Resend
(non-blocking — user proceeds without waiting)
         │
         ▼
Create session → MongoDB sessions collection
         │
         ▼
Set HTTP-only cookie + return 201 { user }
```

### 3.2 Google OAuth Flow (PKCE)

```
GET /api/auth/signin/google
         │
         ▼
BetterAuth builds Google OAuth URL + PKCE state + nonce
Stores state in MongoDB (anti-CSRF)
         │
         ▼
302 → accounts.google.com/o/oauth2/v2/auth?...
         │
         ▼ (user picks account on Google)
GET /api/auth/callback/google?code=xxx&state=yyy
         │
         ▼
BetterAuth validates state (anti-CSRF check)
         │
         ▼
Exchange code → Google access token (server-to-server)
         │
         ▼
Fetch Google profile { sub, name, email, picture }
         │
         ├── New user  → INSERT users + accounts docs
         ├── Returning → UPDATE profile, UPSERT account link
         │
         ▼
Create session → Set cookie → 302 /dashboard
```

### 3.3 Session Validation (Every Authenticated Request)

```
requireAuth middleware
         │
         ▼
Read session cookie from request
         │
         ▼
auth.api.getSession(req) — BetterAuth internal
         │
         ├── Check Upstash Redis cache (fast path, ~1ms)
         │
         ├── Cache MISS → Query MongoDB sessions (~15ms on Atlas M0)
         │       └── Write result to Upstash cache (TTL 5min)
         │
         ├── Not found / expired → 401 { code: 'UNAUTHORIZED' }
         │
         ▼
req.user = { id, email, name, role }
req.session = { id, expiresAt }
         │
         ▼
next() → Route handler
```

---

## 4. Multi-Tenant Workspace Design

### Mongoose Schemas

```typescript
// workspace.model.ts
const WorkspaceSchema = new Schema({
  name:      { type: String, required: true, maxlength: 100 },
  slug:      { type: String, required: true, unique: true },
  ownerId:   { type: Schema.Types.ObjectId, ref: 'User', required: true },
  plan:      { type: String, enum: ['free', 'pro', 'enterprise'], default: 'free' },
  settings:  {
    allowInvites: { type: Boolean, default: true },
    maxMembers:   { type: Number, default: 5 },
  },
}, { timestamps: true });

// workspace_member.model.ts
const WorkspaceMemberSchema = new Schema({
  workspaceId: { type: Schema.Types.ObjectId, ref: 'Workspace', required: true },
  userId:      { type: Schema.Types.ObjectId, ref: 'User', required: true },
  role:        { type: String, enum: ['owner', 'admin', 'member', 'viewer'], required: true },
  invitedBy:   { type: Schema.Types.ObjectId, ref: 'User' },
  joinedAt:    { type: Date, default: Date.now },
}, { timestamps: true });
```

### RBAC Matrix

| Role | Read | Write | Manage Members | Billing | Delete Workspace |
|---|---|---|---|---|---|
| viewer | ✅ | ❌ | ❌ | ❌ | ❌ |
| member | ✅ | ✅ | ❌ | ❌ | ❌ |
| admin | ✅ | ✅ | ✅ | ❌ | ❌ |
| owner | ✅ | ✅ | ✅ | ✅ | ✅ |

---

## 5. API Design Conventions

### Base URL
```
https://yourapp.railway.app/v1      (MVP)
https://api.yourdomain.com/v1       (custom domain)
```

### Standard Response Envelope

```typescript
// Success
{
  "success": true,
  "data": { ... },
  "message": "Workspace created",
  "meta": { "page": 1, "limit": 20, "total": 150, "totalPages": 8 }
}

// Error
{
  "success": false,
  "error": { "code": "VALIDATION_ERROR", "message": "email is required" }
}
// Note: error.details (Zod array) only included in NODE_ENV=development
```

### Core Endpoints

| Method | Path | Auth | Description |
|---|---|---|---|
| POST | /api/auth/signup | ❌ | Email/password signup (BetterAuth) |
| POST | /api/auth/signin | ❌ | Email/password login (BetterAuth) |
| GET | /api/auth/signin/google | ❌ | Initiate Google OAuth |
| GET | /api/auth/callback/google | ❌ | Google OAuth callback |
| POST | /api/auth/signout | ✅ | Invalidate session |
| GET | /api/auth/session | ✅ | Get current session |
| POST | /api/auth/forgot-password | ❌ | Request reset email via Resend |
| POST | /api/auth/reset-password | ❌ | Reset with token |
| GET | /v1/users/me | ✅ | Get own profile |
| PATCH | /v1/users/me | ✅ | Update name / avatar |
| DELETE | /v1/users/me | ✅ | GDPR delete account |
| POST | /v1/workspaces | ✅ | Create workspace |
| GET | /v1/workspaces | ✅ | List user's workspaces |
| GET | /v1/workspaces/:id | ✅ | Get workspace |
| PATCH | /v1/workspaces/:id | ✅ admin | Update workspace |
| DELETE | /v1/workspaces/:id | ✅ owner | Delete workspace |
| POST | /v1/workspaces/:id/invite | ✅ admin | Invite member (Resend email) |
| GET | /v1/workspaces/:id/members | ✅ | List members |
| PATCH | /v1/workspaces/:id/members/:uid | ✅ admin | Change role |
| DELETE | /v1/workspaces/:id/members/:uid | ✅ admin | Remove member |
| GET | /health | ❌ | Liveness probe |
| GET | /health/ready | ❌ | Readiness: checks Atlas + Upstash |

---

## 6. Caching Strategy (Upstash Redis)

```
Request hits protected route
         │
         ▼
requireAuth → session lookup
  ├── Upstash cache HIT → ~1ms → attach req.user
  └── Upstash cache MISS → Atlas query → cache for 5min
         │
         ▼
Controller calls service
         │
         ▼ (for read-heavy endpoints like GET /workspaces)
Check Upstash cache
  ├── HIT  → return cached JSON (skip Atlas)
  └── MISS → query Atlas → cache result
         │
         ▼
Return response

INVALIDATION:
  PATCH /users/me     → del cache:user:{id}
  PATCH /workspaces   → del cache:workspace:{id}
  POST /workspaces/invite → no cache to invalidate
```

| Data | Key | TTL |
|---|---|---|
| Session | managed by BetterAuth | 7 days |
| User profile | `cache:user:{id}` | 5 min |
| Workspace | `cache:workspace:{id}` | 10 min |
| Rate limit | `ratelimit:{ip}:{route}` | 15 min |

---

## 7. Background Job System (BullMQ + Upstash Redis)

```typescript
// config/redis.ts — Upstash connection for BullMQ
import { Redis } from 'ioredis';
export const redisClient = new Redis(process.env.UPSTASH_REDIS_URL!, {
  maxRetriesPerRequest: null,    // required for BullMQ
  tls: { rejectUnauthorized: false },
});

// jobs/queue.ts
import { Queue } from 'bullmq';
export const emailQueue = new Queue('email', { connection: redisClient });

// jobs/workers/email.worker.ts
import { Worker } from 'bullmq';
import { Resend } from 'resend';
const resend = new Resend(process.env.RESEND_API_KEY);
new Worker('email', async (job) => {
  await resend.emails.send(job.data);
}, {
  connection: redisClient,
  concurrency: 5,
});
```

Retry strategy: 3 attempts, exponential backoff (1s → 5s → 30s).
Failed jobs: dead-letter queue `email:failed` → inspect in Upstash console.

---

## 8. Security Design

| Threat | Mitigation |
|---|---|
| Brute force login | BetterAuth built-in rate limiting + Upstash counter |
| Session hijacking | HTTP-only, Secure, SameSite=Strict cookies |
| XSS | Helmet.js CSP headers — no tokens in localStorage |
| CSRF | SameSite=Strict + BetterAuth CSRF token on mutations |
| NoSQL injection | Mongoose typed schemas + Zod input validation |
| Sensitive data exposure | Never log passwords/tokens; .env never committed |
| Mass assignment | Zod schema whitelists accepted fields per endpoint |
| DDoS | Upstash rate limit middleware (100 req/15min per IP) |
| Secrets in Railway | Railway env var dashboard — not in repo |

---

## 9. Logging & Observability

```typescript
// All logs: structured JSON via Pino
{
  "level": "info",
  "time": "2025-05-22T10:30:00.000Z",
  "requestId": "abc-123",          // X-Request-ID header
  "userId": "user_xyz",            // from req.user (if authed)
  "method": "POST",
  "path": "/v1/workspaces",
  "statusCode": 201,
  "responseTime": 45,              // ms
  "msg": "Workspace created"
}
```

MVP monitoring stack (₹0):
- **Railway logs** → built-in log viewer, last 7 days
- **Sentry free tier** → 5K errors/month, 1 user
- **cron-job.org** → free uptime pings (keeps Railway free tier awake)

Growth monitoring:
- **BetterStack** → uptime + log drain ($0–$25/mo)
- **Sentry Team** → proper alerting + performance ($26/mo)

---

## 10. Database Indexing (MongoDB Atlas M0)

```typescript
// Run once on startup via db.ts migration check

// users — BetterAuth manages these automatically
// sessions — BetterAuth manages TTL index automatically

// workspaces
db.workspaces.createIndex({ slug: 1 }, { unique: true });
db.workspaces.createIndex({ ownerId: 1 });

// workspace_members — most frequent pattern: "get all members of workspace X"
db.workspace_members.createIndex({ workspaceId: 1, userId: 1 }, { unique: true });
db.workspace_members.createIndex({ userId: 1 });           // "get all workspaces of user X"

// workspace_invites — auto-expire after 48 hours
db.workspace_invites.createIndex({ token: 1 }, { unique: true });
db.workspace_invites.createIndex({ createdAt: 1 }, { expireAfterSeconds: 172800 });

// notifications — paginated feed for user
db.notifications.createIndex({ userId: 1, createdAt: -1 });
db.notifications.createIndex({ userId: 1, read: 1 });
```

Atlas M0 index limit: 3 indexes per collection. All indexes above are within limits.
