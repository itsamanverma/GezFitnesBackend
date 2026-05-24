# Better Auth Registration and Login Testing Guide

This guide details how the registration and login flows function under **Better Auth**, how the data is stored in MongoDB and Redis, and how to test these endpoints using `curl` commands.

---

## 🔑 Exposed Better Auth Endpoints

Because we mounted Better Auth under `/api/auth/{*any}` in `src/app.ts`, the following endpoints are automatically handled:

| Endpoint | Method | Description | Request Body |
|---|---|---|---|
| `/api/auth/sign-up/email` | `POST` | Registers a new user | `{ "email", "password", "name" }` |
| `/api/auth/sign-in/email` | `POST` | Authenticates a user | `{ "email", "password" }` |
| `/api/auth/get-session` | `GET` | Retrieves the current session | None (reads cookie/headers) |
| `/api/auth/sign-out` | `POST` | Logs the user out | `{}` |

---

## 🗄️ Database & Cache Storage

### 1. MongoDB Collections
Better Auth manages three collections inside your MongoDB database (`strava`):
- **`users`**: Stores core profiles.
  ```json
  {
    "_id": "user-unique-string-uuid",
    "name": "Jane Doe",
    "email": "jane@example.com",
    "emailVerified": false,
    "createdAt": "ISODate",
    "updatedAt": "ISODate"
  }
  ```
- **`accounts`**: Stores hashed credentials and link maps (e.g. for email/password or Google OAuth).
  ```json
  {
    "_id": "account-unique-string",
    "userId": "user-unique-string-uuid",
    "providerId": "email",
    "accountId": "jane@example.com",
    "password": "$argon2id$v=19$m=65536,t=3,p=4$hashed...",
    "createdAt": "ISODate",
    "updatedAt": "ISODate"
  }
  ```
- **`sessions`**: Stores active tokens and expirations.
  ```json
  {
    "_id": "session-unique-string",
    "userId": "user-unique-string-uuid",
    "token": "session-token-value",
    "expiresAt": "ISODate",
    "createdAt": "ISODate",
    "updatedAt": "ISODate"
  }
  ```

### 2. Redis Caching
When accessing protected routes (e.g., `GET /v1/users/me`):
1. **RequireAuth Middleware** is triggered.
2. It extracts the session token from the `better-auth.session_token` cookie or the `Authorization` header.
3. It computes the SHA-256 hash of the token and checks Redis for the key:
   `cache:session:{sha256_token_hash}`
4. If found (**Cache Hit**), it maps the user and session directly (takes ~1ms, avoiding a MongoDB call).
5. If not found (**Cache Miss**), it queries MongoDB, caches the result in Redis with a **5-minute (300 seconds) TTL**, and proceeds.

---

## 🧪 Step-by-Step User Flow Testing

### 1. Start the Dev Server
First, run your server locally. Open a terminal and execute:
```bash
. ~/.nvm/nvm.sh
npm run dev
```
The server will start listening on port `3000`.

### 2. Register a New User
Run this `curl` command to sign up a new user. It returns the user object and sets a session cookie:
```bash
curl -X POST http://localhost:3000/api/auth/sign-up/email \
  -H "Content-Type: application/json" \
  -c cookies.txt \
  -d '{
    "email": "user@example.com",
    "password": "SuperSecurePassword123",
    "name": "Jane Doe"
  }'
```
*Note: `-c cookies.txt` saves the session cookie returned by Better Auth so we can use it for subsequent requests.*

### 3. Log In (Alternative)
If you already registered, you can log in to obtain a new session:
```bash
curl -X POST http://localhost:3000/api/auth/sign-in/email \
  -H "Content-Type: application/json" \
  -c cookies.txt \
  -d '{
    "email": "user@example.com",
    "password": "SuperSecurePassword123"
  }'
```

### 4. Fetch the Current Profile (Protected Route)
We can fetch the profile from `/v1/users/me` using the cookie file we saved:
```bash
curl -X GET http://localhost:3000/v1/users/me \
  -b cookies.txt
```
*Note: The first request triggers a MongoDB fetch and caches the result. If you run it a second time, it will fetch from Upstash Redis immediately.*

### 5. Create a Workspace (Protected Tenant Route)
Create a new workspace using the active session cookie:
```bash
curl -X POST http://localhost:3000/v1/workspaces \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{
    "name": "My Alpha Team"
  }'
```
This will return:
```json
{
  "success": true,
  "data": {
    "_id": "workspace-object-id",
    "name": "My Alpha Team",
    "slug": "my-alpha-team",
    "ownerId": "user-id-from-better-auth",
    "plan": "free"
  },
  "message": "Workspace created successfully"
}
```

### 6. Sign Out
Clear your session from the server:
```bash
curl -X POST http://localhost:3000/api/auth/sign-out \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -c cookies.txt \
  -d '{}'
```
Subsequent attempts to fetch `/v1/users/me` using `cookies.txt` will now fail with a `401 Unauthorized` response.
