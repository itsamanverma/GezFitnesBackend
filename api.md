# NexFit/Strava Backend API Reference

This file documents the core authentication and user endpoints for the backend, utilizing the active development Pinggy HTTPS tunnel.

---

## 1. Live Tunnel & Base URL
*   **Active Server URL:** `https://yjhsf-2401-4900-1f3a-13ce-3b5-6d9f-bff-340b.run.pinggy-free.link`
*   **Fallback Localhost:** `http://localhost:3000`

---

## 2. Authentication Methods

The backend supports three forms of authentication:

1.  **Bearer Authorization (Mobile/API Clients):**
    *   Header: `Authorization: Bearer <accessToken>`
2.  **Cookie-Based Session (Web Clients):**
    *   Cookie: `better-auth.session_token=<session_token>` (for Better Auth endpoints)
    *   Cookie: `accessToken=<jwt_token>` (for custom API route access)
3.  **API Key Authorization (Internal/Administrative routes):**
    *   Header: `x-api-key: ba_fucwc0zhooreckt4c6mwu1s83f0x1fjo`

---

## 3. Social Login API Endpoints

### A. Native Social Login (Mobile)
Used by native iOS/Android SDKs to sign in or register users via an Identity Provider token.

*   **URL:** `https://yjhsf-2401-4900-1f3a-13ce-3b5-6d9f-bff-340b.run.pinggy-free.link/api/auth/v1/social`
*   **Method:** `POST`
*   **Headers:**
    ```http
    Content-Type: application/json
    ```
*   **Request Body (Google Example):**
    ```json
    {
      "provider": "google",
      "idToken": "google_id_token_string",
      "deviceId": "my-device-uuid-123",
      "platform": "ios",
      "appVersion": "1.0.0",
      "fcmToken": "fcm_push_token_xyz"
    }
    ```
*   **cURL Command:**
    ```bash
    curl -X POST "https://yjhsf-2401-4900-1f3a-13ce-3b5-6d9f-bff-340b.run.pinggy-free.link/api/auth/v1/social" \
      -H "Content-Type: application/json" \
      -d '{
        "provider": "google",
        "idToken": "google_id_token_string",
        "deviceId": "my-device-uuid-123",
        "platform": "ios",
        "appVersion": "1.0.0",
        "fcmToken": "fcm_push_token_xyz"
      }'
    ```
*   **Expected Response (200 OK):**
    ```json
    {
      "success": true,
      "data": {
        "accessToken": "eyJhbGciOiJIUzI1NiIsIn...",
        "refreshToken": "673f4e3c8f8b3c690226af18.47af3c990bde...",
        "expiresIn": 900,
        "user": {
          "_id": "user-uuid-123456",
          "name": "Jane Doe",
          "email": "janedoe@gmail.com",
          "emailVerified": true,
          "image": "https://googleusercontent.com/.../photo.jpg",
          "role": "user",
          "status": "active",
          "fcmToken": "fcm_push_token_xyz",
          "createdAt": "2026-05-30T19:00:00.000Z",
          "updatedAt": "2026-05-30T19:00:00.000Z"
        }
      }
    }
    ```

---

### B. Social Login Redirection Callback
Invoked automatically after browser-based social sign-in. Redirects mobile apps back to their custom URI scheme and sets cookies for web clients.

*   **URL:** `https://yjhsf-2401-4900-1f3a-13ce-3b5-6d9f-bff-340b.run.pinggy-free.link/api/auth/v1/social/callback`
*   **Method:** `GET`
*   **Query Parameters:**
    *   `platform` (optional): `ios` | `android` | `web`
    *   `isMobile` (optional): `true` | `false`
    *   `callbackURL` (optional): Deep-link scheme (defaults to `gezfit://auth/callback`)
    *   `deviceId` (optional): Unique device identifier
    *   `fcmToken` (optional): Firebase cloud messaging token
*   **cURL Command (Simulated Mobile Callback):**
    ```bash
    curl -i -X GET "https://yjhsf-2401-4900-1f3a-13ce-3b5-6d9f-bff-340b.run.pinggy-free.link/api/auth/v1/social/callback?platform=ios&isMobile=true&callbackURL=gezfit://auth/callback&deviceId=device-uuid" \
      -H "Cookie: better-auth.session_token=valid_better_auth_session_token_here"
    ```
*   **Expected Redirection Headers (Mobile redirect to Deep Link):**
    ```http
    HTTP/1.1 302 Found
    Location: gezfit://auth/callback?accessToken=eyJhbGciOiJIUzI1NiIsIn...&refreshToken=673f4e3c8f8b3c690226af18.47af3c990bde...
    ```
*   **Expected Redirection Headers (Web redirect to Dashboard):**
    ```http
    HTTP/1.1 302 Found
    Set-Cookie: accessToken=eyJhbGciOiJIUzI1NiIsIn...; Path=/; Max-Age=900; HttpOnly; SameSite=Lax
    Set-Cookie: refreshToken=673f4e3c8f8b3c690226af18.47af3c990bde...; Path=/; Max-Age=2592000; HttpOnly; SameSite=Lax
    Location: http://localhost:5173
    ```

---

## 4. Protected Endpoints (Verification Examples)

### A. Get Logged-In User Details
Requires Bearer Authentication or Cookie-Based session.

*   **URL:** `https://yjhsf-2401-4900-1f3a-13ce-3b5-6d9f-bff-340b.run.pinggy-free.link/v1/users/me`
*   **Method:** `GET`
*   **Option 1: Bearer Token (Recommended for Mobile)**
    ```bash
    curl -X GET "https://yjhsf-2401-4900-1f3a-13ce-3b5-6d9f-bff-340b.run.pinggy-free.link/v1/users/me" \
      -H "Authorization: Bearer <accessToken_received_on_login>"
    ```
*   **Option 2: Cookies (Recommended for Web)**
    ```bash
    curl -X GET "https://yjhsf-2401-4900-1f3a-13ce-3b5-6d9f-bff-340b.run.pinggy-free.link/v1/users/me" \
      -H "Cookie: better-auth.session_token=<token>"
    ```
*   **Expected Response (200 OK):**
    ```json
    {
      "success": true,
      "data": {
        "_id": "user-uuid-123456",
        "name": "Jane Doe",
        "email": "janedoe@gmail.com",
        "emailVerified": true,
        "image": "https://googleusercontent.com/.../photo.jpg",
        "role": "user",
        "status": "active",
        "createdAt": "2026-05-30T19:00:00.000Z",
        "updatedAt": "2026-05-30T19:00:00.000Z"
      }
    }
    ```

---

### B. Create Workspace (Administrative Endpoint)
Requires Bearer Auth and optional API key header protection.

*   **URL:** `https://yjhsf-2401-4900-1f3a-13ce-3b5-6d9f-bff-340b.run.pinggy-free.link/v1/workspaces`
*   **Method:** `POST`
*   **cURL Command:**
    ```bash
    curl -X POST "https://yjhsf-2401-4900-1f3a-13ce-3b5-6d9f-bff-340b.run.pinggy-free.link/v1/workspaces" \
      -H "Authorization: Bearer <accessToken>" \
      -H "x-api-key: ba_fucwc0zhooreckt4c6mwu1s83f0x1fjo" \
      -H "Content-Type: application/json" \
      -d '{
        "name": "Acme Engineering Group"
      }'
    ```
*   **Expected Response (201 Created):**
    ```json
    {
      "success": true,
      "data": {
        "_id": "673f4e3c8f8b3c690226af8a",
        "name": "Acme Engineering Group",
        "slug": "acme-engineering-group",
        "ownerId": "user-uuid-123456",
        "createdAt": "2026-05-30T19:05:00.000Z",
        "updatedAt": "2026-05-30T19:05:00.000Z"
      }
    }
    ```
