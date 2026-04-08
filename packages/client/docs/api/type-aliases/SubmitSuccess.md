[**@cqrs-toolkit/client**](../README.md)

---

[@cqrs-toolkit/client](../globals.md) / SubmitSuccess

# Type Alias: SubmitSuccess\<TResponse\>

> **SubmitSuccess**\<`TResponse`\> = \{ `commandId`: `string`; `entityRef?`: [`EntityRef`](../interfaces/EntityRef.md); `stage`: `"enqueued"`; \} \| \{ `commandId`: `string`; `entityRef?`: [`EntityRef`](../interfaces/EntityRef.md); `response`: `TResponse`; `stage`: `"confirmed"`; \}

Successful submit result — discriminated by lifecycle stage.

- `'enqueued'` — command persisted locally, server sync pending (offline or unauthenticated).
- `'confirmed'` — server acknowledged the command.

## Type Parameters

### TResponse

`TResponse`
