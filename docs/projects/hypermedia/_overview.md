# @cqrs-toolkit/hypermedia

**Status:** Active
**Castle:** this directory
**Public API:** experimental
**Depends on (within repo):** `schema`
**Depended on by (within repo):** `hypermedia-cli`, `hypermedia-client`; demos: `hypermedia-server`

## Purpose

CQRS-aware Hydra API documentation, HAL rendering, content negotiation, and embed planning for server-side hypermedia APIs.
Define versioned command and query surfaces with `HydraDoc`; render HAL+JSON responses with embedded resources and CURIEs; negotiate profiles via HTTP headers; plan command validation pipelines; resolve `?include=` tokens into parallel data loads.

## Current state

Five entry points: core types (`HydraDoc`, `HAL`, embed spec types); server utilities (profile negotiation, command/embed planning, formatting, exceptions); a Fastify dev-server plugin (`createMetaPlugin`) that serves generated apidoc/openapi/schemas; build-time tooling (Hydra ApiDocumentation and OpenAPI generation, including HTTP request/response header documentation); and configuration types (`HydraConfig`, `OpenApiConfig`) for `cqrs-toolkit server` commands.

## Where things live

- Code: `packages/hypermedia/`
- Unit tests: `packages/hypermedia/src/**/*.test.ts` (beside source)
- Generated API docs: `packages/hypermedia/docs/api/`
- Public consumer-facing intro: `packages/hypermedia/README.md`
- Package operational guidance: `packages/hypermedia/CLAUDE.md`
