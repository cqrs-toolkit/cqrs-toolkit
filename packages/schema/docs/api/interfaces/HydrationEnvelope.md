[**@cqrs-toolkit/schema**](../README.md)

---

[@cqrs-toolkit/schema](../README.md) / HydrationEnvelope

# Interface: HydrationEnvelope

## Properties

### paths

> `readonly` **paths**: readonly `string`[]

All paths needing hydration, including ones containing `*` segments.

---

### starMap

> `readonly` **starMap**: `ReadonlyMap`\<`string`, readonly `string`[]\>

Maps each `*` path prefix to property keys the hydrator must skip.
When the hydrator encounters a `*` segment in a path, it looks up the `*` prefix
here to know which object keys are statically defined properties (not dynamic keys).
