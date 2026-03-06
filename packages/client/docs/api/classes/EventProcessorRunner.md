[**@cqrs-toolkit/client**](../README.md)

---

[@cqrs-toolkit/client](../globals.md) / EventProcessorRunner

# Class: EventProcessorRunner

Defined in: [packages/client/src/core/event-processor/EventProcessorRunner.ts:53](https://github.com/Swifttt-Dev/cqrs-toolkit/blob/93be80a21907f07a104ca0e358c4b366dbf08b7d/packages/client/src/core/event-processor/EventProcessorRunner.ts#L53)

Event processor runner.

## Constructors

### Constructor

> **new EventProcessorRunner**(`config`): `EventProcessorRunner`

Defined in: [packages/client/src/core/event-processor/EventProcessorRunner.ts:58](https://github.com/Swifttt-Dev/cqrs-toolkit/blob/93be80a21907f07a104ca0e358c4b366dbf08b7d/packages/client/src/core/event-processor/EventProcessorRunner.ts#L58)

#### Parameters

##### config

[`EventProcessorRunnerConfig`](../interfaces/EventProcessorRunnerConfig.md)

#### Returns

`EventProcessorRunner`

## Methods

### processEvent()

> **processEvent**(`event`): `Promise`\<[`ProcessEventResult`](../interfaces/ProcessEventResult.md)\>

Defined in: [packages/client/src/core/event-processor/EventProcessorRunner.ts:70](https://github.com/Swifttt-Dev/cqrs-toolkit/blob/93be80a21907f07a104ca0e358c4b366dbf08b7d/packages/client/src/core/event-processor/EventProcessorRunner.ts#L70)

Process an event and apply updates to the read model store.

#### Parameters

##### event

[`ParsedEvent`](../interfaces/ParsedEvent.md)

Parsed event to process

#### Returns

`Promise`\<[`ProcessEventResult`](../interfaces/ProcessEventResult.md)\>

IDs of updated read models and whether any processor signalled invalidation

---

### processEvents()

> **processEvents**(`events`): `Promise`\<[`ProcessEventResult`](../interfaces/ProcessEventResult.md)\>

Defined in: [packages/client/src/core/event-processor/EventProcessorRunner.ts:120](https://github.com/Swifttt-Dev/cqrs-toolkit/blob/93be80a21907f07a104ca0e358c4b366dbf08b7d/packages/client/src/core/event-processor/EventProcessorRunner.ts#L120)

Process multiple events in order.

#### Parameters

##### events

[`ParsedEvent`](../interfaces/ParsedEvent.md)[]

Events to process

#### Returns

`Promise`\<[`ProcessEventResult`](../interfaces/ProcessEventResult.md)\>

Aggregated result across all events
