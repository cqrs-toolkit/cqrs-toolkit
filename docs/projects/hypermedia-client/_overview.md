# @cqrs-toolkit/hypermedia-client

**Status:** Active
**Castle:** this directory
**Public API:** experimental
**Depends on (within repo):** `client`, `hypermedia`
**Depended on by (within repo):** `hypermedia-cli`; demos: `hypermedia-base`

## Purpose

Client-side counterpart to `@cqrs-toolkit/hypermedia`.
Consumes hypermedia API surfaces (Hydra/HAL) on the client, integrates with the offline-first CQRS client to drive command surfaces, embed planning, and read-model seeding from server-described shapes.

## Current state

Two consumer-facing entry points (`.` runtime helpers, `./config` consumer config types for `cqrs-hypermedia.config.ts`) plus one private seam (`./internals`) that exposes the CLI logic to `hypermedia-cli`.
Runtime surface includes a hypermedia-driven command sender, `createCollection` for read-model wiring, AJV-backed schema validators with a `SchemaRegistry`, event-page and stream-event fetch helpers, and a presigned-upload handler.
The `cli/` tree houses the apidoc-parsing, code-generation, and `init`/`pull` workflows that the CLI tool drives.

## Where things live

- Code: `packages/hypermedia-client/`
- Unit tests: `packages/hypermedia-client/src/**/*.test.ts` (beside source)
- Generated API docs: `packages/hypermedia-client/docs/api/`
- Public consumer-facing intro: `packages/hypermedia-client/README.md`
- Package operational guidance: `packages/hypermedia-client/CLAUDE.md`
