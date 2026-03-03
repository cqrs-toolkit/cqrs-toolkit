[**@cqrs-toolkit/client**](../README.md)

---

[@cqrs-toolkit/client](../README.md) / ServerEvent

# Type Alias: ServerEvent\<TPayload\>

> **ServerEvent**\<`TPayload`\> = [`BaseEvent`](../interfaces/BaseEvent.md)\<`TPayload`\> & [`PermanentEventMeta`](../interfaces/PermanentEventMeta.md) \| [`StatefulEventMeta`](../interfaces/StatefulEventMeta.md)

Defined in: packages/client/src/types/events.ts:69

Server event (Permanent or Stateful).

## Type Parameters

### TPayload

`TPayload` = `unknown`
