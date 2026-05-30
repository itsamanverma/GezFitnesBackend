# Social Login API & Mobile Integration Validation Report

This report validates the proposed **Mobile Login Auth Flow** and **Frontend Integration/Redirect Flow** diagrams, identifies security and implementation gaps, and details how the server should validate ID Tokens received from Google and Apple.

---

## 1. Diagram Validation & Correctness

### Diagram 1: Mobile Login Auth Flow (Apple/Google Login)
*   **Status: Correct but incomplete.**
*   **Assessment:** The overall logic is correct and represents a standard pattern for **native social login**. The mobile app handles authentication natively via Google/Apple SDKs, retrieves an `idToken` (or `identityToken`), and passes it to the backend. The backend verifies the token, matches the email, enforces provider consistency, generates session tokens, and updates device metadata.
*   **Correctness Highlights:**
    *   **Provider Consistency Check:** Verifying `provider == 'google'` or `'apple'` on an existing email is crucial to prevent account takeover (e.g. hijacking an email-password account with a fake social login).
    *   **FCM Token Updates:** Correctly isolates push-notification token association to mobile platforms (`iOS` / `Android`).

### Diagram 2: Frontend Integration / Redirect Flow (Social Login Flow)
*   **Status: Structurally correct but contains a security vulnerability.**
*   **Assessment:** This represents the web/redirect-based OAuth flow. It handles redirecting the user back to the appropriate platform (Mobile app via deep-link vs Web app via cookie and HTTP redirect) after successful browser-based login.
*   **Correctness Highlights:**
    *   Using cookies for the web dashboard redirection aligns with web security standards (provided they are configured with secure flags).

---

## 2. Gaps and Improvements

### Architectural & Security Gaps
1.  **Deep Link Token Exposure (High Risk):**
    *   *Issue:* Redirecting to a custom scheme like `gezfit://auth/callback?accessToken=...&refreshToken=...` exposes raw session tokens in the system logs, browser history, and makes them vulnerable to hijacking if another malicious app registers the same custom scheme on the device.
    *   *Remedy:* Use **Universal Links** (iOS) / **App Links** (Android) which use verified HTTPS domains, or use a temporary **Exchange Code** pattern (where the backend sends a short-lived, one-time code to the deep link, and the app exchanges it securely over HTTPS for the actual tokens).
2.  **Apple Name Handling (Missing Detail):**
    *   *Issue:* Apple only sends the user's name (`firstName`, `lastName`) in the request payload on the **very first authentication** request. Subsequent token decodes will not contain name claims.
    *   *Remedy:* The backend must handle missing names gracefully (e.g., using email prefix as a fallback) and the mobile client must pass the name explicitly in the body if it receives it from the SDK.
3.  **Missing CSRF State Verification in Redirect Flow:**
    *   *Issue:* Diagram 2 does not specify validating the OAuth `state` parameter before processing the callback, leaving the flow vulnerable to Cross-Site Request Forgery.

### Codebase Gaps (Current Node.js / Better Auth Setup)
1.  **Delegation Mismatch:** The current `/social` POST route in `src/auth/auth.routes.ts` delegates to `auth.api.signInSocial(...)`. This is intended for OAuth redirect exchange, and does not verify raw `idTokens` received from native SDKs.
2.  **FCM Token Handling:** There is currently no `fcmToken` variable parsed from the request body or updated in the `users` and `sessions` collections in the `/social` endpoint.
3.  **No Redirect callback handler:** There is no custom GET `/api/auth/v1/social/callback` endpoint in `auth.routes.ts` implementing the Mobile vs Web split redirect behavior shown in Diagram 2.

---

## 3. How to Validate Received ID Tokens

To verify that an ID token sent by the mobile client is valid and has not been forged, the server must perform cryptographic signature verification and validate key JWT claims.

### A. Google ID Token Verification
A Google `idToken` is a standard JWT. The backend can verify it using Google's public JWK set or Google's tokeninfo API.

#### Cryptographic Steps:
1.  Fetch Google's public certificates from `https://www.googleapis.com/oauth2/v3/certs`.
2.  Decode the JWT header to get the Key ID (`kid`).
3.  Find the certificate matching the `kid` and convert it to a Public Key.
4.  Verify the signature using the Public Key.
5.  **Validate Claims:**
    *   `iss` (Issuer) must match `https://accounts.google.com` or `accounts.google.com`.
    *   `aud` (Audience) must match the backend's Google Client ID.
    *   `exp` (Expiration) must be in the future.

#### Node.js Code Example (Native `fetch` + `jsonwebtoken`):
```typescript
import jwt from 'jsonwebtoken';
import crypto from 'crypto';

async function verifyGoogleIdToken(token: string, googleClientId: string) {
  // Option 1: Using Google's secure tokeninfo API (Simplest & handles verification)
  const res = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${token}`);
  if (!res.ok) throw new Error('Invalid Google ID Token');
  
  const payload = await res.json();
  if (payload.aud !== googleClientId) {
    throw new Error('Google ID Token audience mismatch');
  }
  
  return {
    email: payload.email,
    providerId: payload.sub,
    name: payload.name,
    profilePicture: payload.picture,
  };
}
```

---

### B. Apple ID Token Verification
Apple's `identityToken` is also a JWT, but Apple does not provide a tokeninfo API, so it **must** be verified cryptographically on the server.

#### Cryptographic Steps:
1.  Fetch Apple's public keys from `https://appleid.apple.com/auth/keys`.
2.  Decode the token's header to find the `kid`.
3.  Match the `kid` to Apple's JWKs and convert the JSON Web Key parameters (`n`, `e`) to a PEM-formatted public key.
4.  Verify the token's signature using `jsonwebtoken`.
5.  **Validate Claims:**
    *   `iss` must be `https://appleid.apple.com`.
    *   `aud` must match the Apple App ID / Service ID (Client ID).
    *   `exp` must be in the future.

#### Node.js Code Example (Crypto JWK Import + `jsonwebtoken`):
```typescript
import jwt from 'jsonwebtoken';
import crypto from 'crypto';

async function verifyAppleIdToken(token: string, appleClientId: string) {
  const decoded = jwt.decode(token, { complete: true });
  if (!decoded || typeof decoded === 'string') throw new Error('Invalid JWT format');
  
  const { kid } = decoded.header;
  
  // 1. Fetch Apple's public keys
  const res = await fetch('https://appleid.apple.com/auth/keys');
  const { keys } = await res.json();
  const jwk = keys.find((key: any) => key.kid === kid);
  if (!jwk) throw new Error('Matching Apple public key not found');

  // 2. Convert JWK to PEM format using native Node.js crypto
  const publicKeyObj = crypto.createPublicKey({ key: jwk, format: 'jwk' });
  const pem = publicKeyObj.export({ type: 'spki', format: 'pem' });

  // 3. Verify the signature and claims
  const payload = jwt.verify(token, pem, {
    algorithms: ['RS256'],
    issuer: 'https://appleid.apple.com',
    audience: appleClientId,
  }) as any;

  return {
    email: payload.email,
    providerId: payload.sub,
    name: payload.name || '', // Apple name is usually blank in ID token
    profilePicture: '',
  };
}
```
