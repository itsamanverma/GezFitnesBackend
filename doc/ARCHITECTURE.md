# ARCHITECTURE.md
## Node.js Monolithic Backend — Architecture Guide

**Stack:** Node.js + TypeScript + Express v5 + BetterAuth + MongoDB Atlas (M0 free) + Upstash Redis (free) + Resend (free)
**Hosting:** Railway (free tier → Hobby $5/mo)
**Total infra cost at MVP: ₹0/month**

---

## 1. Overview

A **production-ready modular monolith** built on a zero-cost free-tier stack.
All code lives in one deployable unit, organized into domain-isolated modules.
Every service choice has a free tier that covers 0–500 users — no credit card needed
until you're generating real revenue.

```
┌─────────────────────────────────────────────────────────────┐
│              COST TIER AT A GLANCE                          │
│                                                             │
│  Railway (app)        ₹0   free tier / $5 Hobby always-on  │
│  MongoDB Atlas M0     ₹0   512MB · free forever             │
│  Upstash Redis        ₹0   500K cmds/mo · free forever      │
│  Resend email         ₹0   3,000 emails/mo · free forever   │
│  BetterAuth           ₹0   self-hosted · unlimited users    │
│  SSL + domain         ₹0   Railway auto SSL                 │
│  ─────────────────────────────────────────────────────────  │
│  MVP TOTAL            ₹0/month                              │
└─────────────────────────────────────────────────────────────┘
```

---

## 2. Tech Stack

| Layer | Technology | Free Tier / Cost | Reason |
|---|---|---|---|
| Runtime | Node.js 20 LTS | free | Stable, async I/O |
| Language | TypeScript 5+ | free | Type safety, better DX |
| Framework | Express v5 | free | Minimal, battle-tested |
| Auth | BetterAuth 1.x | ₹0 forever | Self-hosted, no per-user cost |
| Primary DB | MongoDB Atlas M0 | ₹0 (512MB free) | Flexible schema, free forever |
| Cache / Sessions | Upstash Redis | ₹0 (500K cmds/mo) | HTTP-based, serverless-friendly |
| Job Queue | BullMQ + Upstash | ₹0 | Background jobs over Upstash |
| Email | Resend | ₹0 (3K emails/mo) | Best DX, React Email support |
| Validation | Zod 3.x | free | Schema-first, TS-native |
| Logging | Pino 9.x | free | Structured JSON, low overhead |
| Testing | Vitest + Supertest | free | Fast unit + integration tests |
| Hosting | Railway | ₹0 / $5 Hobby | Git push deploy, auto SSL |
| Env Config | dotenv + zod | free | Validated env vars at startup |

### Upgrade Triggers (when to pay)

| Service | Upgrade When | Cost |
|---|---|---|
| MongoDB Atlas M0 → Flex | Storage hits 400MB | ~$8/mo |
| Railway free → Hobby | Need always-on (no sleep) | $5/mo |
| Upstash free → Fixed 250MB | >500 DAU sustained | $10/mo |
| Resend free → Pro | >3K emails/month | $20/mo |

---

## 3. Folder Structure

```
project-root/
│
├── src/
│   ├── server.ts                  # Express app entry point
│   ├── app.ts                     # App factory (middleware, routes, BetterAuth)
│   │
│   ├── auth/
│   │   ├── auth.ts                # BetterAuth config (MongoDB adapter, Google OAuth)
│   │   └── auth.middleware.ts     # requireAuth, requireRole guards
│   │
│   ├── modules/                   # Domain modules (feature folders)
│   │   ├── user/
│   │   │   ├── user.routes.ts
│   │   │   ├── user.controller.ts
│   │   │   ├── user.service.ts
│   │   │   ├── user.model.ts      # Mongoose schema
│   │   │   └── user.schema.ts     # Zod validation schemas
│   │   │
│   │   ├── workspace/             # Multi-tenant workspace module
│   │   │   ├── workspace.routes.ts
│   │   │   ├── workspace.controller.ts
│   │   │   ├── workspace.service.ts
│   │   │   └── workspace.model.ts
│   │   │
│   │   ├── billing/               # Subscription / plan management
│   │   │   ├── billing.routes.ts
│   │   │   ├── billing.controller.ts
│   │   │   ├── billing.service.ts
│   │   │   └── billing.model.ts
│   │   │
│   │   └── notification/          # Email / in-app notifications
│   │       ├── notification.routes.ts
│   │       ├── notification.service.ts
│   │       └── notification.model.ts
│   │
│   ├── jobs/                      # BullMQ background jobs (via Upstash Redis)
│   │   ├── queue.ts               # Queue definitions — uses UPSTASH_REDIS_URL
│   │   ├── workers/
│   │   │   ├── email.worker.ts    # Calls Resend API
│   │   │   └── webhook.worker.ts
│   │   └── schedulers/
│   │       └── cleanup.scheduler.ts
│   │
│   ├── config/
│   │   ├── env.ts                 # Zod-validated env schema (all vars declared here)
│   │   ├── db.ts                  # MongoDB Atlas connection (MONGODB_URI)
│   │   └── redis.ts               # Upstash Redis via ioredis (UPSTASH_REDIS_URL)
│   │
│   ├── middleware/
│   │   ├── error.middleware.ts    # Global error handler
│   │   ├── rateLimit.middleware.ts # Upstash-backed rate limiting
│   │   ├── requestId.middleware.ts
│   │   └── logger.middleware.ts
│   │
│   ├── utils/
│   │   ├── logger.ts              # Pino logger instance
│   │   ├── response.ts            # Standardized API response helpers
│   │   ├── paginate.ts            # MongoDB pagination helper
│   │   └── errors.ts              # Typed AppError, NotFoundError, etc.
│   │
│   └── types/
│       ├── express.d.ts           # Extend Express Request (req.user)
│       └── common.ts              # Shared TypeScript types
│
├── tests/
│   ├── unit/
│   └── integration/
│
├── .env.example                   # All required vars with comments
├── .env                           # Never committed
├── tsconfig.json
├── package.json
├── railway.toml                   # Railway deployment config
└── docker-compose.yml             # Local dev: MongoDB + Redis
```

---

## 4. Request Lifecycle

```
Client Request
     │
     ▼
Railway (auto SSL termination + custom domain)
     │
     ▼
Express v5 Router
     │
     ▼
Global Middleware
  ├── requestId        (attach X-Request-ID)
  ├── pino-http        (structured request logging)
  ├── helmet           (security headers)
  ├── cors             (origin whitelist from env)
  └── rateLimit        (Upstash Redis-backed, 100 req/15min per IP)
     │
     ▼
BetterAuth Handler    (/api/auth/* → toNodeHandler(auth))
     │
     ▼
Module Route Handler
     │
     ▼
requireAuth middleware  (reads BetterAuth session cookie)
     │
     ▼
requireRole middleware  (optional RBAC check)
     │
     ▼
Zod Validation          (body / params / query)
     │
     ▼
Controller              (thin — calls service, returns response)
     │
     ▼
Service                 (business logic, MongoDB queries via Mongoose)
     │
     ├── MongoDB Atlas M0 (primary data)
     └── Upstash Redis    (cache, session lookup, BullMQ queues)
     │
     ▼
Standardized Response   { success, data, message, meta }
```

---

## 5. Auth Architecture (BetterAuth)

```typescript
// src/auth/auth.ts
import { betterAuth } from 'better-auth';
import { mongodbAdapter } from 'better-auth/adapters/mongodb';
import { organization, twoFactor } from 'better-auth/plugins';
import { getDb } from '../config/db';

export const auth = betterAuth({
  database: mongodbAdapter(getDb()),          // MongoDB Atlas M0 — no schema migration
  secret: process.env.BETTER_AUTH_SECRET!,
  baseURL: process.env.BETTER_AUTH_URL!,

  emailAndPassword: { enabled: true },        // email + password login

  socialProviders: {
    google: {                                 // Google OAuth — free, covers India 95%+
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    },
  },

  plugins: [
    organization(),    // multi-tenant workspaces — P1
    twoFactor(),       // TOTP 2FA — P2, enable when ready
  ],
});
```

Session flow:
- BetterAuth issues session token → HTTP-only cookie (httpOnly, Secure, SameSite=Strict)
- Session record stored in MongoDB `sessions` collection (managed by BetterAuth)
- `requireAuth` calls `auth.api.getSession(req)` → attaches `req.user` for downstream use
- No Redis needed for session validation — BetterAuth reads MongoDB directly
- Upstash Redis used separately for rate limiting and BullMQ job queues

---

## 6. Database Architecture

### MongoDB Atlas M0 Collections

| Collection | Owner | Purpose |
|---|---|---|
| `users` | BetterAuth | Auth users, hashed passwords, OAuth links |
| `sessions` | BetterAuth | Active session records (TTL indexed) |
| `accounts` | BetterAuth | Linked OAuth accounts (Google) |
| `workspaces` | App | Tenant/organization records |
| `workspace_members` | App | User ↔ Workspace membership + roles |
| `workspace_invites` | App | Pending email invitations (48hr TTL) |
| `notifications` | App | In-app notification feed |

M0 storage budget: 512MB free. At ~2KB average doc size, supports ~256K documents
before hitting limits. Sufficient for 0–5K users.

### Upstash Redis Key Patterns

| Key Pattern | Purpose | TTL |
|---|---|---|
| `ratelimit:{ip}:{route}` | Per-IP rate limit counters | 15 min |
| `cache:user:{id}` | User profile cache (avoid repeat DB reads) | 5 min |
| `cache:workspace:{id}` | Workspace data cache | 10 min |
| `bull:email` | BullMQ email job queue | — |
| `bull:webhook` | BullMQ webhook delivery queue | — |

Free tier: 500K commands/month. At ~100 commands per request, covers 5K requests/day —
plenty for MVP with 100–500 DAU.

---

## 7. Email Architecture (Resend)

```typescript
// jobs/workers/email.worker.ts
import { Resend } from 'resend';
const resend = new Resend(process.env.RESEND_API_KEY);

// Called by BullMQ worker consuming 'email' queue
export async function sendEmail(job: Job) {
  const { to, subject, html } = job.data;
  await resend.emails.send({ from: process.env.EMAIL_FROM!, to, subject, html });
}
```

Free tier: 3,000 emails/month = 100 emails/day.
Covers: signup verification, password reset, workspace invites, and notifications
for an early-stage product with <300 active users.

Fallback: if Resend fails → job retries 3x (1s, 5s, 30s) via BullMQ → dead letter queue.

---

## 8. Environment Variables

```env
# Server
NODE_ENV=development
PORT=3000
APP_URL=http://localhost:3000
ALLOWED_ORIGINS=http://localhost:5173,https://yourapp.com

# MongoDB Atlas M0 — free cluster
# Get from: cloud.mongodb.com → Connect → Drivers
MONGODB_URI=mongodb+srv://<user>:<pass>@cluster0.xxxxx.mongodb.net/<dbname>?retryWrites=true&w=majority

# Upstash Redis — free tier
# Get from: console.upstash.com → Redis → Connect → Node.js (ioredis)
UPSTASH_REDIS_URL=rediss://default:<token>@<endpoint>.upstash.io:6379

# BetterAuth
BETTER_AUTH_SECRET=<run: openssl rand -base64 32>
BETTER_AUTH_URL=http://localhost:3000

# Google OAuth — free
# Get from: console.cloud.google.com → APIs → Credentials → OAuth 2.0 Client
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=

# Resend — free tier (3K emails/mo)
# Get from: resend.com → API Keys
RESEND_API_KEY=re_xxxxxxxxxxxx
EMAIL_FROM=noreply@yourdomain.com
```

---

## 9. Deployment Architecture

### MVP (₹0/month)
```
GitHub push
     │
     ▼ (Railway auto-deploy)
Railway App (Node.js)
     ├── MongoDB Atlas M0   (cloud.mongodb.com — free)
     ├── Upstash Redis      (console.upstash.com — free)
     └── Resend             (resend.com — free)

URL: yourapp.railway.app (free SSL)
Custom domain: add CNAME in Railway → SSL auto-provisioned
```

### Growth Phase (~₹2,500/month)
```
Railway Hobby ($5/mo) ← always-on, no sleep
     ├── MongoDB Atlas Flex (~$8/mo) ← 5GB, backups
     ├── Upstash Redis free (still sufficient)
     └── Resend free or Brevo ($0–$15/mo)
```

### Scale Phase (~₹8,000–15,000/month)
```
AWS EC2 t3.small (~$8/mo)
     ├── MongoDB Atlas M10 (~$57/mo) ← dedicated, perf advisor
     ├── Upstash Fixed 250MB (~$10/mo) ← production SLA
     └── Brevo/Resend Pro (~$15/mo)
```

---

## 10. Scalability Path

```
Phase 1 (₹0, MVP)       → Railway free + Atlas M0 + Upstash free
Phase 2 (₹2,500/mo)     → Railway Hobby + Atlas Flex + monitoring
Phase 3 (₹8,000/mo)     → EC2 + Atlas M10 + Redis Fixed + Sentry
Phase 4 (₹20,000+/mo)   → Multi-instance + ALB + Redis Cluster + CDN
```

Auth cost at every phase: **₹0** — BetterAuth is self-hosted.
(Clerk/Auth0 equivalent would cost ₹2,000–8,000/month at 500+ users.)
