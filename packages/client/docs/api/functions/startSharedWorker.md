[**@cqrs-toolkit/client**](../README.md)

---

[@cqrs-toolkit/client](../globals.md) / startSharedWorker

# Function: startSharedWorker()

> **startSharedWorker**(`config`): `void`

Defined in: [packages/client/src/adapters/worker-core/startSharedWorker.ts:106](https://github.com/Swifttt-Dev/cqrs-toolkit/blob/93be80a21907f07a104ca0e358c4b366dbf08b7d/packages/client/src/adapters/worker-core/startSharedWorker.ts#L106)

Bootstrap a SharedWorker with CQRS orchestration.

Creates the message handler, orchestrator, and coordinator logic for
managing per-tab SQLite workers and active tab routing.

## Parameters

### config

[`CqrsConfig`](../interfaces/CqrsConfig.md)

Shared CQRS config (same object the main thread uses)

## Returns

`void`
