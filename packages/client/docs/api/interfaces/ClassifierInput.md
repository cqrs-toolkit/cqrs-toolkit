[**@cqrs-toolkit/client**](../README.md)

---

[@cqrs-toolkit/client](../globals.md) / ClassifierInput

# Interface: ClassifierInput\<TLink, TCommand, TEvent\>

Wrapper passed to CommandHandlerRegistration.classifyDependency
carrying a command record and its events at evaluation time.

The `events` array contains:

- For a still-pending / sending / cancelled-before-send / failed-at-server
  command: the anticipated events generated at enqueue (cached until the
  cascade evaluates).
- For a succeeded command: its persisted server events.
- For a command that never persisted (submit-time validation or handler
  rejection): an empty array.

`CommandRecord` itself carries `serverResponse?` but not events, which is
why a wrapper is necessary.

## Type Parameters

### TLink

`TLink` _extends_ `Link`

### TCommand

`TCommand` _extends_ [`EnqueueCommand`](EnqueueCommand.md)

### TEvent

`TEvent` _extends_ [`IAnticipatedEvent`](IAnticipatedEvent.md)

## Properties

### command

> **command**: [`CommandRecord`](CommandRecord.md)\<`TLink`, `TCommand`\>

---

### events

> **events**: `TEvent`[]
