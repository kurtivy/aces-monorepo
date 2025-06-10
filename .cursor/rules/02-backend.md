# Backend Development Guide (apps/backend)

## Core Philosophy & Developer Ethos

This guide codifies the principles for the backend. We are building a secure, scalable, and resilient off-chain layer designed for high-availability operations, long-term maintainability, and operational excellence. All backend work MUST adhere to these rules.

1.  **Blockchain is the Source of Truth**: Our database is a cache and an index for rich metadata to provide a fast UX. Always design services to be reconcilable with on-chain state.
2.  **Idempotency is Mandatory**: All on-chain interactions and webhook handlers must be safe to run more than once. Use unique constraints (e.g., `txHash` in the database) to prevent duplicate processing.
3.  **Fail Explicitly and Cleanly**: Avoid silent fallbacks. If a critical operation fails, the process must abort, log a structured error with a unique `correlationId`, and return a clear, typed `AppError` to the client.
4.  **Graceful Degradation**: The failure of a non-critical dependency (e.g., writing an audit log) should **not** cause the failure of the primary user operation.
5.  **Services are Composable, Not Entangled**: Business logic MUST reside in the service layer (`src/services`). Route handlers (`src/routes`) are only for input/output validation, orchestration of service calls, and response formatting.
6.  **Typed APIs are Law**: All public APIs must define their input and output types using Zod, exported from `packages/utils/zod-schemas.ts`.
7.  **No "One-Off" Scripts**: Administrative tasks must be built as reusable, tested CLI commands within `apps/backend/src/scripts/`.

---

## 1. The Data Blueprint: Database & API Contracts

This is the exact shape of our data and API. It is the unbreakable contract for all backend and frontend interactions.

### Database Schema (The Single Source of Truth)

File: `prisma/schema.prisma`

```prisma
// This file contains the complete, unabridged Prisma schema.
// It includes: User, RwaSubmission, Token, Bid, WebhookLog, SubmissionAuditLog,
// and all related enums (SubmissionStatus, TxStatus, etc.) as defined
// in the master plan. It is the single source of truth for our data models.
```

### API Contracts

- **Versioning**: All API routes MUST be prefixed with `/api/v1/`.
- **Standard Error Contract** (`packages/utils/types.ts`):
  ```typescript
  export type AppError = {
    statusCode: number;
    code: string; // e.g., 'VALIDATION_ERROR'
    message: string;
    meta?: Record<string, any>;
  };
  ```
- **Health Checks**:
  - `GET /api/v1/health/live`: Liveness check. Returns 200 OK if the server is running.
  - `GET /api/v1/health/ready`: Readiness check. Returns 200 OK only if critical connections (Database, primary RPC) are healthy.

### API Endpoints Table

This table defines the complete API surface for V1.

| Method   | Endpoint                                       | Auth Level     | Purpose                                                    |
| -------- | ---------------------------------------------- | -------------- | ---------------------------------------------------------- |
| `POST`   | `/api/v1/submissions`                          | User (Privy)   | Create a new RWA submission for review.                    |
| `GET`    | `/api/v1/submissions/my`                       | User (Privy)   | Get all submissions created by the current user.           |
| `DELETE` | `/api/v1/submissions/:id`                      | User (Privy)   | Soft-delete a PENDING submission.                          |
| `GET`    | `/api/v1/tokens`                               | Public         | Get a paginated list of all live tokens.                   |
| `POST`   | `/api/v1/bids`                                 | User (Privy)   | Place or update a bid on an RWA using an upsert operation. |
| `DELETE` | `/api/v1/bids/:id`                             | User (Privy)   | Soft-delete a bid placed by the user.                      |
| `GET`    | `/api/v1/admin/submissions`                    | Platform Admin | Get all submissions pending review.                        |
| `POST`   | `/api/v1/admin/approve/:submissionId`          | Platform Admin | Approve a submission and trigger on-chain deployment.      |
| `POST`   | `/api/v1/admin/reject/:submissionId`           | Platform Admin | Reject a submission and notify the user.                   |
| `POST`   | `/api/v1/admin/recover/resubmit/:submissionId` | Platform Admin | Re-attempt a failed/dropped on-chain transaction.          |
| `POST`   | `/api/v1/webhooks/chain-event`                 | Infrastructure | Receive on-chain event notifications from a service.       |

---

## 2. Service Architecture & Responsibilities

The logic of the application is encapsulated in services. See Section 5 for detailed implementation patterns.

- **SubmissionService**: Handles RWA submission logic.
- **ApprovalService**: Orchestrates the multi-step approval workflow.
- **WebhookListenerService**: Consumes chain events idempotently. See `Webhook Signature Verification` pattern below.
- **External Service Integration**: All calls to external services (IPFS, RPC) MUST be wrapped in a circuit breaker. See `Circuit Breaker Pattern` below.

---

## 3. Operational Readiness & Security

- **Deployment**: `prisma migrate deploy` MUST be part of the deployment pipeline. The server MUST handle `SIGTERM` for graceful shutdowns.
- **Monitoring**: Key metrics are exposed at a `/metrics` endpoint. We monitor SLOs for availability (99.9%) and latency (p90 < 200ms).
- **Security Hardening**:
  - **Authentication**: All authenticated routes MUST use our `fastify.authenticate` middleware. See pattern below.
  - **Rate Limiting**: The API MUST be protected by global rate limiting. See pattern below.
  - **CORS**: The server MUST be configured to only accept requests from our Vercel frontend domain(s).

---

## 4. Standard Workflow: Anatomy of a New API Endpoint

1.  **Define Schema**: Define the Zod schemas in `packages/utils/zod-schemas.ts`.
2.  **Implement Service Logic**: Create/update a service in `src/services/` using the template below.
3.  **Create Route Handler**: Create the route handler in `src/routes/` using the template below.
4.  **Orchestrate**: The route handler validates the request (using the Fastify schema), authenticates (using `preHandler`), calls the service, and formats the response.

---

## 5. Code Templates & Implementation Patterns

This section provides concrete, production-ready code examples for our core patterns.

### Service Template (`@templates/backend-service.ts`)

This template enforces our developer ethos: structured logging, idempotency, and clean error handling.

```typescript
import { PrismaClient } from "@prisma/client";
import { AppError } from "packages/utils/src/types";
import { logger } from "../lib/logger"; // Assuming a central logger
import crypto from "crypto";

export class ExampleService {
  constructor(private prisma: PrismaClient) {}

  async createItem(
    params: { uniqueTxHash: string; data: string },
    userId: string
  ): Promise<any> {
    const correlationId = crypto.randomUUID();
    const log = logger.child({
      correlationId,
      userId,
      txHash: params.uniqueTxHash,
    });

    log.info("Create item operation started");

    try {
      // [PATTERN] Idempotency Check
      const existing = await this.prisma.rwaSubmission.findUnique({
        where: { txHash: params.uniqueTxHash },
      });

      if (existing) {
        log.warn("Idempotent operation detected, returning existing record.");
        return existing;
      }

      // [PATTERN] Database Operation
      const result = await this.prisma.rwaSubmission.create({
        data: {
          // ...data here
          txHash: params.uniqueTxHash,
          ownerId: userId,
        },
      });

      log.info("Operation completed successfully");
      return result;
    } catch (error) {
      log.error({ err: error }, "Service method failed");
      // Re-throw or wrap in a specific AppError
      throw new AppError(500, "DATABASE_ERROR", "Could not create the item.");
    }
  }
}
```

### API Route Template (`@templates/api-route.ts`)

This template enforces our service-oriented architecture and leverages Fastify's schema validation and hooks.

```typescript
import { FastifyInstance } from "fastify";
import { ExampleService } from "../services/ExampleService";
import { CreateItemSchema } from "packages/utils/src/zod-schemas";

export default async function (fastify: FastifyInstance) {
  const exampleService = new ExampleService(fastify.prisma);

  fastify.post(
    "/items",
    {
      // [PATTERN] Zod schema validation handled by Fastify
      schema: {
        body: CreateItemSchema,
      },
      // [PATTERN] Authentication middleware
      preHandler: [fastify.authenticate],
    },
    async (request, reply) => {
      const result = await exampleService.createItem(
        request.body as any, // Type is inferred from Zod schema
        request.user.id
      );
      return reply.status(201).send(result);
    }
  );
}
```

### Key Pattern: Authentication Middleware

In your main server file (`index.ts`) or a dedicated auth plugin, set up the decorator and hook.

```typescript
// Example: In src/plugins/auth.ts
import { FastifyRequest, FastifyReply } from "fastify";
// Assume you have a function to verify Privy tokens
import { verifyPrivyToken } from "../lib/auth";

fastify.decorate(
  "authenticate",
  async function (request: FastifyRequest, reply: FastifyReply) {
    try {
      const token = request.headers.authorization?.replace("Bearer ", "");
      if (!token) throw new Error("Missing authentication token");
      const user = await verifyPrivyToken(token);
      request.user = user; // Attach user to request object
    } catch (err) {
      reply.code(401).send({ message: "Unauthorized" });
    }
  }
);
```

### Key Pattern: Webhook Signature Verification

Create a middleware to protect webhook endpoints.

```typescript
// Example: In src/plugins/verifyWebhook.ts
import crypto from "crypto";

fastify.decorate("verifyWebhook", async function (request, reply) {
  const signature = request.headers["x-alchemy-signature"]; // Example header
  const secret = process.env.ALCHEMY_WEBHOOK_SECRET;
  if (!signature || !secret || !request.rawBody) {
    return reply.code(400).send({ message: "Missing signature or body" });
  }

  const hmac = crypto.createHmac("sha256", secret);
  hmac.update(request.rawBody); // IMPORTANT: Use the raw request body
  const digest = hmac.digest("hex");

  if (!crypto.timingSafeEqual(Buffer.from(digest), Buffer.from(signature))) {
    reply.code(401).send({ message: "Invalid signature" });
  }
});
// Usage in a route: preHandler: [fastify.verifyWebhook]
```

### Key Pattern: Circuit Breaker for External Calls

Wrap calls to services like IPFS to prevent cascading failures.

```typescript
import opossum from "opossum";

const options = {
  timeout: 3000, // If the function takes longer than 3 seconds, trigger a failure
  errorThresholdPercentage: 50, // When 50% of requests fail, open the circuit
  resetTimeout: 30000, // After 30 seconds, try again.
};

async function fetchFromIpfs(cid: string) {
  // Your actual IPFS fetch logic here...
}

const ipfsCircuit = opossum(fetchFromIpfs, options);

// To use:
// ipfsCircuit.fire(cid).then(result => ...).catch(err => ...);
```

### Key Pattern: Rate Limiting

In your main server file, register the rate-limiting plugin globally.

```typescript
// Example: In src/server.ts
import rateLimit from "@fastify/rate-limit";

await fastify.register(rateLimit, {
  max: 100, // max requests per time window
  timeWindow: "1 minute",
});
```
