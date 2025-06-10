# Aces.fun Project Rules & AI Playbook (V3 - Final)

This is the central rule definition for the Aces.fun project. It dictates how I (the AI assistant) should interpret requests, what context to use, and what standards to follow. Always adhere to the principles and structures defined in these documents.

## The Golden Rule: The Master Brief is Law

For any request that involves architectural decisions, feature planning, or touches multiple parts of the stack, you **MUST** prioritize the context from the master brief.

- **`@00-philosophy-and-stack.md`**: This is the foundational source of truth. Refer to it for high-level context, core philosophies, performance budgets, deployment procedures, and the official development plan.

---

## Situational Rules & Automatic Context

To ensure the highest accuracy, I will use the following context based on the nature of your request:

### When Building a **New End-to-End Feature**...

_(e.g., "Let's build the bidding system")_
I will load the entire project context to understand the full scope of interactions.

- `@00-philosophy-and-stack.md`
- `@01-smart-contracts.md`
- `@02-backend.md`
- `@03-frontend.md`

### When Working on **Smart Contracts**...

_(e.g., "Write a function to claim fees," "Add a test for the bonding curve")_
I will focus on the on-chain logic, security, and testing standards.

- `@01-smart-contracts.md` (Primary)
- `@00-philosophy-and-stack.md` (For core principles like gas budgets)

### When Working on the **Backend API**...

_(e.g., "Create an endpoint to get user submissions," "Refactor the approval service")_
I will focus on the service architecture, database interaction, and API contracts.

- `@02-backend.md` (Primary)
- `@00-philosophy-and-stack.md` (For principles like Idempotency and structured logging)

### When Working on the **Frontend UI/UX**...

_(e.g., "Build the token trading widget," "Create a hook for wallet state")_
I will focus on component structure, state management, and web3 integration.

- `@03-frontend.md` (Primary)
- `@00-philosophy-and-stack.md` (For principles like performance budgets and UX standards)

### When Working on **DevOps/Infrastructure**...

_(e.g., "Set up the CI/CD pipeline for gas checks," "Configure Railway deployment health checks")_
I will focus on deployment, monitoring, and operational concerns.

- `@00-philosophy-and-stack.md` (Specifically the Deployment, Monitoring, and Performance Budget sections)

### When **Refactoring Existing Code**...

_(e.g., "Refactor this component to use Zustand," "Migrate this service to the new error handling pattern")_
I will ensure the refactor aligns with current architectural standards while maintaining backward compatibility where necessary.

- Relevant layer-specific context file(s) (`@01`, `@02`, or `@03`)
- `@00-philosophy-and-stack.md` (For migration strategies and core principles)

### When **Debugging/Troubleshooting**...

_(e.g., "Why is this transaction failing?," "Debug the IPFS upload issue")_
I will load comprehensive context to understand the full interaction flow, focusing on the error handling standards and monitoring implementation details in the `@00-philosophy-and-stack.md` file.

---

## Template-Driven Code Generation

When a prompt asks to **create a new file**, I will use the corresponding template. This ensures consistency and adherence to our architectural patterns.

- **New React Component**: Triggered by "Create a new React component for...". Uses `@templates/react-component.tsx`.
- **New Custom Hook**: Triggered by "Create a custom hook that...". Follows standard React hook conventions with full TypeScript typing.
- **New Backend API Route**: Triggered by "Create a new API route for...". Uses `@templates/api-route.ts`.
- **New Backend Service**: Triggered by "Create a new backend service for...". Uses `@templates/backend-service.ts`.
- **New Smart Contract**: Triggered by "Create a new contract for...". It will follow a strict structure: SPDX License → Pragma → Imports → NatSpec contract documentation → `error` definitions → `contract` or `interface` itself with NatSpec for all functions.
- **New Test File**: Triggered by "Write tests for...". Test files will include setup/teardown patterns (`beforeEach`, `describe` blocks) appropriate for the testing framework.

---

## Automatic Quality Gates

### Automatic Security Checks

- **When code involves financial logic** (token transfers, fee calculations, swaps):
  I will automatically reference the security checklist from `@01-smart-contracts.md`, mention gas optimization and re-entrancy, and suggest test cases for edge conditions.

### Performance Budget Enforcement

- **When generating frontend code**:
  I will automatically warn if importing large libraries (>50KB impact), suggest code splitting for components that are not immediately visible, recommend lazy loading for non-critical UI sections, and ensure images use the Next.js `<Image>` component for optimization. For animations, I will prefer CSS `transform` and `opacity`.

### Automatic Error Handling Application

- For any generated code, I will automatically ensure:
  - **Smart Contracts**: Use custom errors with relevant parameters.
  - **Backend**: Include a `correlationId` in all error logging.
  - **Frontend**: Provide user-friendly error messages while logging technical details.
  - **All Layers**: Implement proper error boundaries and graceful degradation patterns.

### Integration Testing & Monitoring Guidance

- **When code spans multiple layers**, I will suggest appropriate integration tests:
  - **Smart Contract + Backend**: Test the event listening and database synchronization.
  - **Backend + Frontend**: Test the full API contract with real Zod schemas.
  - **End-to-End**: Test critical user flows with wallet interactions.
- **For any new feature**, I will suggest what to monitor:
  - **Smart Contracts**: What events should be indexed for analytics and alerting.
  - **Backend**: What metrics should be logged (response times, error rates).
  - **Frontend**: What user actions should be tracked in our analytics platform (PostHog).

---

## Specialized Assistant Modes

### Code Review Assistant Mode

- When asked to **review existing code**, I will automatically check against our documented standards:
  - [ ] Adherence to architectural principles from the master brief.
  - [ ] Performance budget compliance.
  - [ ] Security best practices and re-entrancy checks.
  - [ ] End-to-end type safety.
  - [ ] Completeness of error handling.
  - [ ] Adequacy of testing coverage.
  - [ ] NatSpec and code comment documentation standards.

### Git & Version Control Guidance

- When suggesting code changes, I will:
  - Recommend appropriate branch naming (`feature/`, `bugfix/`, `chore/`).
  - Suggest commit messages that align with the Conventional Commits specification (e.g., `feat: add bidding functionality`).
  - Highlight potential breaking changes that require careful coordination.

---

## General Instructions & Standards

- **Code First**: Provide code blocks first, followed by a concise explanation.
- **Dependency Management**: When suggesting new dependencies, I will check if the functionality already exists in our stack, prefer packages we already use, and consider the bundle size impact for any frontend additions.
- **File Path Validation**: I will validate that requested file paths align with our monorepo structure and suggest the correct location if a path seems wrong.
- **Be Proactive**: If a request conflicts with a rule in our master plan, I will point out the conflict and suggest a solution that aligns with our established architecture.
