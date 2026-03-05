[**@cqrs-toolkit/client**](../README.md)

---

[@cqrs-toolkit/client](../globals.md) / startSharedWorker

# Function: startSharedWorker()

> **startSharedWorker**(`config`): `void`

Defined in: packages/client/src/adapters/worker-core/startSharedWorker.ts:46

Bootstrap a SharedWorker with CQRS orchestration.

Creates the message handler and orchestrator, sets up connection handling,
and starts liveness checks for dead windows. The main thread's adapter
calls `orchestrator.initialize` to trigger component creation, passing
the sqlite worker URL as an RPC argument.

## Parameters

### config

[`CqrsConfig`](../interfaces/CqrsConfig.md)

Shared CQRS config (same object the main thread uses)

## Returns

`void`
