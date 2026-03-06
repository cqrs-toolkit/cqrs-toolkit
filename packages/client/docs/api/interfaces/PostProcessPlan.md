[**@cqrs-toolkit/client**](../README.md)

---

[@cqrs-toolkit/client](../globals.md) / PostProcessPlan

# Interface: PostProcessPlan

Defined in: [packages/client/src/types/domain.ts:20](https://github.com/Swifttt-Dev/cqrs-toolkit/blob/master/packages/client/src/types/domain.ts#L20)

Post-processing plan for after server confirmation.
Used for temp ID replacement, cleanup, etc.

## Indexable

\[`key`: `string`\]: `unknown`

Additional plan-specific data

## Properties

### kind

> **kind**: `string`

Defined in: [packages/client/src/types/domain.ts:22](https://github.com/Swifttt-Dev/cqrs-toolkit/blob/master/packages/client/src/types/domain.ts#L22)

Plan type identifier

---

### tempIds?

> `optional` **tempIds**: `Record`\<`string`, `string`\>

Defined in: [packages/client/src/types/domain.ts:24](https://github.com/Swifttt-Dev/cqrs-toolkit/blob/master/packages/client/src/types/domain.ts#L24)

Mapping of temporary IDs to placeholders
