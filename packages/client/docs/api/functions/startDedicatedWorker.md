[**@cqrs-toolkit/client**](../README.md)

---

[@cqrs-toolkit/client](../globals.md) / startDedicatedWorker

# Function: startDedicatedWorker()

> **startDedicatedWorker**(`config`): `void`

Defined in: packages/client/src/adapters/worker-core/startDedicatedWorker.ts:35

Bootstrap a Dedicated Worker with CQRS orchestration.

Creates the message handler and orchestrator, sets up message handling,
and signals readiness to the main thread. The main thread's adapter
calls `orchestrator.initialize` to trigger component creation.

## Parameters

### config

[`CqrsConfig`](../interfaces/CqrsConfig.md)

Shared CQRS config (same object the main thread uses)

## Returns

`void`
