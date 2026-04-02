[**@cqrs-toolkit/client**](../README.md)

---

[@cqrs-toolkit/client](../globals.md) / CommandHandlerRegistration

# Type Alias: CommandHandlerRegistration\<TLink, TCommand, TSchema, TEvent\>

> **CommandHandlerRegistration**\<`TLink`, `TCommand`, `TSchema`, `TEvent`\> = `TCommand` _extends_ infer C ? `object` : `never`

Registration for a single command handler.

Command handling pipeline (all phases except `handler` are optional):

1. `schema` — structural validation via the configured `SchemaValidator`.
   The library calls the validator automatically. No consumer code needed.
2. `validate` — custom sync validation for rules the schema can't express
   (cross-field constraints, enum membership, etc.). Like `zod.refine()`.
3. `handler` — event generation from validated data. Will be migrated to
   `generateEvents` in a future phase.

Phases 1-2 only run on initial execution (`'initializing'`), not on
regeneration (`'updating'`). Each phase may transform the data; the
transformed output is passed to subsequent phases and persisted.

Schema validation is opt-in. Consumers can validate in their own UI forms
before submitting, use the `validate` step, or rely on schema validation.

Distributive conditional type: when TCommand is a union, each member produces
its own registration variant with `commandType` and `handler(data)` correctly paired.

## Type Parameters

### TLink

`TLink` _extends_ `Link`

### TCommand

`TCommand` _extends_ [`EnqueueCommand`](../interfaces/EnqueueCommand.md) = [`EnqueueCommand`](../interfaces/EnqueueCommand.md)

### TSchema

`TSchema` = `unknown`

Schema type for structural validation (JSONSchema7, z.ZodType, etc.).

### TEvent

`TEvent` _extends_ [`IAnticipatedEvent`](../interfaces/IAnticipatedEvent.md) = [`IAnticipatedEvent`](../interfaces/IAnticipatedEvent.md)

Anticipated event type produced by the handler.
