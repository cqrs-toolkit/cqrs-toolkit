# cqrs-toolkit

Shared CQRS client and server utilities.
TypeScript monorepo using npm workspaces.

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

The adapter mode defaults to `online-only`.
Set the `VITE_CQRS_MODE` env var to `main-thread` for persistent local storage.
