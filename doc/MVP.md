# MVP.md
## Minimum Viable Product Specification
### Node.js Monolithic Backend Starter

**MVP Target:** Deployable, authenticated API with social login in **3 weeks**
**MVP Infra Cost: ₹0/month**
**Stack:** Railway · MongoDB Atlas M0 · Upstash Redis · Resend · BetterAuth

---

## 1. MVP Scope

The MVP answers one question:
> "Can a developer clone this repo, fill .env.example, and have a secure
> authenticated API with Google login deployed — for free — in under 30 minutes?"

### ✅ In Scope

| Module | Features | Cost |
|---|---|---|
| Auth | Email/password + Google OAuth, sessions, logout, password reset | ₹0 (BetterAuth self-hosted) |
| Users | Get/update own profile | ₹0 |
| Workspaces | CRUD + invite + role management | ₹0 |
| Email | Verification + reset + invite via Resend free tier | ₹0 (3K/mo) |
| Health | /health + /health/ready (Atlas + Upstash ping) | ₹0 |
| Infra | Atlas M0 + Upstash free + Railway free + auto SSL | ₹0 |
| Docs | README, .env.example, API reference, deploy guide | ₹0 |

### ❌ Out of Scope (Post-MVP)

- Stripe/Razorpay billing
- Two-factor authentication (BetterAuth plugin — easy to add later)
- Apple Sign In
- Admin panel / user management dashboard
- File uploads (S3 / Cloudflare R2)
- WebSockets / real-time events
- OpenAPI auto-generation
- Audit logs

---

## 2. Exact Package Versions

```json
{
  "engines": { "node": ">=20.0.0" },
  "dependencies": {
    "express": "^5.0.1",
    "better-auth": "^1.2.0",
    "mongoose": "^8.4.0",
    "ioredis": "^5.3.2",
    "bullmq": "^5.8.0",
    "zod": "^3.23.0",
    "pino": "^9.2.0",
    "pino-http": "^10.2.0",
    "helmet": "^8.0.0",
    "cors": "^2.8.5",
    "resend": "^4.0.0",
    "uuid": "^10.0.0",
    "dotenv": "^16.4.0"
  },
  "devDependencies": {
    "typescript": "^5.5.0",
    "tsx": "^4.16.0",
    "vitest": "^2.0.0",
    "supertest": "^7.0.0",
    "@types/express": "^5.0.0",
    "@types/node": "^20.14.0",
    "@types/cors": "^2.8.17",
    "@types/supertest": "^6.0.2",
    "eslint": "^9.6.0",
    "@typescript-eslint/parser": "^8.0.0"
  }
}
```

---

## 3. MVP Build Plan — 3 Weeks

### Week 1 — Foundation + Auth (Days 1–5)

```
Day 1: Project scaffolding
  ✓ npx create-node-app or manual TypeScript + Express v5 setup
  ✓ tsconfig.json (strict: true, paths, outDir)
  ✓ eslint.config.js (flat config, TS rules)
  ✓ src/config/env.ts — Zod schema for all env vars (fail fast on startup)
  ✓ src/utils/errors.ts — AppError, NotFoundError, UnauthorizedError
  ✓ src/utils/response.ts — success() and error() helpers
  ✓ src/middleware/error.middleware.ts — global Express error handler

Day 2: Database + cache connections
  ✓ MongoDB Atlas M0 cluster created (cloud.mongodb.com)
  ✓ src/config/db.ts — Mongoose connect with retry logic
  ✓ Upstash Redis instance created (console.upstash.com)
  ✓ src/config/redis.ts — ioredis client with TLS (UPSTASH_REDIS_URL)
  ✓ GET /health + GET /health/ready — pings both connections
  ✓ docker-compose.yml — local MongoDB + Redis for dev without cloud

Day 3: BetterAuth setup
  ✓ src/auth/auth.ts — BetterAuth with mongodbAdapter + Google OAuth
  ✓ app.ts — mount toNodeHandler(auth) at /api/auth/{*any}
  ✓ Test: POST /api/auth/signup, POST /api/auth/signin, GET /api/auth/session
  ✓ Verify session cookie is HTTP-only, Secure, SameSite=Strict

Day 4: Auth middleware + logging
  ✓ src/auth/auth.middleware.ts — requireAuth, requireRole
  ✓ src/middleware/requestId.middleware.ts — attach X-Request-ID
  ✓ src/middleware/logger.middleware.ts — pino-http integration
  ✓ src/middleware/rateLimit.middleware.ts — Upstash-backed 100 req/15min per IP
  ✓ Helmet + CORS configured from env ALLOWED_ORIGINS

Day 5: Email via BullMQ + Resend
  ✓ Resend account created, API key in .env, domain verified
  ✓ src/jobs/queue.ts — emailQueue using Upstash Redis connection
  ✓ src/jobs/workers/email.worker.ts — Worker consuming emailQueue
  ✓ Test: enqueue email job → Resend delivers → check inbox
  ✓ BetterAuth password reset flow working end-to-end
```

### Week 2 — User + Workspace Modules (Days 6–10)

```
Day 6: User module
  ✓ src/modules/user/user.model.ts — extended User schema (Mongoose)
  ✓ src/modules/user/user.schema.ts — Zod: UpdateUserSchema
  ✓ src/modules/user/user.service.ts — getUserById, updateUser, deleteUser
  ✓ src/modules/user/user.controller.ts — GET + PATCH + DELETE /v1/users/me
  ✓ src/modules/user/user.routes.ts — Express router
  ✓ Redis cache: user profile cached 5min, invalidated on update
  ✓ Vitest unit tests: user.service.test.ts

Day 7: Workspace model + basic CRUD
  ✓ src/modules/workspace/workspace.model.ts — Workspace + WorkspaceMember schemas
  ✓ src/modules/workspace/workspace.schema.ts — Zod: Create/UpdateWorkspaceSchema
  ✓ Slug generation: "Acme Inc" → "acme-inc" → "acme-inc-2" if taken
  ✓ POST /v1/workspaces, GET /v1/workspaces, GET /v1/workspaces/:id
  ✓ PATCH + DELETE with requireRole middleware

Day 8: Workspace invite flow
  ✓ workspace_invites collection + 48hr TTL index
  ✓ POST /v1/workspaces/:id/invite → validate role → send Resend email
  ✓ GET /v1/workspaces/invite/:token → return workspace preview
  ✓ POST /v1/workspaces/invite/:token/accept → create WorkspaceMember doc
  ✓ Handle: invite to existing member (409), expired token (410)

Day 9: Member management
  ✓ GET /v1/workspaces/:id/members (paginated, sorted by role)
  ✓ PATCH /v1/workspaces/:id/members/:uid — change role with RBAC guards
  ✓ DELETE /v1/workspaces/:id/members/:uid — remove with RBAC guards
  ✓ Edge cases: cannot demote owner, cannot remove yourself

Day 10: Integration tests (Week 2 coverage)
  ✓ Supertest: workspace CRUD full happy path
  ✓ Supertest: invite + accept flow
  ✓ Supertest: RBAC — viewer blocked from admin actions
  ✓ Coverage check: > 70% on workspace service
```

### Week 3 — Polish + Deploy (Days 11–15)

```
Day 11: Security audit
  ✓ Helmet CSP, HSTS, referrer-policy headers
  ✓ CORS — only allow origins from ALLOWED_ORIGINS env var
  ✓ Zod strict mode on all request schemas (no extra keys)
  ✓ Error middleware: never include stack traces in production
  ✓ No console.log anywhere — only Pino logger

Day 12: Auth integration tests
  ✓ Supertest: email signup → verify → login → session → logout
  ✓ Supertest: password reset full flow
  ✓ Supertest: Google OAuth callback (mock Google response)
  ✓ Supertest: rate limit — 5 failed logins → 429

Day 13: Railway deploy
  ✓ railway.toml with build + start commands
  ✓ Set all env vars in Railway dashboard (MONGODB_URI, UPSTASH_REDIS_URL, etc.)
  ✓ Deploy: railway up → smoke test on yourapp.railway.app
  ✓ Verify: signup, login, Google OAuth all work on live URL
  ✓ cron-job.org: free 5-min ping to /health (keeps Railway free tier awake)

Day 14: Documentation
  ✓ README.md — quick start, env vars, local dev, Railway deploy steps
  ✓ .env.example — every var with comment + where to get the value
  ✓ CONTRIBUTING.md — code style, test conventions, PR process

Day 15: Buffer + cleanup
  ✓ npm audit — fix any critical vulnerabilities
  ✓ tsc --noEmit — zero TypeScript errors
  ✓ vitest run --coverage — confirm > 70%
  ✓ Tag v1.0.0 in git
```

---

## 4. MVP File Deliverables

```
project/
├── src/
│   ├── server.ts                   ✅ Week 1 — start HTTP server
│   ├── app.ts                      ✅ Week 1 — Express factory, all middleware
│   │
│   ├── auth/
│   │   ├── auth.ts                 ✅ Week 1 — BetterAuth: Atlas + Google OAuth
│   │   └── auth.middleware.ts      ✅ Week 1 — requireAuth, requireRole
│   │
│   ├── modules/
│   │   ├── user/                   ✅ Week 2 — model, schema, service, controller
│   │   └── workspace/              ✅ Week 2 — full CRUD + invite + members
│   │
│   ├── jobs/
│   │   ├── queue.ts                ✅ Week 1 — Upstash BullMQ queues
│   │   └── workers/
│   │       └── email.worker.ts     ✅ Week 1 — Resend email delivery
│   │
│   ├── config/
│   │   ├── env.ts                  ✅ Week 1 — Zod env schema
│   │   ├── db.ts                   ✅ Week 1 — MongoDB Atlas M0
│   │   └── redis.ts                ✅ Week 1 — Upstash Redis (ioredis)
│   │
│   ├── middleware/                 ✅ Week 1 — error, rateLimit, requestId, logger
│   └── utils/                      ✅ Week 1 — errors, response, paginate, logger
│
├── tests/
│   ├── unit/                       ✅ Week 2 — user + workspace services
│   └── integration/                ✅ Week 3 — auth flows + workspace CRUD
│
├── railway.toml                    ✅ Week 3 — Railway deploy config
├── docker-compose.yml              ✅ Week 1 — local MongoDB + Redis
├── .env.example                    ✅ Week 3 — all vars documented
└── README.md                       ✅ Week 3 — setup + deploy guide
```

---

## 5. Environment Setup Guide

```bash
# 1. Clone and install
git clone <repo> && cd <repo>
npm install

# 2. Create accounts (all free, no credit card)
#    - cloud.mongodb.com     → create M0 free cluster → get connection string
#    - console.upstash.com   → create Redis DB → get UPSTASH_REDIS_URL
#    - resend.com            → get API key → verify domain (or use resend.dev)
#    - console.cloud.google.com → OAuth 2.0 Client ID → get client ID + secret

# 3. Configure environment
cp .env.example .env
# Fill in: MONGODB_URI, UPSTASH_REDIS_URL, BETTER_AUTH_SECRET,
#          GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, RESEND_API_KEY

# 4. Run locally (Docker for MongoDB + Redis)
docker-compose up -d    # start local MongoDB + Redis
npm run dev             # tsx watch src/server.ts

# 5. Test auth
curl -X POST http://localhost:3000/api/auth/signup \
  -H "Content-Type: application/json" \
  -d '{"name":"Aman","email":"aman@test.com","password":"Test@1234"}'

# 6. Deploy to Railway (free)
npm install -g @railway/cli
railway login
railway init
railway up
# Set env vars in Railway dashboard → same as .env
```

---

## 6. Definition of Done

A feature is "done" when ALL pass:

- [ ] Correct HTTP status codes (200, 201, 400, 401, 403, 404, 409, 429, 500)
- [ ] Zod validates request — invalid input → 400 with readable `message`
- [ ] `requireAuth` applied on all protected routes
- [ ] Error handled — server never crashes, no stack trace in prod response
- [ ] Upstash cache invalidated after writes
- [ ] Happy path covered by at least one Vitest test
- [ ] Zero `console.log` — structured Pino logging only
- [ ] `tsc --noEmit` passes — zero TypeScript errors

---

## 7. Risk Register

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Atlas M0 hits 512MB storage | Low (MVP) | Medium | Monitor in Atlas UI; upgrade to Flex ($8/mo) |
| Railway free tier sleeps | High | Low | cron-job.org free 5-min /health ping |
| Upstash 500K cmd/mo exceeded | Low (MVP) | Low | Monitor in Upstash console; upgrade to PAYG |
| BetterAuth MongoDB adapter bug | Low | High | Pin version; fallback = manual JWT (4hr task) |
| Google OAuth misconfigured | Medium | Medium | Exact setup steps documented in README |
| Resend 100/day limit hit | Low (MVP) | Low | BullMQ queues jobs; excess emails delayed |

---

## 8. Post-MVP Roadmap

```
Month 2 — Revenue foundation
  → Razorpay / Stripe billing module
  → File upload: Cloudflare R2 (free 10GB) or S3
  → OpenAPI spec from Zod schemas (zod-to-openapi)
  → Admin: list users, suspend accounts

Month 3 — Security hardening
  → Two-factor auth (BetterAuth twoFactor plugin — ~2hr to enable)
  → Apple Sign In (needed for App Store)
  → Audit log collection + UI
  → GitHub Actions CI/CD pipeline

Month 4 — Scale
  → Atlas Flex → M10 upgrade when hitting query limits
  → Upstash Fixed 250MB for production SLA
  → BetterStack for uptime + log drain
  → WebSocket support (Socket.io or native ws)
```

**Auth stays ₹0 at every phase** — BetterAuth is self-hosted, no per-user pricing ever.
