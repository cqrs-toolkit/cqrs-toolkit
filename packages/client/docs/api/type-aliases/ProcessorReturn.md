[**@cqrs-toolkit/client**](../README.md)

---

[@cqrs-toolkit/client](../globals.md) / ProcessorReturn

# Type Alias: ProcessorReturn\<TModel\>

> **ProcessorReturn**\<`TModel`\> = [`ProcessorResult`](../interfaces/ProcessorResult.md)\<`TModel`\>[] \| [`ProcessorResult`](../interfaces/ProcessorResult.md)\<`TModel`\> \| [`InvalidateSignal`](../interfaces/InvalidateSignal.md) \| `undefined`

Possible return values from an event processor.

## Type Parameters

### TModel

`TModel` _extends_ `object` = `Record`\<`string`, `unknown`\>
