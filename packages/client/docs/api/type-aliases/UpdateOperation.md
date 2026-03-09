[**@cqrs-toolkit/client**](../README.md)

---

[@cqrs-toolkit/client](../globals.md) / UpdateOperation

# Type Alias: UpdateOperation\<T\>

> **UpdateOperation**\<`T`\> = \{ `data`: `T`; `type`: `"set"`; \} \| \{ `data`: `Partial`\<`T`\>; `type`: `"merge"`; \} \| \{ `type`: `"delete"`; \}

Read model update operation.

## Type Parameters

### T

`T` _extends_ `object`
