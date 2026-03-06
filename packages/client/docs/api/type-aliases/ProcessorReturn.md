[**@cqrs-toolkit/client**](../README.md)

---

[@cqrs-toolkit/client](../globals.md) / ProcessorReturn

# Type Alias: ProcessorReturn\<TModel\>

> **ProcessorReturn**\<`TModel`\> = [`ProcessorResult`](../interfaces/ProcessorResult.md)\<`TModel`\>[] \| [`ProcessorResult`](../interfaces/ProcessorResult.md)\<`TModel`\> \| [`InvalidateSignal`](../interfaces/InvalidateSignal.md) \| `undefined`

Defined in: [packages/client/src/core/event-processor/types.ts:40](https://github.com/Swifttt-Dev/cqrs-toolkit/blob/93be80a21907f07a104ca0e358c4b366dbf08b7d/packages/client/src/core/event-processor/types.ts#L40)

Possible return values from an event processor.

## Type Parameters

### TModel

`TModel` _extends_ `object` = `Record`\<`string`, `unknown`\>
