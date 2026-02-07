# EverySkill

Internal Skill Marketplace - Connect with colleagues who have the skills you need.

EverySkill enables knowledge transfer and skill sharing within organizations. Skills improve as they pass through more hands, with real metrics proving that value.

## Tech Stack

- **Framework:** Next.js 15+ with React 19
- **Monorepo:** Turborepo + pnpm workspaces
- **Database:** PostgreSQL with Drizzle ORM
- **Styling:** Tailwind CSS v4
- **Language:** TypeScript (strict mode)

## Prerequisites

- Node.js 22+
- pnpm 9+
- Docker (for PostgreSQL)

## Getting Started

### 1. Clone the repository

```bash
git clone <repository-url>
cd everyskill
```

### 2. Install dependencies

```bash
pnpm install
```

### 3. Configure environment

```bash
cp .env.example .env.local
```

Edit `.env.local` with your values:
- `DATABASE_URL` - PostgreSQL connection string
- `NEXT_PUBLIC_APP_URL` - Application URL (default: http://localhost:3000)

### 4. Start PostgreSQL

```bash
pnpm docker:up
```

### 5. Run database migrations

```bash
pnpm db:push
```

### 6. Start development server

```bash
pnpm dev
```

Visit [http://localhost:3000](http://localhost:3000) to see the application.

## Monorepo Architecture

```
everyskill/
├── apps/
│   └── web/              # Next.js web application
├── packages/
│   ├── core/             # Shared business logic and types
│   ├── db/               # Database schema and Drizzle client
│   └── ui/               # Shared React components and styles
├── turbo.json            # Turborepo configuration
└── pnpm-workspace.yaml   # pnpm workspace configuration
```

### Package Details

| Package | Description | Dependencies |
|---------|-------------|--------------|
| `apps/web` | Next.js 15 web application | @everyskill/core, @everyskill/db, @everyskill/ui |
| `@everyskill/core` | Shared types, constants, and utilities | - |
| `@everyskill/db` | Drizzle ORM schema and database client | @everyskill/core, drizzle-orm, postgres |
| `@everyskill/ui` | Shared React components and Tailwind styles | @everyskill/core, react |

## Available Scripts

### Development

| Command | Description |
|---------|-------------|
| `pnpm dev` | Start development server with hot reload |
| `pnpm build` | Build all packages and applications |
| `pnpm lint` | Run ESLint across all packages |
| `pnpm typecheck` | Run TypeScript type checking |
| `pnpm format` | Format code with Prettier |

### Testing

| Command | Description |
|---------|-------------|
| `pnpm test` | Run unit tests |
| `pnpm test:e2e` | Run Playwright E2E tests |

### Database

| Command | Description |
|---------|-------------|
| `pnpm db:generate` | Generate Drizzle migrations |
| `pnpm db:migrate` | Run database migrations |
| `pnpm db:push` | Push schema changes to database |
| `pnpm db:studio` | Open Drizzle Studio for database inspection |

### Infrastructure

| Command | Description |
|---------|-------------|
| `pnpm docker:up` | Start PostgreSQL container |
| `pnpm docker:down` | Stop PostgreSQL container |

## Contributing

### Code Quality

Pre-commit hooks automatically run on staged files:
- ESLint with auto-fix
- Prettier formatting

All code must pass linting and type checking before commit.

### Development Workflow

1. Create a feature branch from `main`
2. Make your changes
3. Ensure `pnpm lint` and `pnpm typecheck` pass
4. Commit with a descriptive message
5. Create a pull request

### Code Style

- TypeScript strict mode enabled
- ESLint with Next.js and TypeScript rules
- Prettier for consistent formatting
- No `any` types (enforced by ESLint)
- Unused variables prefixed with `_`

## Project Structure

```
apps/web/
├── app/                  # Next.js App Router pages
│   ├── layout.tsx        # Root layout with metadata
│   ├── page.tsx          # Home page
│   └── globals.css       # Global styles with Tailwind
├── next.config.ts        # Next.js configuration
├── postcss.config.mjs    # PostCSS with Tailwind v4
└── tsconfig.json         # TypeScript configuration

packages/core/
└── src/
    └── index.ts          # Shared exports

packages/db/
└── src/
    ├── index.ts          # Database exports
    └── client.ts         # Drizzle client setup

packages/ui/
└── src/
    ├── index.ts          # Component exports
    └── styles/
        └── globals.css   # Shared Tailwind theme
```

## License

Internal use only.
