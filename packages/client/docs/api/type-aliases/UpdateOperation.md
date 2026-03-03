[**@cqrs-toolkit/client**](../README.md)

---

[@cqrs-toolkit/client](../README.md) / UpdateOperation

# Type Alias: UpdateOperation\<T\>

> **UpdateOperation**\<`T`\> = \{ `data`: `T`; `type`: `"set"`; \} \| \{ `data`: `Partial`\<`T`\>; `type`: `"merge"`; \} \| \{ `type`: `"delete"`; \}

Defined in: packages/client/src/core/event-processor/types.ts:11

Read model update operation.

## Type Parameters

### T

`T`
