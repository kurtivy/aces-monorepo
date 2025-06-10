# The Complete & Hardened Backend Development Plan (V5.1 - Final & Unabridged)

## Core Philosophy:

A secure, scalable, and resilient off-chain layer built with an explicit developer ethos. It is designed for high-availability operations, with clearly defined service level objectives (SLOs), robust monitoring, and graceful degradation patterns. It is architected for team scaling, long-term maintainability, and operational excellence.

## Part 0: The Developer Ethos (Cultural & Architectural Foundation)

**Goal**: Codify the principles that guide our development decisions to ensure long-term consistency, quality, and maintainability.

- **Blockchain is the Source of Truth**: Our database is a cache and an index for rich metadata to provide a fast UX. Always design services to be reconcilable with on-chain state. Any data that can be derived from the chain should be treated as ephemeral in our DB and refreshable.
- **Idempotency is Mandatory**: All on-chain interactions and webhook handlers must be safe to run more than once. Use unique constraints (e.g., `txHash` in the database) and status checks to prevent duplicate processing. A webhook arriving twice should result in one successful action and one graceful exit.
- **Fail Explicitly and Cleanly**: Avoid silent fallbacks. If a critical operation like metadata upload to IPFS or transaction signing fails, the process must abort, log a structured error with a unique `correlationId`, and return a clear, typed error state to the client.
- **Graceful Degradation**: The failure of a non-critical dependency (e.g., writing to an audit log) should not cause the failure of the primary user operation. The failure should be logged as a high-priority error, but the user's request should succeed.
- **Services are Composable, Not Entangled**: Business logic must reside in the service layer. Route handlers are for input/output validation, orchestration of service calls, and response formatting only.
- **Typed APIs are Law**: All public APIs must define their input and output types using Zod, exported from a shared `packages/utils/zod-schemas.ts` module. This ensures type safety from the frontend request to the database query.
- **Avoid Implicit Context**: Pass explicit parameters like `userId` or `submissionId` into services rather than relying on context leaking from the request object. This makes services easier to test and reason about independently.
- **No "One-Off" Scripts**: Administrative tasks must be built as reusable, tested CLI commands within `apps/backend/src/scripts/` (e.g., `pnpm run backfill-metadata`). They should use the same services and environment configuration as the main application.

---

## Part 1: The Blueprint - Database & API Schema

**Goal**: Define the exact shape of our data and the API contract. This unblocks frontend development and ensures data integrity from day one.

### Step 1.1: Database Schema (`prisma/schema.prisma`)

**Purpose**: The single source of truth for our application's data structure in PostgreSQL, enhanced with lifecycle, audit, indexing, and soft-delete fields.

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

model User {
  id            String          @id @default(cuid())
  privyDid      String          @unique
  walletAddress String?         @unique
  email         String?         @unique
  createdAt     DateTime        @default(now())
  submissions   RwaSubmission[]
  bids          Bid[]
}

model RwaSubmission {
  id              String               @id @default(cuid())
  status          SubmissionStatus     @default(PENDING)
  txStatus        TxStatus?
  rejectionType   RejectionType?
  name            String
  symbol          String
  description     String               @db.Text
  imageUrl        String
  ownerId         String
  owner           User                 @relation(fields: [ownerId], references: [id])
  proofOfOwnership String
  createdAt       DateTime             @default(now())
  approvedAt      DateTime?
  rejectionReason String?
  txHash          String?              @unique
  deletedAt       DateTime?
  updatedBy       String?
  updatedByType   ActionType?
  bids            Bid[]
  token           Token?
  auditLogs       SubmissionAuditLog[]

  @@index([status, createdAt])
  @@index([ownerId, createdAt])
  @@index([createdAt])
}

model Token {
  id              String        @id @default(cuid())
  contractAddress String        @unique
  deedNftId       Int
  submissionId    String        @unique
  submission      RwaSubmission @relation(fields: [submissionId], references: [id])
  createdAt       DateTime      @default(now())

  @@index([contractAddress])
}

model Bid {
  id           String        @id @default(cuid())
  amount       String
  currency     String
  bidderId     String
  bidder       User          @relation(fields: [bidderId], references: [id])
  submissionId String
  submission   RwaSubmission @relation(fields: [submissionId], references: [id])
  createdAt    DateTime      @default(now())
  deletedAt    DateTime?
  updatedBy    String?
  updatedByType ActionType?

  @@unique([bidderId, submissionId])
  @@index([submissionId, createdAt])
}

model WebhookLog {
  id          String    @id @default(cuid())
  payload     Json
  headers     Json
  error       String?
  processedAt DateTime?
  createdAt   DateTime  @default(now())

  @@index([processedAt, createdAt])
}

model SubmissionAuditLog {
  id           String           @id @default(cuid())
  submissionId String
  submission   RwaSubmission    @relation(fields: [submissionId], references: [id])
  fromStatus   SubmissionStatus?
  toStatus     SubmissionStatus
  actorId      String
  actorType    ActionType
  notes        String?
  createdAt    DateTime         @default(now())

  @@index([submissionId])
  @@index([actorId, actorType])
}

enum SubmissionStatus {
  PENDING
  APPROVED
  LIVE
  REJECTED
}

enum TxStatus {
  SUBMITTED
  MINED
  FAILED
  DROPPED
}

enum RejectionType {
  MANUAL
  TX_FAILURE
}

enum ActionType {
  USER
  SYSTEM
  WEBHOOK
  ADMIN
}
```

### Step 1.2: API Endpoint Definitions & Contracts

- **API Versioning**: All API routes will be prefixed with `/api/v1/`.
- **API Health Checks**:
  - `GET /api/v1/health/live`: Basic liveness check. Returns `200 OK` if the server is running.
  - `GET /api/v1/health/ready`: Readiness check. Returns `200 OK` only if critical connections (Database, primary RPC) are healthy. Used by the hosting provider to manage traffic routing.
- **Standard Error Contract**: To be defined in `packages/utils/types.ts`. All API errors must conform to this shape.
  ```typescript
  export type AppError = {
    statusCode: number;
    code: string;
    message: string;
    meta?: Record<string, any>;
  };
  ```
- **Standard Pagination Contract**: To be defined in `packages/utils/types.ts` and used by all public list endpoints, implementing cursor-based pagination.
  ```typescript
  export type PaginatedResponse<T> = {
    data: T[];
    nextCursor?: string;
    hasMore: boolean;
  };
  ```
- **API Endpoints Table**:
  | Method | Endpoint | Auth Level | Purpose |
  |----------|----------------------------------------------------|--------------------|--------------------------------------------------------------|
  | `POST` | `/api/v1/submissions` | User (Privy) | Create a new RWA submission for review. |
  | `GET` | `/api/v1/submissions/my` | User (Privy) | Get all submissions created by the current user. |
  | `DELETE` | `/api/v1/submissions/:id` | User (Privy) | Soft-delete a PENDING submission. |
  | `GET` | `/api/v1/tokens` | Public | Get a paginated list of all live tokens. |
  | `POST` | `/api/v1/bids` | User (Privy) | Place or update a bid on an RWA using an upsert operation. |
  | `DELETE` | `/api/v1/bids/:id` | User (Privy) | Soft-delete a bid placed by the user. |
  | `GET` | `/api/v1/admin/submissions` | Platform Admin | Get all submissions pending review. |
  | `POST` | `/api/v1/admin/approve/:submissionId` | Platform Admin | Approve a submission and trigger the on-chain deployment. |
  | `POST` | `/api/v1/admin/reject/:submissionId` | Platform Admin | Reject a submission and notify the user via email. |
  | `POST` | `/api/v1/admin/recover/resubmit/:submissionId` | Platform Admin | Re-attempt a failed/dropped on-chain transaction. |
  | `POST` | `/api/v1/admin/recover/replay-webhook/:webhookLogId` | Platform Admin | Manually replay a failed webhook from the dead-letter queue. |
  | `PUT` | `/api/v1/item-admin/token/:contractAddress` | Item Admin (on-chain) | Update off-chain metadata (e.g., description) for a token you own. |
  | `POST` | `/api/v1/webhooks/chain-event` | Infrastructure | Receive on-chain event notifications from a service like Alchemy. |

---

## Part 2: The Core Engine - Service Implementations

- **SubmissionService.ts**: Handles the logic for creating, retrieving, and soft-deleting `RwaSubmission` records, including file uploads to IPFS and input sanitization.
- **ApprovalService.ts**: Orchestrates the approval workflow. It authenticates, generates metadata, interacts with the blockchain, and updates the database state atomically.
- **RejectionService.ts**: Handles manual rejections, updating status, setting `rejectionType`, logging to the audit trail, and triggering a transactional email to the user.
- **BiddingService.ts**: Manages the bidding logic using Prisma upsert and handles soft deletion of bids.
- **WebhookListenerService.ts**: Consumes events from the webhook provider inside a `try/catch` block, using `WebhookLog` as a dead-letter queue. It idempotently updates the final on-chain status and logs to the audit trail.
- **RecoveryService.ts**: Provides authenticated admin-only tools for system recovery, such as resubmitting transactions and replaying failed webhooks.
- **ReconciliationService.ts**: A background job to prevent status drift by querying an RPC provider for the status of stale transactions and updating the database.
- **External Service Integration (IPFS, RPC)**: All calls to external services will be wrapped in a circuit breaker pattern (using `opossum`) with short timeouts and an exponential backoff retry strategy.

---

## Part 3: Operational Readiness & DevOps

### Step 3.1: Deployment & Infrastructure

- **Deployment Pipeline**: Utilize Railway's Git integration for a CI/CD pipeline (`develop` -> `staging`, `main` -> `production`).
- **Database Operations**: Configure Prisma connection pooling. Use `prisma migrate deploy` in the deployment pipeline.
- **Graceful Shutdown**: The main server will handle `SIGTERM` signals to allow in-flight requests to complete before exiting.

### Step 3.2: Monitoring, Alerting & Cost Management

- **Core Metrics & Dashboards**: Expose a `/metrics` endpoint with key application metrics.
- **Service Level Objectives (SLOs)**: Define and monitor SLOs for availability (99.9%) and latency (p90 < 200ms).
- **Alerting Strategy**: Configure alerts for SLO breaches, high error rates, low minter wallet balance, or a growing dead-letter queue.
- **Cost Management**: Acknowledge and monitor primary cost drivers (Database, IPFS, RPC, Logging) to ensure financial sustainability.

### Step 3.3: Blockchain Integration Resilience

- **RPC Provider Failover**: Implement automatic failover logic between a primary and secondary RPC provider.
- **Gas Price Management**: Use a reliable "fast" setting for gas, fetched from the network, with a reasonable buffer.
- **Reorg Handling**: Configure webhook provider to fire only after a sufficient number of block confirmations (5-10 blocks).

### Step 3.4: Security Hardening

- **CORS Configuration**: Explicitly configure the server to only accept requests from the Vercel frontend domain(s).
- **Request Size Limits**: Configure the server to reject request bodies larger than a reasonable limit (e.g., 5mb).
- **Input Sanitization**: Apply sanitization to all user-provided string fields before saving to the database.
- **SQL Injection**: Rely on Prisma's parameterized queries for protection.

### Step 3.5: Data Governance & Maintenance

- **Soft Deletes & Cleanup**: Implement user-facing soft deletes and a background job for hard-deleting abandoned pending submissions.
- **Database Maintenance**: Schedule periodic database maintenance jobs (VACUUM, ANALYZE) if necessary for the chosen database provider.
- **Backup & Restore Policy**: Formalize daily automated database backups and document the restoration procedure in a runbook.
- **Metadata Backfill Plan**: Create a CLI script to detect and fix drift between on-chain `tokenURI` and off-chain metadata.

### Step 3.6: Pre-Audit "Audit Mode" Protocol

- **Formalized Process**: A formal two-week protocol before any external security audit, including a code freeze, a push for 100% test coverage on critical code, a final review of all `[AUDIT]` tags, and generation of final gas reports.
