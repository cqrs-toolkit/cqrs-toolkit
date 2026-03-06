[**@cqrs-toolkit/client**](../README.md)

---

[@cqrs-toolkit/client](../globals.md) / startDedicatedWorker

# Function: startDedicatedWorker()

> **startDedicatedWorker**(`config`): `void`

Defined in: [packages/client/src/adapters/worker-core/startDedicatedWorker.ts:36](https://github.com/Swifttt-Dev/cqrs-toolkit/blob/93be80a21907f07a104ca0e358c4b366dbf08b7d/packages/client/src/adapters/worker-core/startDedicatedWorker.ts#L36)

Bootstrap a Dedicated Worker with CQRS orchestration.

Creates the message handler and orchestrator, registers lifecycle RPC
methods, sets up message handling, and signals readiness to the main
thread. The main thread's adapter calls `orchestrator.initialize` to
trigger component creation (includes OPFS probe for Mode B).

## Parameters

### config

[`CqrsConfig`](../interfaces/CqrsConfig.md)

Shared CQRS config (same object the main thread uses)

## Returns

`void`
