[**@cqrs-toolkit/client**](../README.md)

---

[@cqrs-toolkit/client](../globals.md) / SubmitSuccess

# Type Alias: SubmitSuccess\<TResponse\>

> **SubmitSuccess**\<`TResponse`\> = \{ `commandId`: `string`; `stage`: `"enqueued"`; \} \| \{ `commandId`: `string`; `response`: `TResponse`; `stage`: `"confirmed"`; \}

Successful submit result — discriminated by lifecycle stage.

- `'enqueued'` — command persisted locally, server sync pending (offline or unauthenticated).
- `'confirmed'` — server acknowledged the command.

## Type Parameters

### TResponse

`TResponse`
