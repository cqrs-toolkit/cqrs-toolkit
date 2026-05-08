# Hypermedia demo

**Status:** Active
**Castle:** this directory
**Public API:** N/A
**Composing demo packages:** `demos/hypermedia-base`, `demos/hypermedia-server`, `demos/hypermedia-web`
**Depends on (within repo):** `client`, `client-solid`, `demo-base`, `hypermedia`, `hypermedia-client`, `hypermedia-cli`, `realtime`, `schema`
**Depended on by (within repo):** none — terminal consumer

## Purpose

End-to-end reference implementation of the hypermedia stack — server-side Hydra/HAL rendering, client-side hypermedia consumption, and the CLI tooling that joins them at build time.
Exercises `@cqrs-toolkit/hypermedia` and `@cqrs-toolkit/hypermedia-client` together with the core CQRS client.

## Current state

Three composing demo packages: `hypermedia-base` (Solid app skeleton, also reused by the Electron sub-project), `hypermedia-server` (Fastify server on port 3002 with Hydra/HAL rendering and OpenAPI generation), `hypermedia-web` (Vite SPA consumer on port 5175 proxying to the server).
Uses the same default-shared-worker execution mode as the todo demo.

## Where things live

- Server unit tests: `demos/hypermedia-server/src/**/*.test.ts` (beside source)
- Web e2e tests: `demos/hypermedia-web/src/**/tests/*.e2e.ts`
- Run web: `npm run dev -w @cqrs-toolkit/hypermedia-web` (starts both server and Vite)
- Run server only: `npm run server -w @cqrs-toolkit/hypermedia-server`
