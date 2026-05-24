# USERFLOW.md
## User Flow Documentation
### Node.js Monolithic Backend Starter

**Services involved in flows:**
- BetterAuth → handles all /api/auth/* routes internally
- MongoDB Atlas M0 → sessions, users, workspaces stored here
- Upstash Redis → rate limiting, BullMQ queues, response cache
- Resend → delivers all transactional emails (free 3K/mo)
- Railway → hosts the Node.js app, auto SSL

---

## 1. Auth Flows

### 1.1 Email + Password Signup

```
User                  Frontend              BetterAuth (Express)      MongoDB Atlas    Upstash (BullMQ)   Resend
 │                       │                         │                       │                  │              │
 │  Fill form            │                         │                       │                  │              │
 │  name+email+pass      │                         │                       │                  │              │
 │──────────────────────►│                         │                       │                  │              │
 │                       │  POST /api/auth/signup  │                       │                  │              │
 │                       │  {name, email, password}│                       │                  │              │
 │                       │────────────────────────►│                       │                  │              │
 │                       │                         │  Check email exists   │                  │              │
 │                       │                         │──────────────────────►│                  │              │
 │                       │                         │◄──────────────────────│                  │              │
 │                       │◄── 409 (if duplicate) ──│                       │                  │              │
 │  "Email already used" │                         │                       │                  │              │
 │◄──────────────────────│                         │  bcrypt hash password │                  │              │
 │                       │                         │  INSERT users doc     │                  │              │
 │                       │                         │──────────────────────►│                  │              │
 │                       │                         │  INSERT sessions doc  │                  │              │
 │                       │                         │──────────────────────►│                  │              │
 │                       │                         │  Enqueue verify email │                  │              │
 │                       │                         │  (non-blocking)       │─────────────────►│              │
 │                       │  201 { user }           │                       │                  │  send email  │
 │                       │  Set-Cookie: session    │                       │                  │─────────────►│
 │                       │◄────────────────────────│                       │                  │              │
 │  → Dashboard          │                         │                       │                  │              │
 │◄──────────────────────│                         │                       │                  │              │

STATES: idle → submitting → success | error_duplicate | error_validation
COOKIE: httpOnly=true · secure=true · sameSite=strict · maxAge=7days
RATE LIMIT: 10 signups/15min per IP (Upstash counter)
```

---

### 1.2 Email + Password Login

```
User                  Frontend              BetterAuth             Upstash              MongoDB Atlas
 │                       │                      │                     │                      │
 │  Enter email+pass     │                      │                     │                      │
 │──────────────────────►│                      │                     │                      │
 │                       │  POST /api/auth/signin│                     │                      │
 │                       │────────────────────►│                      │                      │
 │                       │                      │  Check rate limit   │                      │
 │                       │                      │  key: ratelimit:ip  │                      │
 │                       │                      │────────────────────►│                      │
 │                       │◄── 429 (5 fails/15min, Upstash counter) ───│                      │
 │  "Too many attempts.  │                      │                     │                      │
 │   Try in 15 minutes"  │                      │                     │                      │
 │◄──────────────────────│                      │                     │                      │
 │                       │                      │  Fetch user by email│                      │
 │                       │                      │────────────────────────────────────────────►│
 │                       │                      │  bcrypt.compare()   │                      │
 │                       │◄── 401 (wrong pass) ─│                     │                      │
 │  "Invalid credentials"│                      │                     │                      │
 │◄──────────────────────│                      │                     │                      │
 │                       │                      │  INSERT sessions doc│                      │
 │                       │                      │────────────────────────────────────────────►│
 │                       │  200 { user }        │                     │                      │
 │                       │  Set-Cookie: session │                     │                      │
 │                       │◄─────────────────────│                     │                      │
 │  → Dashboard          │                      │                     │                      │
 │◄──────────────────────│                      │                     │                      │

STATES: idle → submitting → success | error_credentials | error_rate_limit
```

---

### 1.3 Google OAuth Login (PKCE)

```
User          Frontend       BetterAuth (Railway)       Google OAuth         MongoDB Atlas
 │               │                  │                        │                     │
 │  Click        │                  │                        │                     │
 │  "Sign in     │                  │                        │                     │
 │   with Google"│                  │                        │                     │
 │──────────────►│                  │                        │                     │
 │               │  GET /api/auth/  │                        │                     │
 │               │  signin/google   │                        │                     │
 │               │─────────────────►│                        │                     │
 │               │                  │  Generate PKCE         │                     │
 │               │                  │  code_verifier +       │                     │
 │               │                  │  state → store in DB   │                     │
 │               │  302 → Google    │                        │                     │
 │               │◄─────────────────│                        │                     │
 │  → Google account picker         │                        │                     │
 │──────────────────────────────────────────────────────────►│                     │
 │◄──────────────────────────────────────────────────────────│                     │
 │  Select account                  │                        │                     │
 │──────────────────────────────────────────────────────────►│                     │
 │               │                  │                        │                     │
 │               │  GET /api/auth/callback/google?code=xxx&state=yyy               │
 │               │─────────────────►│                        │                     │
 │               │                  │  Validate state ✓      │                     │
 │               │                  │  POST token exchange   │                     │
 │               │                  │───────────────────────►│                     │
 │               │                  │◄───────────────────────│                     │
 │               │                  │  GET userinfo          │                     │
 │               │                  │───────────────────────►│                     │
 │               │                  │  {sub, name, email,    │                     │
 │               │                  │   picture}             │                     │
 │               │                  │◄───────────────────────│                     │
 │               │                  │                        │  New user?          │
 │               │                  │  INSERT users + accounts               ─────►│
 │               │                  │  OR UPDATE existing                          │
 │               │                  │  INSERT sessions doc   │                     │
 │               │                  │──────────────────────────────────────────────►│
 │               │  302 /dashboard  │                        │                     │
 │               │◄─────────────────│                        │                     │
 │  → Dashboard  │                  │                        │                     │
 │◄──────────────│                  │                        │                     │

NOTES:
  - PKCE state stored in MongoDB, validated on callback (anti-CSRF)
  - Google only sends user name on FIRST OAuth login — BetterAuth captures it immediately
  - Same email via Google + email/password → accounts linked to one user doc
  - Apple Sign In: same flow, more complex JWT verification (P2 — add when iOS app ships)
```

---

### 1.4 Password Reset Flow

```
STEP 1 — Request Reset (POST /api/auth/forgot-password)
────────────────────────────────────────────────────────
User enters email
        │
        ▼
BetterAuth: find user by email in MongoDB Atlas
        │
        ├── User NOT found → STILL return 200 "Check your email if registered"
        │   (never reveal whether an email exists — prevents enumeration)
        │
        ▼
Generate reset token (UUID v4, 1hr TTL)
Store in MongoDB users.resetToken
        │
        ▼
Enqueue BullMQ job → email.worker.ts → Resend API
Email contains: https://yourapp.com/reset-password?token=<uuid>
        │
        ▼
200 { message: "If your email is registered, you'll receive a link shortly" }


STEP 2 — Reset Password (POST /api/auth/reset-password)
─────────────────────────────────────────────────────────
User clicks link → frontend shows new password form
User submits { token, newPassword }
        │
        ▼
BetterAuth: find user by resetToken in MongoDB
        │
        ├── Not found → 400 { code: 'INVALID_TOKEN', message: 'Invalid or expired link' }
        ├── Expired   → 400 { code: 'TOKEN_EXPIRED', message: 'Link expired, request a new one' }
        │
        ▼
bcrypt hash newPassword
UPDATE user.password + UNSET user.resetToken
DELETE all sessions for this user (force re-login)
        │
        ▼
200 { message: 'Password updated. Please log in.' }
→ Frontend redirects to /login

TOKEN LIFECYCLE:
  generated → stored (1hr TTL) → email sent → user clicks link → consumed → deleted
```

---

## 2. Session Lifecycle

```
┌──────────────────────────────────────────────────────────────┐
│                     SESSION STATES                           │
└──────────────────────────────────────────────────────────────┘

           signup / login / OAuth callback
NONE  ─────────────────────────────────► ACTIVE
                                           │
                                           │  TTL: 7 days (sliding window)
                                           │  Refreshed on each authenticated request
                                           │
                     logout / all sessions │  password reset
                     invalidated          ▼
                              ┌──── REVOKED ─────────────────────┐
                              │     (deleted from MongoDB)        │
                              └──────────────────────────────────►┘
                                                                  │
                              TTL expires without activity        │
                     NONE  ◄────────────────────────────── EXPIRED
                              (user must log in again)

HOW SESSIONS WORK WITH UPSTASH:
  1. BetterAuth stores session in MongoDB Atlas (source of truth)
  2. requireAuth caches session lookup in Upstash (5min TTL)
  3. On logout: delete MongoDB session + delete Upstash cache key
  4. Network split (Upstash down): fallback to direct MongoDB query (slower, still works)

COOKIE:
  name:     better-auth.session_token
  httpOnly: true   (JS cannot read it — XSS safe)
  secure:   true   (HTTPS only — Railway provides SSL)
  sameSite: strict (sent only to same-origin — CSRF safe)
  maxAge:   604800 (7 days in seconds)
```

---

## 3. User Profile Flows

```
GET /v1/users/me
────────────────
requireAuth → req.user.id available
        │
        ▼
Check Upstash: cache:user:{id}
  HIT  → return cached { id, name, email, avatar, createdAt }
  MISS → query MongoDB users → cache 5min → return

PATCH /v1/users/me { name?, avatar? }
──────────────────────────────────────
requireAuth
Zod parse body → UpdateUserSchema
  invalid → 400 { code: 'VALIDATION_ERROR', message: '...' }
        │
        ▼
MongoDB: findByIdAndUpdate (only whitelisted fields: name, avatar)
Upstash: DEL cache:user:{id}  ← invalidate cache
        │
        ▼
200 { success: true, data: updatedUser }

DELETE /v1/users/me
────────────────────
requireAuth
        │
        ▼
Delete all user's sessions from MongoDB
Delete user document
Invalidate all workspaces where user is owner (or transfer)
DEL cache:user:{id} from Upstash
Clear session cookie
        │
        ▼
204 No Content
```

---

## 4. Workspace Flows

### 4.1 Create Workspace

```
POST /v1/workspaces { name: "Acme Corp" }
        │
requireAuth ✓
Zod validate ✓ (name: string, min 2, max 100)
        │
        ▼
Slug generation:
  "Acme Corp" → "acme-corp"
  Check MongoDB: slug exists?
  "acme-corp" taken → "acme-corp-2" → check again → etc.
        │
        ▼
MongoDB: INSERT workspace doc { name, slug, ownerId, plan: 'free' }
MongoDB: INSERT workspace_members { workspaceId, userId, role: 'owner' }
        │
        ▼
201 { success: true, data: { workspace } }
```

### 4.2 Member Invite Flow

```
STEP 1 — Admin invites (POST /v1/workspaces/:id/invite)
──────────────────────────────────────────────────────────
Body: { email: "dev@acme.com", role: "member" }

requireAuth + requireRole('admin' | 'owner')
Zod validate { email, role }
        │
        ▼
Check: is email already a member in this workspace?
  YES → 409 { code: 'ALREADY_MEMBER' }
        │
        ▼
Check: pending invite exists for this email?
  YES → UPDATE TTL (resend email)
  NO  → INSERT workspace_invites { token: uuid(), email, role, workspaceId, TTL: 48hr }
        │
        ▼
Enqueue BullMQ email job → Resend
Email: "You've been invited to Acme Corp — Accept invitation [link]"
Link: https://yourapp.com/invite?token=<uuid>
        │
        ▼
200 { message: 'Invite sent' }


STEP 2 — Invitee accepts (POST /v1/workspaces/invite/:token/accept)
─────────────────────────────────────────────────────────────────────
GET /v1/workspaces/invite/:token → validate + return workspace preview
  token not found → 404
  token expired (>48hr) → 410 Gone

requireAuth (if not logged in → frontend redirects to /login?redirect=/invite?token=xxx)
        │
        ▼
Validate: invite.email === req.user.email
  mismatch → 403 { code: 'EMAIL_MISMATCH', message: 'This invite was sent to a different email' }
        │
        ▼
MongoDB: INSERT workspace_members { workspaceId, userId, role: invite.role, invitedBy }
MongoDB: DELETE workspace_invites { token }
        │
        ▼
200 { success: true, data: { workspace, role } }

INVITE STATES: pending → accepted | expired (48hr) | revoked (admin deletes)
```

### 4.3 Member Role Management

```
PATCH /v1/workspaces/:id/members/:userId { role: "admin" }
────────────────────────────────────────────────────────────
requireAuth + requireRole('admin' | 'owner')

RBAC guards:
  owner  → can set anyone's role except other owners ✅
  admin  → can set 'member' or 'viewer' roles only ✅
  member → 403 Forbidden
  viewer → 403 Forbidden

Validation:
  Cannot change owner's role → 400 { code: 'CANNOT_DEMOTE_OWNER' }
  Cannot change your own role → 400 { code: 'CANNOT_CHANGE_OWN_ROLE' }
  Role must be: 'admin' | 'member' | 'viewer' → else 400

MongoDB: UPDATE workspace_members.role
        │
        ▼
200 { success: true, data: { member } }


DELETE /v1/workspaces/:id/members/:userId
──────────────────────────────────────────
requireAuth + requireRole('admin' | 'owner')

Validation:
  Cannot remove workspace owner → 400
  Cannot remove yourself → 400 (use leave endpoint)
  Cannot remove admin if requester is admin → 403

MongoDB: DELETE workspace_members { workspaceId, userId }
        │
        ▼
204 No Content
```

---

## 5. Email Job Flow (BullMQ + Upstash + Resend)

```
Service calls:
  emailQueue.add('send-email', {
    to: 'user@example.com',
    subject: 'Reset your password',
    html: '<p>Click here...</p>',
    type: 'password-reset'   // for logging
  })
        │
        ▼ (non-blocking — service returns immediately)
Upstash Redis — BullMQ job stored in bull:email queue
        │
        ▼ (Worker picks up job — runs in same Node.js process)
email.worker.ts Worker
        │
        ├── Attempt 1: Resend API call
        │     └── SUCCESS → mark job done → Pino log { jobId, to, type, ms }
        │     └── FAILURE → BullMQ retry with backoff
        │
        ├── Attempt 2 (after 1 second)
        │     └── SUCCESS → done
        │     └── FAILURE → retry
        │
        ├── Attempt 3 (after 5 seconds)
        │     └── SUCCESS → done
        │     └── FAILURE → retry
        │
        └── Attempt 4 (after 30 seconds)
              └── SUCCESS → done
              └── FAILURE → move to bull:email:failed (dead letter)
                            → Pino error log → (optional: Sentry alert)

Resend free tier: 100 emails/day · 3,000/month
  If daily limit hit: Resend returns 429 → BullMQ delays job until next day
  If monthly limit hit: upgrade to Resend Pro ($20/mo) or switch to Brevo ($0–$15/mo)
```

---

## 6. Health Check Flows

```
GET /health
────────────
Always returns 200 { status: 'ok', timestamp: ISO8601 }
Used by: Railway health check, cron-job.org uptime ping


GET /health/ready
──────────────────
Checks both connections in parallel:

  Promise.allSettled([
    mongoose.connection.db.admin().ping(),   // MongoDB Atlas M0
    redisClient.ping(),                       // Upstash Redis
  ])

  All pass  → 200 { status: 'ready', db: 'ok', redis: 'ok' }
  DB fails  → 503 { status: 'degraded', db: 'error', redis: 'ok' }
  Redis fails → 503 { status: 'degraded', db: 'ok', redis: 'error' }
  Both fail → 503 { status: 'down', db: 'error', redis: 'error' }

Used by: deployment readiness checks, monitoring dashboards
```

---

## 7. Error Response Map

| Scenario | HTTP | Code | Notes |
|---|---|---|---|
| Missing/invalid session cookie | 401 | UNAUTHORIZED | BetterAuth + requireAuth |
| Insufficient role | 403 | FORBIDDEN | requireRole middleware |
| Resource not found | 404 | NOT_FOUND | AppError from service layer |
| Invite email mismatch | 403 | EMAIL_MISMATCH | workspace invite flow |
| Duplicate resource | 409 | CONFLICT | email, workspace slug |
| Invite already accepted/expired | 410 | GONE | workspace invite flow |
| Zod validation failure | 400 | VALIDATION_ERROR | all endpoints |
| Rate limit exceeded | 429 | RATE_LIMITED | Upstash counter, BetterAuth built-in |
| Atlas / Upstash down | 503 | SERVICE_UNAVAILABLE | health/ready endpoint |
| Unhandled error | 500 | INTERNAL_ERROR | global error middleware |

All error responses:
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "email must be a valid email address"
  }
}
```

Stack traces: NEVER in production response. Only in Pino logs + Sentry.
