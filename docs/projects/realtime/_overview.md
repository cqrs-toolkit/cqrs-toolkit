# @cqrs-toolkit/realtime

**Status:** Active
**Castle:** this directory
**Public API:** experimental
**Depends on (within repo):** none
**Depended on by (within repo):** `client`; demos: `hypermedia-server`, `todo-demo`

## Purpose

Canonical WebSocket message protocol types and serialisation helpers for CQRS real-time event streaming.
Defines a topic-based pub/sub protocol between clients and servers using discriminated unions for type-safe message handling.
Parsing is defensive — malformed input returns `undefined` rather than throwing.

## Current state

Protocol shipped: client→server (subscribe / unsubscribe), server→client (connected / subscribed / unsubscribed / subscription_denied / subscription_revoked / event / heartbeat).
Strict client-message parsing; defensive server-message parsing (discriminant check only).

## Where things live

- Code: `packages/realtime/`
- Unit tests: `packages/realtime/src/**/*.test.ts` (beside source)
- Generated API docs: `packages/realtime/docs/api/`
- Public consumer-facing intro: `packages/realtime/README.md`
- Package operational guidance: `packages/realtime/CLAUDE.md`
