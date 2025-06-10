/aces-monorepo/
├── .gitignore
├── package.json # Root scripts & dev dependencies (Turbo, Prettier, TypeScript)
├── pnpm-workspace.yaml # Defines the pnpm workspaces
├── turbo.json # TurboRepo pipeline configuration
│
├── apps/
│ ├── frontend/ # The Next.js dApp (Vercel target)
│ │ ├── app/
│ │ │ ├── (canvas)/ # Route group for the main canvas experience
│ │ │ │ ├── layout.tsx
│ │ │ │ └── page.tsx # Hosts the InfiniteCanvas component
│ │ │ ├── api/ # Next.js API Routes (if needed for simple tasks)
│ │ │ ├── tokens/
│ │ │ │ ├── [address]/
│ │ │ │ │ ├── page.tsx
│ │ │ │ │ └── admin/page.tsx
│ │ │ └── layout.tsx # Root layout with wallet providers
│ │ ├── components/
│ │ │ ├── canvas/ # Components specific to the canvas
│ │ │ │ ├── infinite-canvas.tsx
│ │ │ │ ├── particle-loading.tsx
│ │ │ │ └── image-details-modal.tsx
│ │ │ └── shared/ # General UI components
│ │ ├── hooks/ # Custom React hooks
│ │ │ └── canvas/ # Hooks for the canvas logic
│ │ ├── lib/ # Client-side helpers (viem, wagmi, privy setup)
│ │ ├── public/ # Static assets
│ │ └── ...next.js config files
│ │
│ └── backend/ # The Fastify API Server (Railway target)
│ ├── prisma/
│ │ ├── schema.prisma # The single source of truth for your DB
│ │ └── migrations/
│ ├── src/
│ │ ├── routes/ # API route handlers
│ │ ├── services/ # Business logic (contract interaction, etc.)
│ │ └── index.ts # Server entry point
│ └── .env.example # Example environment variables
│
└── packages/
├── contracts/ # The Hardhat Smart Contract project
│ ├── contracts/
│ │ ├── interfaces/ # THE BLUEPRINT: I BondingCurve.sol, etc.
│ │ ├── mocks/ # "Dumb" mock implementations for fast dev
│ │ └── RwaFactory.sol # The real, production contracts
│ ├── test/
│ └── hardhat.config.ts
│
├── ui/ # Shared React components (e.g., Button, Modal)
│ └── ...
│
└── utils/ # Shared, non-React code
├── src/
│ ├── abis.ts # Exported ABIs from the mock/real contracts
│ ├── types.ts # Shared TypeScript types
│ └── zod-schemas.ts # Shared Zod validation schemas
└── package.json
