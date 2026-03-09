[**@cqrs-toolkit/client**](../README.md)

---

[@cqrs-toolkit/client](../globals.md) / startSharedWorker

# Function: startSharedWorker()

> **startSharedWorker**(`config`): `void`

Bootstrap a SharedWorker with CQRS orchestration.

Creates the message handler, orchestrator, and coordinator logic for
managing per-tab SQLite workers and active tab routing.

## Parameters

### config

[`CqrsConfig`](../interfaces/CqrsConfig.md)

Shared CQRS config (same object the main thread uses)

## Returns

`void`
