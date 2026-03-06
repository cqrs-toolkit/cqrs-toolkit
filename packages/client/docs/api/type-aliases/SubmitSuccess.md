[**@cqrs-toolkit/client**](../README.md)

---

[@cqrs-toolkit/client](../globals.md) / SubmitSuccess

# Type Alias: SubmitSuccess\<TResponse\>

> **SubmitSuccess**\<`TResponse`\> = \{ `commandId`: `string`; `stage`: `"enqueued"`; \} \| \{ `commandId`: `string`; `response`: `TResponse`; `stage`: `"confirmed"`; \}

Defined in: [packages/client/src/types/commands.ts:297](https://github.com/Swifttt-Dev/cqrs-toolkit/blob/93be80a21907f07a104ca0e358c4b366dbf08b7d/packages/client/src/types/commands.ts#L297)

Successful submit result — discriminated by lifecycle stage.

- `'enqueued'` — command persisted locally, server sync pending (offline or unauthenticated).
- `'confirmed'` — server acknowledged the command.

## Type Parameters

### TResponse

`TResponse`
