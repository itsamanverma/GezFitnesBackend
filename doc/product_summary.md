# NexFit Backend: Product Summary & Detailed User Flows

This document provides a comprehensive analysis of the NexFit backend product architecture, feature roadmap, and end-to-end user journeys.

---

## 1. Product & Architecture Overview

NexFit is a high-performance fitness-tracking monolithic backend built with Node.js, Express, MongoDB (via Mongoose), Redis, and Socket.IO. The platform provides:
*   **Secure Authentication:** Traditional email/password, session listing, device revocation, and Google/Apple social login.
*   **Activity Tracking:** Post-activity sync with Google Polyline compression, and a replay engine.
*   **Live Session Streams:** WebSockets-based real-time tracking with rooms, spectator count monitoring, and QR-based short code sharing.
*   **Social & Groups System:** Public and invite-only groups, join tokens, and a bidirectional friendship engine.
*   **Health Integrations:** Daily sync of Apple Health and Android Health Connect metrics.

---

## 2. Plan Summary & Status (v1.1 Roadmap)

| Module | Feature | Status | Technology |
| :--- | :--- | :--- | :--- |
| **Auth & Security** | Rate Limiting (Signup/Login) | **Active** | `express-rate-limit` |
| | Device Session Revocation | **Active** | `better-auth` + session models |
| **Activities** | Google Polyline Compression | **Active** | `routePolyline` schema mapping |
| | Activity Replay Engine | **Active** | `GET /v1/replay/:activityId` |
| **Live Tracking** | WebSocket Room Management | **Active** | Socket.IO (room namespaces) |
| | QR & 6-Char Code Sharing | **Active** | Dynamic token verification & short code lookup |
| | Live Spectator Analytics | **Active** | Socket room size broadcasting |
| **Social & Groups** | Group Membership & Invites | **Active** | UUID tokens, Mongoose references |
| | Friend System | **Active** | Bidirectional `Friendship` model |
| **Health & Stats** | Dashboard Aggregation | **Active** | Parallel Mongoose Aggregation Pipelines |
| | Health Connect / Apple Health | **Active** | Batch metric sync endpoint |
| **Infrastructure** | Cloud Tunneling | **Active** | Cloudflare Tunnels (`cloudflared`) |
| | Event Queue / Background Worker | **Active** | BullMQ |
| | Caching layer | **Pending** | Redis cache decorators (Dashboard) |

---

## 3. Detailed User Flows & Sequences

### Flow A: User Authentication & Device Revocation
Secures logins, supports multiple mobile devices, and handles remote logouts.

```mermaid
sequenceDiagram
    autonumber
    participant Mobile as Mobile App
    participant Auth as Auth Module
    participant DB as MongoDB (Users/Sessions)

    Mobile->>Auth: POST /api/auth/v1/login (Credentials / Social token)
    Auth->>DB: Verify credentials / Verify token with Apple/Google
    DB-->>Auth: User details
    Auth->>DB: Create session (deviceId, platform, lastActiveAt)
    Auth-->>Mobile: JWT / Access Token + Session Info
    
    Note over Mobile, Auth: Listing Active Devices
    Mobile->>Auth: GET /api/auth/v1/sessions
    Auth->>DB: Query sessions where userId = current user
    DB-->>Auth: Session list
    Auth-->>Mobile: 200 OK (Device names, IPs, platforms)

    Note over Mobile, Auth: Revoking a Specific Device
    Mobile->>Auth: DELETE /api/auth/v1/sessions/:sessionId
    Auth->>DB: Delete session by ID
    DB-->>Auth: Success
    Auth-->>Mobile: 200 OK (Device logged out remotely)
```

---

### Flow B: Activity Sync & Google Polyline Compression
Saves database storage and network bandwidth by transforming raw coordinates into a single string.

```mermaid
sequenceDiagram
    autonumber
    participant Mobile as Mobile App
    participant API as Activity Controller
    participant DB as MongoDB (Activities)

    Note over Mobile: Activity Ends. Mobile app compiles<br/>coordinates array and compresses it using<br/>Google Encoded Polyline.
    Mobile->>API: POST /v1/activities (routePolyline: "_p~iF~ps|U...")
    API->>DB: Create Activity record with routePolyline string
    DB-->>API: Saved Document
    API-->>Mobile: 210 Created

    Note over Mobile, DB: Fetching History (Optimized)
    Mobile->>API: GET /v1/activities (List View)
    API->>DB: Query activities (excluding routePolyline field)
    DB-->>API: Small metadata documents
    API-->>Mobile: Paginated Activity List (Save bandwidth!)
```

---

### Flow C: Live Session Sharing & Spectators
Allows users to stream GPS location to friends and spectators via QR/Short code.

```mermaid
sequenceDiagram
    autonumber
    participant Athlete as Athlete App
    participant WS as Socket.IO Server
    participant Spec as Spectator Web/App
    participant DB as LiveSession / Redis Store

    Athlete->>WS: Emit 'live:join-session' { sessionId }
    WS->>DB: Register active session
    Athlete->>Athlete: Generate 6-char Share Code & QR
    
    Note over Spec, Athlete: Spectator Joins Stream
    Spec->>WS: Emit 'live:join-session' { shareCode }
    WS->>DB: Lookup sessionId from shareCode
    DB-->>WS: Session ID
    WS->>WS: Add Spectator to socket room 'session:{sessionId}'
    WS->>Athlete: Broadcast 'live:spectator-count-updated' (Incremented)
    
    Note over Athlete, Spec: Location Updates Stream
    Athlete->>WS: Emit 'live:coords' { lat, lng, speed, heartRate }
    WS->>WS: Broadcast 'live:coords-updated' to room 'session:{sessionId}'
    WS-->>Spec: Receive coordinates in real-time
```

---

### Flow D: Bidirectional Friend System
Enables social connectivity and updates feed permissions.

```mermaid
graph TD
    A[User 1: Send Request] -->|POST /v1/friends/request| B{Check DB}
    B -->|Self request or already friends| C[Return Error]
    B -->|Opposite request pending| D[Auto-Accept Friendship]
    B -->|Declined previously| E[Reset request status to pending]
    B -->|No record| F[Create pending Friendship record]
    
    F -->|User 2: GET /v1/friends/pending| G[View Requests]
    G -->|POST /v1/friends/accept| H[Status changed to accepted]
    G -->|POST /v1/friends/decline| I[Status changed to declined]
    
    H -->|GET /v1/friends| J[Include in friend list]
```

---

### Flow E: Health Ecosystem Integration
Performs asynchronous bulk ingestion of fitness metrics from mobile operating systems.

```mermaid
sequenceDiagram
    autonumber
    participant Mobile as Mobile App (HealthKit/Android Connect)
    participant API as Health Controller
    participant DB as MongoDB (Daily Health Metrics)
    
    Mobile->>API: POST /v1/health/sync (provider, dataPoints: [steps, calories])
    API->>DB: Upsert aggregate metric for current date
    DB-->>API: Success
    API-->>Mobile: 200 OK
    
    Note over Mobile, API: Fetching updated stats on Dashboard
    Mobile->>API: GET /v1/dashboard
    API->>DB: Run aggregate sum query over health metrics
    DB-->>API: Summary result
    API-->>Mobile: Consolidated Dashboard payload
```

---

## 4. Product Scalability & Production Readiness

1.  **Stateless Execution:** The Express application is completely stateless, making it fully ready to be deployed behind a Google Cloud Run load balancer.
2.  **External Storage Architecture:** Relies on external MongoDB Atlas database cluster and Upstash Redis instance to manage WebSocket session coordination.
3.  **Background Processing:** Utilizes `BullMQ` for offloading transactional emails and resource-intensive activity analyses away from the API request-response loop.
