# CatNovel AGENTS.md

A Next.js 16 webnovel workspace with SQLite, following Vercel's Geist design system.

## Build / Lint / Test Commands

```bash
# Development
pnpm dev                    # Start dev server on port 3000 (or $PORT)

# Build & Production
pnpm build                  # Production build (standalone output)
pnpm start                  # Start production server

# Quality Checks
pnpm lint                   # ESLint with --max-warnings=0
pnpm typecheck              # TypeScript check (tsc --noEmit)

# Testing
pnpm test                   # Run all tests with Node native test runner
node --test --experimental-strip-types tests/schema-bootstrap.test.ts   # Single test file

# Database
pnpm backup                 # Backup database
pnpm restore                # Restore database
pnpm recover                # Recover database
```

## Code Style Guidelines

### TypeScript

- **Target**: ES2022, strict mode enabled
- **Module**: ESNext with Bundler resolution
- **Imports**: Use `@/*` path alias for project imports
- **File extensions**: Use `.ts` and `.tsx` (allowImportingTsExtensions enabled)

### Imports Order

```typescript
// 1. External libraries (React, Next.js, etc.)
import type { ReactNode } from 'react';
import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';

// 2. Type-only imports grouped together
import type { BootstrapPayload } from '@/lib/contracts/bootstrap';
import type { WorkspaceCollections } from '@/lib/contracts/workspace';

// 3. Internal project imports using @/ alias
import { useKeyboardShortcuts } from '@/hooks/use-keyboard-shortcuts';
import { Button } from '@/components/ui/button';
import { cx } from '@/lib/design/cx';
```

### Naming Conventions

- **Components**: PascalCase (`WorkspaceShell`, `Button`)
- **Hooks**: camelCase with `use` prefix (`useKeyboardShortcuts`)
- **Types/Interfaces**: PascalCase with descriptive names
  - Types: `WorkspaceLocale`, `ChatRole`
  - Interfaces: `WorkRecord`, `ChapterRecord`
- **Functions**: camelCase, action verbs (`handleManualSave`, `deriveChapterSelection`)
- **Constants**: camelCase for local, UPPER_SNAKE for true constants
- **Files**: kebab-case for components/hooks (`workspace-shell.tsx`, `use-keyboard-shortcuts.ts`)
- **Server files**: Use descriptive suffixes (`-repository.ts`, `-service.ts`)

### Types & Interfaces

- Prefer `type` for simple unions and aliases
- Use `interface` for object shapes that may be extended
- Export types from `lib/contracts/*.ts`
- Use Zod for runtime validation with inferred types

```typescript
// contracts/workspace.ts
export type WorkspaceLocale = 'zh' | 'en' | 'ru';
export type ChatRole = 'system' | 'user' | 'assistant';

export interface ChapterRecord {
  id: string;
  workId: string;
  title: string;
  // ...
}
```

### Error Handling

- Use explicit error types in async functions
- Early returns for guard clauses
- Toast notifications for user-facing errors (`sonner` library)

```typescript
async function readJson<T>(response: Response) {
  const payload = (await response.json()) as T;
  if (!response.ok) throw new Error(JSON.stringify(payload));
  return payload;
}

// In components
try {
  await mutateWorkspace({ ... });
  setSaveState('saved');
  toast.success('Chapter saved.');
} catch (error) {
  setSaveState('failed');
  toast.error('Failed to save. Check connection.');
}
```

### React Components

- Use function declarations for components (not arrow functions)
- Destructure props in parameter list
- Group state hooks together
- Use `useCallback` for stable function references passed to children
- Client components marked with `'use client'`

```typescript
'use client';

export function Button({
  children,
  className,
  variant = 'outline',
  ...props
}: ButtonProps) {
  return (
    <button className={cx('button', className)} {...props}>
      {children}
    </button>
  );
}
```

### Server-Side Patterns

- Repository pattern for database access (`*-repository.ts`)
- Service layer for business logic (`*-service.ts`)
- Use Zod schemas for input validation
- Export typed functions, avoid default exports

```typescript
// Repository: direct DB operations
export function listChapters(workId: string): ChapterRecord[] { ... }

// Service: business logic + validation
export function applyWorkspaceMutation(payload: Mutation) { ... }
```

### Styling (Tailwind + Geist Design System)

- Use CSS variables from `globals.css` (prefixed with `--cn-`)
- Shadow-as-border technique: `shadow-[0_0_0_1px_rgba(0,0,0,0.08)]`
- Tailwind v4 syntax with `@theme` directive
- Component classes defined in `globals.css` `@layer components`
- Use `cx()` utility from `lib/design/cx.ts` for conditional classes
- Alternative: `cn()` from `lib/utils.ts` (uses clsx + tailwind-merge)

```typescript
import { cx } from '@/lib/design/cx';

// In JSX
<div className={cx(
  "app-sidebar sidebar-transition",
  isOpen ? "w-[240px] opacity-100" : "w-0 opacity-0"
)}>
```

### Testing

- Use Node.js native test runner (`node:test`)
- Import assertions from `node:assert/strict`
- Create temp directories for database tests
- Clean up temp files in finally blocks

```typescript
import test from "node:test";
import assert from "node:assert/strict";

test("database bootstrap creates tables", async () => {
  const dataDir = createTempDataDir();
  process.env.CATNOVEL_DATA_DIR = dataDir;
  // ... test code
  rmSync(dataDir, { recursive: true, force: true });
});
```

### File Organization

```
app/                    # Next.js App Router
  api/                  # API routes
  layout.tsx            # Root layout with Geist fonts
  globals.css           # Tailwind + design system CSS

components/             # React components
  ui/                   # Base UI components (Button, Input, etc.)
  workspace/            # Feature-specific components
  ai/                   # AI-related components
  settings/             # Settings components

hooks/                  # Custom React hooks
lib/                    # Utilities and server code
  contracts/            # TypeScript types/interfaces
  design/               # Design system utilities
  i18n/                 # Internationalization
  server/               # Server-only code
    ai/                 # AI providers
    exporters/          # Export functionality
    importers/          # Import functionality
    repositories/       # Database repositories
    services/           # Business logic services
db/                     # Database client and schema
hooks/                    # React hooks
tests/                    # Test files
```

### Git Workflow

- **Atomic commits**: Make small, focused commits that do one thing well
- **Complex changes**: Split large changes into multiple atomic commits by logical units
  - Example: Separate "add component" from "add styles" from "add tests"
- **Commit messages**: Use present tense, descriptive summaries (e.g., "Add chapter autosave feature")
- **Don't commit**: Never commit secrets, .env files, or credentials

### Key Configuration Files

- `next.config.ts` - Standalone output, typed routes, turbopack
- `tsconfig.json` - Strict mode, path aliases (`@/*`)
- `eslint.config.mjs` - Next.js core-web-vitals + typescript
- `components.json` - shadcn/ui configuration
- `package.json` - pnpm package manager specified

### Design System Reference

See `DESIGN.md` for the complete Vercel/Geist design system specification:
- Colors: `--cn-bg`, `--cn-text`, `--cn-blue`, etc.
- Typography: Geist Sans (primary), Geist Mono (code)
- Shadows: Multi-layer shadow stacks for depth
- Spacing: 8px base unit, scale: 1,2,4,8,12,16,32...
