[**@cqrs-toolkit/client**](../README.md)

---

[@cqrs-toolkit/client](../globals.md) / SessionManagerConfig

# Interface: SessionManagerConfig\<TLink, TCommand\>

Session manager configuration.

## Type Parameters

### TLink

`TLink` _extends_ `Link`

### TCommand

`TCommand` _extends_ [`EnqueueCommand`](EnqueueCommand.md)

## Properties

### eventBus

> **eventBus**: [`EventBus`](../classes/EventBus.md)\<`TLink`\>

---

### storage

> **storage**: [`IStorage`](IStorage.md)\<`TLink`, `TCommand`\>
