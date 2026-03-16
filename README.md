# cqrs-toolkit

Shared CQRS client and server utilities.
TypeScript monorepo using npm workspaces.

> [!WARNING]
> **This project is in active pre-release development.**
> The public API is unstable and subject to breaking changes without notice.
> Do not use in production.
>
> The client-side SQLite schema is not yet finalized.
> The initial migration may change before the first stable release, at which point normal migration behavior will apply.
> Until then, upgrading the library may require clearing OPFS data in the browser to avoid schema mismatches.

## Prerequisites

- Node.js >= 20.12.0

## Setup

```bash
npm install
```

## Packages

| Package                | Description                                      |
| ---------------------- | ------------------------------------------------ |
| `@cqrs-toolkit/client` | Offline-first CQRS/event-sourcing client library |

## Development

```bash
# Build all packages
npm run build -w @cqrs-toolkit/client

# Type-check a package without emitting
npm run compile -w @cqrs-toolkit/client

# Run all unit tests
npm test -- --run

# Run a specific test file
npm test -- --run packages/client/src/path/to/file.test.ts

# Format all files
npm run format:all

# Format only git-changed files (requires at least one commit)
npm run format
```

## Demos

### Todo Demo

A full-stack SolidJS + Fastify todo app that demonstrates `@cqrs-toolkit/client`.

```bash
# Start both the Fastify server (port 3001) and Vite dev server (port 5173)
npm run dev -w @cqrs-toolkit/todo-demo
```

Open http://localhost:5173 in your browser.

To start just the API server:

```bash
npm run server -w @cqrs-toolkit/todo-demo
```

The adapter mode defaults to `auto`, which selects the best mode the browser supports.
Append `?mode=<mode>` to force a specific mode (`shared-worker`, `dedicated-worker`, or `online-only`); the app will fail to start if the requested mode is not available.
Passing `auto` explicitly is also supported for clarity.
