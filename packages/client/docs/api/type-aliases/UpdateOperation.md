[**@cqrs-toolkit/client**](../README.md)

---

[@cqrs-toolkit/client](../globals.md) / UpdateOperation

# Type Alias: UpdateOperation\<T\>

> **UpdateOperation**\<`T`\> = \{ `data`: `T`; `type`: `"set"`; \} \| \{ `data`: `Partial`\<`T`\>; `type`: `"merge"`; \} \| \{ `type`: `"delete"`; \}

Read model update operation.

- `set`: Replace the entire read model with `data`.
- `merge`: Shallow-merge `data` into the existing read model (`{ ...existing, ...data }`).
  Each property value must be the **complete new value** for that property — the store
  replaces the property wholesale, it does not deep-merge nested objects or arrays.
  Use this when only a subset of properties changed and the processor has computed their
  full new values (e.g., a complete replacement `tags` array, not an append delta).
  To unset a property, set it to `null` explicitly — `undefined` values are ignored
  by the shallow spread and will not remove existing properties.
- `delete`: Remove the read model entirely.

## Type Parameters

### T

`T` _extends_ `object`
