# ⚔️ AlgoFight — Real-Time Competitive Coding Arena

<p align="center">
  <img src="frontend/public/algofight-logo.png" alt="AlgoFight Logo" width="130" />
</p>

<p align="center">
  <b>A production-grade, distributed platform for real-time competitive algorithmic battles, multiplayer coding tournaments, and secure sandboxed code execution.</b>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Node.js-20+-68a063?style=for-the-badge&logo=node.js" alt="Node.js" />
  <img src="https://img.shields.io/badge/TypeScript-5.0+-3178c6?style=for-the-badge&logo=typescript" alt="TypeScript" />
  <img src="https://img.shields.io/badge/React-19-61dafb?style=for-the-badge&logo=react" alt="React 19" />
  <img src="https://img.shields.io/badge/Redis-Distributed_Queue-dc382d?style=for-the-badge&logo=redis" alt="Redis" />
  <img src="https://img.shields.io/badge/PostgreSQL-Prisma_ORM-336791?style=for-the-badge&logo=postgresql" alt="PostgreSQL" />
  <img src="https://img.shields.io/badge/WebSocket-Real--Time-010101?style=for-the-badge&logo=socketdotio" alt="WebSocket" />
</p>

---

## 🌟 Overview

**AlgoFight** is an open-source, esports-style competitive coding arena where developers clash in real-time algorithmic battles. The platform combines low-latency WebSockets, distributed Redis matchmaking, isolated sandboxed execution, and an immersive cyberpunk 3D interface to deliver instantaneous, cheat-resistant coding duels.

---

## 🚀 Key Features

### ⚔️ 1. Distributed 1v1 Matchmaking Engine
- **Global Skill-Based Matchmaking (SBMM):** Backed by Redis Sorted Sets (`matchmaking:pool`) and Hash tickets for $O(\log N)$ range lookups.
- **Atomic Lua Pairing:** Atomically pairs candidates and creates rooms in a single transaction, eliminating race conditions across multiple server instances and deployed clusters.
- **Cross-Instance Pub/Sub Fan-Out:** Delivers match events across distributed WebSocket gateway nodes via Redis Pub/Sub (`matchmaking:matched`).
- **Progressive Rating Expansion:** Expands rating brackets ($\pm 50 \to \pm 150 \to \pm 300\text{ ELO}$) over a 25-second window.
- **Instant AlgoBot Skip:** Allows users to skip queueing at any moment and instantly jump into a duel against `AlgoBot (1200 ELO)`.

### 🎮 2. Live Battle Arena & Problem Suite
- **Synchronized Coding Duels:** Real-time Monaco Code Editor with dual-pane layout, synchronized countdown timers, and active test cases.
- **Live Execution Streaming:** Step-by-step submission evaluation pipeline: `PREPARE` $\to$ `COMPILE` $\to$ `TEST_STARTED` $\to$ `TEST_COMPLETED`.
- **Post-Battle Analytics:** Detailed breakdown of test case inputs/outputs, runtime latency, memory usage, rating adjustments, and solution walkthroughs.

### 🛡️ 3. Anti-Cheat & Match Integrity
- **Tab Switch & Focus Monitoring:** Real-time detection of blur events, tab changes, and unauthorized copy-paste actions.
- **Automated Forfeit & Disqualification:** Progressively warns combatants and triggers instant forfeits upon multiple integrity violations.

### 👥 4. Real-Time Player Presence & Direct Challenges
- **Live Presence Directory:** Real-time status indicators (`ONLINE`, `IN_BATTLE`, `OFFLINE`).
- **Direct 1v1 Invitations:** Instant player-to-player duel challenges with customizable acceptance deadlines and offline fallbacks.

### 📢 5. Time-Bound System Broadcast Dispatcher
- **SuperAdmin Control Hub:** Authorized dispatcher to schedule, preview, dispatch, and revoke system-wide announcements.
- **Auto-Expiry Engine:** Automatically de-indexes and clears banners and notifications upon reaching their scheduled expiration date/time.
- **Rich Media & CTAs:** Supports interactive URLs, clickable action buttons, and promotional image attachments.

### ⚙️ 6. Isolated Sandboxed Execution Engine
- **Multi-Language Support:** JavaScript, Python, C++, Java, and Go execution via Piston container sandboxes.
- **Hard Resource Quotas:** Strict memory ceilings, CPU execution limits, timeout safeguards, and file system isolation.
- **Fault-Tolerant Queueing:** Powered by BullMQ with exponential backoff retries and Dead-Letter Queues (DLQ).

---

## 🏗️ Architecture & Monorepo Structure

AlgoFight is organized as a high-performance **pnpm monorepo**:

```
AlgoFight/
├── apps/
│   ├── api/                  # REST API gateway (Auth, Battle Rooms, Submissions, Admin Dispatcher)
│   ├── websocket/            # Standalone high-concurrency WebSocket gateway
│   ├── worker/               # BullMQ background execution workers & sandbox coordination
│   └── scheduler/            # Match cleanup, cron scheduling & recovery services
├── packages/
│   ├── application/          # Domain services (MatchmakingService, BattleRoomService, RatingService)
│   ├── database/             # Prisma schema, migrations, client & repository abstractions
│   ├── queue/                # Redis connection, BullMQ queue definitions & worker factories
│   ├── error_handling/       # Standardized error classes and response utilities
│   └── logger/               # Structured Pino-based logger
└── frontend/                 # React 19 SPA (Vite, Monaco Editor, Three.js, React Three Fiber)
```

---

## 🛠️ Technology Stack

| Layer | Technologies |
|---|---|
| **Frontend Client** | React 19, Vite, Monaco Editor, React Three Fiber, Three.js, Framer Motion, Vanilla CSS |
| **Authentication** | Firebase Authentication with RSA-SHA256 Token Verification |
| **API Gateway** | Node.js, Express / Fastify, TypeScript, Zod |
| **Real-Time Gateway** | Native WebSockets (`ws`), Redis Pub/Sub cross-instance fan-out |
| **Background Queues** | Redis 7, BullMQ, ioredis |
| **Database & ORM** | PostgreSQL 15+, Prisma ORM |
| **Code Sandbox** | Piston Isolated Execution Engine |
| **Monorepo Tooling** | pnpm workspaces, TypeScript project references |

---

## ⚡ Getting Started

### 📋 Prerequisites

Ensure you have the following installed on your machine:
- **Node.js**: `v20.0.0` or higher
- **pnpm**: `v9.0.0` or higher (`npm i -g pnpm`)
- **PostgreSQL**: `v15` or higher running locally or hosted (Supabase, Neon, etc.)
- **Redis**: `v7` or higher running on port `6379`
- **Piston Sandbox** (Optional for local code execution): running on port `2000`

---

### 🔧 Installation & Environment Setup

1. **Clone the repository:**
   ```bash
   git clone https://github.com/arin-gupta06/AlgoFight-New-Backend-.git
   cd AlgoFight-New-Backend-
   ```

2. **Install all monorepo dependencies:**
   ```bash
   pnpm install
   ```

3. **Configure Environment Variables:**
   Create a `.env` file in the project root (and customize as needed):
   ```env
   # Server Ports
   PORT=3000
   WS_PORT=4001

   # Database Connection
   DATABASE_URL="postgresql://postgres:postgres@localhost:5432/algofight?schema=public"

   # Redis Configuration
   REDIS_HOST="localhost"
   REDIS_PORT=6379

   # Execution Engine
   PISTON_URL="http://127.0.0.1:2000"

   # Administrative Access
   ADMIN_SECRET_KEY="your-admin-secret-key"
   ```

4. **Initialize Database Schema & Migrations:**
   ```bash
   pnpm --filter @algofight/database prisma:migrate
   pnpm --filter @algofight/database prisma:generate
   ```

5. **Build all packages:**
   ```bash
   pnpm run build
   ```

---

### 🚀 Running the Development Environment

You can start all services concurrently or run individual services:

#### Start All Backend Services & Frontend:
```bash
# Terminal 1: Start API Gateway
pnpm --filter @algofight/api run dev

# Terminal 2: Start Real-Time WebSocket Gateway
pnpm --filter @algofight/websocket run dev

# Terminal 3: Start Frontend Client
cd frontend && npm run dev
```

The application will be accessible at:
- **Frontend App**: `http://localhost:5173`
- **REST API**: `http://localhost:3000`
- **WebSocket Gateway**: `ws://localhost:4001`

---

## 🧪 Testing & Verification

Run automated test suites and validation scripts across the monorepo:

```bash
# Build verification across all packages
pnpm run build

# Frontend production bundle test
cd frontend && npm run build

# Test Redis Distributed Matchmaking Engine
node apps/api/test_mm.js
```

---

## 🔒 Security & Fair Play

- **Cryptographic Auth Validation:** Firebase JWT tokens verified against Google `securetoken@system.gserviceaccount.com` public certificates.
- **Resource Capping:** User submissions run in isolated processes with strict CPU/memory timeouts.
- **Rate Limiting:** Distributed token-bucket rate limiting across API and WebSocket endpoints.
- **Input Sanitization:** Strict Zod schema validation on all incoming socket and REST payloads.

---

## 👥 Authors & Contributors

- **Vivek Chaurasiya**
- **Arin Gupta**

---

## 📄 License

This project is licensed under the [MIT License](LICENSE).
