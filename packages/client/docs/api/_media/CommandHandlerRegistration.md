[**@cqrs-toolkit/client**](../README.md)

---

[@cqrs-toolkit/client](../globals.md) / CommandHandlerRegistration

# Interface: CommandHandlerRegistration\<TEvent\>

Registration for a single command handler.

Uses method syntax for `handler` so that registrations with specific
payload types are assignable to `CommandHandlerRegistration[]`
(bivariant parameter checking — same pattern as ProcessorRegistration).

## Type Parameters

### TEvent

`TEvent` = `unknown`

## Properties

### commandType

> **commandType**: `string`

Command type this handler processes

---

### creates?

> `optional` **creates**: [`CreateCommandConfig`](CreateCommandConfig.md)

If this command creates a new aggregate, configure how to extract the server ID.

---

### parentRef?

> `optional` **parentRef**: `ParentRefConfig`[]

Cross-aggregate parent references. Each entry maps a payload field to the command that produces the ID.

---

### revisionField?

> `optional` **revisionField**: `string`

Payload field name that holds the revision for optimistic concurrency. Absent for creates.

## Methods

### handler()

> **handler**(`payload`): [`DomainExecutionResult`](../type-aliases/DomainExecutionResult.md)\<`TEvent`\>

Validate payload and produce anticipated events

#### Parameters

##### payload

`unknown`

#### Returns

[`DomainExecutionResult`](../type-aliases/DomainExecutionResult.md)\<`TEvent`\>
