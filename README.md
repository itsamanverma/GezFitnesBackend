# GezFitnesBackend (NexFit Live Session API / Strava Backend)

Node.js Monolithic Backend Starter for fitness applications with live session tracking, Strava integration, and comprehensive authentication.

## Stack
- **Runtime:** Node.js (>=20.0.0)
- **Framework:** Express v5
- **Language:** TypeScript
- **Database:** MongoDB (Mongoose)
- **Cache / Queue:** Redis (Upstash) + BullMQ
- **Authentication:** BetterAuth (Email/Password, Google OAuth, Sessions)
- **Realtime:** Socket.io
- **Emails:** Resend
- **Validation:** Zod
- **Logging:** Pino
- **Testing:** Vitest + Supertest

## Core Features
1. **Authentication:**
   - Email/password + Google OAuth, JWT sessions, logout, password reset
   - Secure HTTP-only cookies & Bearer tokens for mobile apps
   - Rate limiting and RBAC middleware
2. **User & Workspaces:**
   - User profile management
   - Workspace CRUD, invites, and member role management
3. **Live Sessions:**
   - Real-time GPS/activity tracking using WebSockets (Socket.io)
   - REST API for live session management (start, end, pause, resume)
4. **Activities & Tracking:**
   - Activity schema for storing workouts and tracking data
5. **Infrastructure:**
   - Docker support (local MongoDB + Redis)
   - Production-ready security headers (Helmet, CORS)
   - Background jobs for email delivery

## Setup & Installation

### 1. Clone & Install
```bash
git clone https://github.com/itsamanverma/GezFitnesBackend.git
cd GezFitnesBackend
npm install
```

### 2. Environment Variables
Copy `.env.example` to `.env` and fill in the required values:
```bash
cp .env.example .env
```
Key required variables:
- `MONGODB_URI`: MongoDB connection string
- `UPSTASH_REDIS_URL`: Redis connection URL
- `BETTER_AUTH_SECRET`: Secret for BetterAuth sessions
- `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET`: For Google OAuth
- `RESEND_API_KEY`: For email delivery

### 3. Run Locally (Docker)
Start a local MongoDB and Redis instance:
```bash
docker-compose up -d
```

Start the development server:
```bash
npm run dev
```

### 4. Build & Production
```bash
npm run build
npm start
```

## Testing
Run the comprehensive test suite (Unit & Integration tests):
```bash
npm run test
npm run test:watch     # Watch mode
npm run test:coverage  # Coverage report
```

## API Documentation
API documentation is available via Swagger. Once the server is running, visit:
`http://localhost:3000/api-docs` (or the configured port).

For architecture details, refer to the `doc/` folder:
- [ARCHITECTURE.md](doc/ARCHITECTURE.md)
- [SYSTEM_DESIGN.md](doc/SYSTEM_DESIGN.md)
- [MVP.md](doc/MVP.md)

## Deployment
This backend is designed for easy deployment to platforms like Railway, Render, or Heroku. Make sure to configure all environment variables and expose the appropriate ports for the HTTP server and WebSockets.
