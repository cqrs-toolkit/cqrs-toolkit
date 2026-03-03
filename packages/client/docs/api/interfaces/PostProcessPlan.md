[**@cqrs-toolkit/client**](../README.md)

***

[@cqrs-toolkit/client](../globals.md) / PostProcessPlan

# Interface: PostProcessPlan

Defined in: packages/client/src/types/domain.ts:12

Post-processing plan for after server confirmation.
Used for temp ID replacement, cleanup, etc.

## Indexable

\[`key`: `string`\]: `unknown`

Additional plan-specific data

## Properties

### kind

> **kind**: `string`

Defined in: packages/client/src/types/domain.ts:14

Plan type identifier

***

### tempIds?

> `optional` **tempIds**: `Record`\<`string`, `string`\>

Defined in: packages/client/src/types/domain.ts:16

Mapping of temporary IDs to placeholders
