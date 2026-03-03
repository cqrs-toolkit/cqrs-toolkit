[**@cqrs-toolkit/client**](../README.md)

---

[@cqrs-toolkit/client](../README.md) / EventProcessorRunner

# Class: EventProcessorRunner

Defined in: packages/client/src/core/event-processor/EventProcessorRunner.ts:37

Event processor runner.

## Constructors

### Constructor

> **new EventProcessorRunner**(`config`): `EventProcessorRunner`

Defined in: packages/client/src/core/event-processor/EventProcessorRunner.ts:42

#### Parameters

##### config

[`EventProcessorRunnerConfig`](../interfaces/EventProcessorRunnerConfig.md)

#### Returns

`EventProcessorRunner`

## Methods

### processEvent()

> **processEvent**(`event`): `Promise`\<`string`[]\>

Defined in: packages/client/src/core/event-processor/EventProcessorRunner.ts:54

Process an event and apply updates to the read model store.

#### Parameters

##### event

[`ParsedEvent`](../interfaces/ParsedEvent.md)

Parsed event to process

#### Returns

`Promise`\<`string`[]\>

IDs of updated read models

---

### processEvents()

> **processEvents**(`events`): `Promise`\<`string`[]\>

Defined in: packages/client/src/core/event-processor/EventProcessorRunner.ts:102

Process multiple events in order.

#### Parameters

##### events

[`ParsedEvent`](../interfaces/ParsedEvent.md)[]

Events to process

#### Returns

`Promise`\<`string`[]\>

Total IDs updated
