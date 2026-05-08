# @cqrs-toolkit/hypermedia-cli

**Status:** Active
**Castle:** this directory
**Public API:** experimental
**Depends on (within repo):** `hypermedia`, `hypermedia-client`
**Depended on by (within repo):** demos: `hypermedia-base`, `hypermedia-server`

## Purpose

CLI for hypermedia tooling — invocation surface for build-time / dev-time hypermedia operations.

## Current state

Two consumer-facing exports (`.` exposing a slim `loadConfigFile` helper for advanced consumers, `./config` exposing the `defineConfig` / `ToolkitConfig` type-helper for `cqrs-toolkit.config.ts` files), plus a binary published as both `cqrs-toolkit` and `cqrs`.
The CLI exposes two command groups: `server` (`docs`, `build`) for hypermedia documentation generation, and `client` (`init`, `pull`) for typed client code generation.
Almost all logic is delegated through dynamic imports — `client` commands run from `@cqrs-toolkit/hypermedia-client/internals`; `server` commands run from `@cqrs-toolkit/hypermedia/builder`. The CLI itself is thin: argv parsing plus dispatch.

## Where things live

- Code: `packages/hypermedia-cli/`
- Bin entry: `packages/hypermedia-cli/bin/cqrs-toolkit.js`
- Package operational guidance: `packages/hypermedia-cli/CLAUDE.md`
