# PRD.md
## Product Requirements Document
### Node.js Monolithic Backend Starter

**Version:** 1.1
**Date:** May 2025
**Author:** Engineering
**Status:** Active
**Infra Cost:** ₹0/month (MVP) → ~₹2,500/month (growth) → ~₹12,000/month (scale)

---

## 1. Problem Statement

Two problems every SaaS backend builder hits:

1. **Cold-start tax:** Auth, sessions, multi-tenancy, jobs, error handling = 3–4 weeks
   before writing a single line of business logic.

2. **Auth pricing trap:** Clerk/Auth0 starts cheap but costs ₹2,000–8,000/month at
   500+ users — right when you're trying to reach profitability.

This starter eliminates both. Zero-cost infra from day one, no per-user auth fees ever.

**Target users:** Backend engineers building SMB SaaS products on a lean budget who
want full ownership, no vendor lock-in, and a stack that deploys for ₹0.

---

## 2. Goals

### Primary Goals
- Complete auth (email + Google OAuth) working out of the box with BetterAuth
- ₹0 infra cost at MVP using Railway + MongoDB Atlas M0 + Upstash Redis + Resend
- TypeScript-first strict mode throughout — no implicit `any`
- Developer experience: `git clone → cp .env.example .env → npm run dev` in under 5 min

### Non-Goals
- Not a frontend starter — backend API only
- Not a microservices template — modular monolith only
- Does not include Stripe billing (separate module, post-MVP)
- Does not include AI/LLM features
- Does not use paid auth services (Clerk, Auth0, Supabase Auth)

---

## 3. User Personas

### Persona 1: Solo Backend Engineer (Primary)
**Name:** Aman — Senior Backend Engineer, Bengaluru
**Stack:** Node.js, TypeScript, MongoDB, Redis, Express
**Situation:** Building a SaaS side project; has a full-time job; limited free hours
**Needs:** Skip boilerplate, own the code, zero auth cost until revenue
**Pain Point:** Spends first 2 weeks on auth + infra setup instead of product

### Persona 2: Early-Stage Startup CTO
**Name:** Priya — Technical co-founder, 2-person team, 3-month runway
**Situation:** Needs to ship fast; budget is critical
**Needs:** Free infra tier, no per-user pricing, clean code for hiring later
**Pain Point:** Auth0 free tier runs out at 7,500 users then jumps to $240/month

### Persona 3: Freelance Developer
**Name:** Dev — Building MVPs for SMB clients
**Situation:** New project every 6–8 weeks; needs repeatable starter
**Needs:** Clients can maintain the code, well-documented, low opex
**Pain Point:** Every project starts from a different messy boilerplate

---

## 4. Functional Requirements

### 4.1 Authentication (P0)

| ID | Requirement | Service | Priority |
|---|---|---|---|
| AUTH-01 | Email + password signup | BetterAuth | P0 |
| AUTH-02 | Email + password login | BetterAuth | P0 |
| AUTH-03 | Google OAuth2 social login | BetterAuth + Google | P0 |
| AUTH-04 | HTTP-only cookie session management | BetterAuth | P0 |
| AUTH-05 | Logout + session invalidation | BetterAuth | P0 |
| AUTH-06 | Password reset via email link | BetterAuth + Resend | P0 |
| AUTH-07 | Email verification on signup | BetterAuth + Resend | P1 |
| AUTH-08 | GitHub OAuth2 (dev tools audience) | BetterAuth | P1 |
| AUTH-09 | TOTP two-factor authentication | BetterAuth plugin | P2 |
| AUTH-10 | Apple Sign In (iOS app launch) | BetterAuth plugin | P2 |

### 4.2 User Management (P0)

| ID | Requirement | Priority |
|---|---|---|
| USER-01 | GET /v1/users/me — own profile | P0 |
| USER-02 | PATCH /v1/users/me — name, avatar URL | P0 |
| USER-03 | DELETE /v1/users/me — GDPR account deletion | P1 |
| USER-04 | Admin: list all users (paginated, sorted) | P1 |
| USER-05 | Admin: suspend / unsuspend user | P2 |

### 4.3 Workspace / Multi-Tenancy (P1)

| ID | Requirement | Priority |
|---|---|---|
| WS-01 | Create workspace (auto-generates slug) | P1 |
| WS-02 | Get workspace by ID or slug | P1 |
| WS-03 | Update workspace name / settings | P1 |
| WS-04 | Delete workspace (owner only) | P1 |
| WS-05 | Invite member by email → Resend email sent | P1 |
| WS-06 | Accept / decline invite via token | P1 |
| WS-07 | Remove member | P1 |
| WS-08 | Change member role (owner → admin → member → viewer) | P1 |
| WS-09 | List workspace members (paginated) | P1 |
| WS-10 | Transfer workspace ownership | P2 |

### 4.4 Email + Notifications (P1)

| ID | Requirement | Service | Priority |
|---|---|---|---|
| EMAIL-01 | Signup verification email | BullMQ + Resend | P1 |
| EMAIL-02 | Password reset email | BullMQ + Resend | P0 |
| EMAIL-03 | Workspace invite email | BullMQ + Resend | P1 |
| EMAIL-04 | Welcome email on first login | BullMQ + Resend | P2 |
| NOTIF-01 | In-app notification create | App | P2 |
| NOTIF-02 | List notifications (paginated, unread first) | App | P2 |
| NOTIF-03 | Mark notification(s) as read | App | P2 |

### 4.5 System / Health (P0)

| ID | Requirement | Priority |
|---|---|---|
| SYS-01 | GET /health — liveness (always 200) | P0 |
| SYS-02 | GET /health/ready — checks Atlas + Upstash | P0 |
| SYS-03 | Structured Pino JSON request logging | P0 |
| SYS-04 | Global error handler — never leaks stack traces in prod | P0 |
| SYS-05 | X-Request-ID propagation | P1 |
| SYS-06 | Sentry error tracking (free tier) | P2 |

---

## 5. Non-Functional Requirements

| Category | Requirement |
|---|---|
| Cost | ₹0/month at MVP using free tiers (Railway + Atlas M0 + Upstash + Resend) |
| Performance | p95 API response < 200ms (simple queries on Atlas M0) |
| Security | OWASP Top 10 addressed; BetterAuth handles brute force + CSRF |
| Scalability | Stateless app → horizontal scale with shared Upstash sessions |
| Maintainability | Module isolation — each domain testable independently |
| Developer XP | `npm run dev` works in < 30s after env setup |
| Test Coverage | > 70% on service layer + 100% on auth happy/error paths |
| Vendor Lock-in | Zero — every service (app, DB, Redis, email) can be swapped |

---

## 6. Full API Contract

### Auth (BetterAuth — mounted at /api/auth/*)
```
POST   /api/auth/signup             Email + password signup
POST   /api/auth/signin             Email + password login
POST   /api/auth/signout            Logout (invalidate session)
GET    /api/auth/session            Current session + user
GET    /api/auth/signin/google      Initiate Google OAuth
GET    /api/auth/callback/google    Google OAuth callback
POST   /api/auth/forgot-password    Send reset email via Resend
POST   /api/auth/reset-password     Reset with token
POST   /api/auth/verify-email       Verify email token
```

### Users (App routes — protected)
```
GET    /v1/users/me                 Own profile
PATCH  /v1/users/me                 Update name, avatar
DELETE /v1/users/me                 GDPR delete
```

### Workspaces (App routes — protected)
```
POST   /v1/workspaces               Create
GET    /v1/workspaces               List mine
GET    /v1/workspaces/:id           Get by ID
PATCH  /v1/workspaces/:id           Update (admin+)
DELETE /v1/workspaces/:id           Delete (owner)
POST   /v1/workspaces/:id/invite    Invite member (admin+) → Resend email
GET    /v1/workspaces/invite/:token Validate invite token
POST   /v1/workspaces/invite/:token/accept  Accept invite
GET    /v1/workspaces/:id/members   List members
PATCH  /v1/workspaces/:id/members/:uid  Change role (admin+)
DELETE /v1/workspaces/:id/members/:uid  Remove (admin+)
```

### Notifications (App routes — protected)
```
GET    /v1/notifications            List (paginated, unread first)
PATCH  /v1/notifications/:id/read   Mark read
POST   /v1/notifications/read-all   Mark all read
```

### System
```
GET    /health                      Liveness (always 200)
GET    /health/ready                Readiness (Atlas + Upstash ping)
```

---

## 7. Infrastructure Constraints

| Constraint | Detail |
|---|---|
| MongoDB Atlas M0 | 512MB storage · 100 ops/sec · no automated backup · 1 free cluster per project |
| Upstash Redis free | 500K commands/month · 256MB · HTTP-based (ioredis compatible) |
| Resend free | 3,000 emails/month · 100/day · 1 custom domain |
| Railway free | Scales to zero after inactivity · use cron-job.org ping to keep awake |
| BetterAuth | Self-hosted · no SLA · community support · pin to stable version |
| Node.js 20 LTS | Minimum runtime — Railway uses this by default |
| TypeScript strict | `"strict": true` in tsconfig — no implicit `any` |

---

## 8. Success Metrics

| Metric | Target |
|---|---|
| Developer setup time | < 10 minutes from clone to running API |
| Time to first Google OAuth login | < 45 minutes |
| Infra cost at launch | ₹0/month |
| Monthly cost at 500 users | < ₹2,500/month |
| Auth test coverage | 100% happy + error paths |
| Zero critical auth bugs | First 30 days post-launch |
| BetterAuth vs Clerk savings | ₹0 vs ~₹4,000/month at 500 users |
