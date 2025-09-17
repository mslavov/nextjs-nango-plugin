# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Common Development Commands

### Build & Development
- `npm run build` - Build the TypeScript plugin for distribution
- `npm run dev` - Watch mode for development (auto-rebuild on changes)
- `npm test` - Run all Jest tests
- `npm test -- --watch` - Run tests in watch mode
- `npm test -- <filename>` - Run specific test file

### Example App Commands
In the `examples/nextjs-example` directory:
- `npm run dev` - Start Next.js dev server with Turbopack
- `npm run build` - Build the Next.js application
- `npm run lint` - Run ESLint

## Architecture Overview

This is a Next.js plugin that provides seamless OAuth integration via Nango with database-agnostic architecture through dependency injection.

### Core Design Pattern: Dependency Injection
The plugin uses a factory pattern where users provide a `createConnectionService` function that returns a `ConnectionService` implementation. This allows complete flexibility in:
- Database choice (Supabase, Prisma, MongoDB, any ORM)
- Authentication method (NextAuth, Supabase Auth, custom)
- Ownership model (user-based, team-based, organization-based)

### Key Components

**Handler Layer** (`src/handler.ts`)
- Creates unified API route handlers for Next.js App Router
- Routes: `/api/nango/connections`, `/api/nango/integrations`, `/api/nango/auth/session`, `/api/nango/webhooks`
- Injects request context to `createConnectionService` for auth extraction

**Service Interfaces**
- `ConnectionService` (`src/lib/types/connection-service.ts`) - Database operations interface that users implement
- `NangoService` (`src/lib/nango/client.ts`) - Wraps Nango API calls with proper typing

**React Components**
- `ConnectionManager` (`src/components/ConnectionManager.tsx`) - Main UI component for managing OAuth connections
- `IntegrationCard` (`src/components/IntegrationCard.tsx`) - Individual provider cards with automatic metadata fetching

**Webhook System** (`src/lib/webhooks/handler.ts`)
- Processes Nango webhook events with signature verification
- Updates connection statuses based on OAuth events

### Testing Strategy
- Unit tests for all services using Jest and React Testing Library
- Mock implementations for testing without external dependencies
- Test files co-located with source files (`.test.ts` suffix)

### CLI Tool (`cli/commands/init.ts`)
Interactive setup wizard that:
1. Detects Next.js project structure (App Router vs Pages)
2. Generates database adapter based on selection
3. Creates API routes and configuration files
4. Sets up environment variables

## Important Implementation Notes

- The plugin avoids importing from `next/server` directly to maintain compatibility
- Uses Web API Response objects for route handlers
- All database operations go through the injected ConnectionService
- Provider list is dynamic - fetched from Nango, not hardcoded
- Webhook signature verification is optional but recommended for production
- When making changes to the plugin, make sure tests are updated as well, the llm.txt file and the README.md file.
- When we are done with major changes and refactorings, update the version of the package in package.json and the llm.txt, publish to npm, and push to git.