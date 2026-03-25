[**@cqrs-toolkit/client**](../README.md)

---

[@cqrs-toolkit/client](../globals.md) / CommandHandlerRegistration

# Interface: CommandHandlerRegistration\<TLink, TSchema, TEvent\>

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

Uses method syntax for `handler` and `validate` so that registrations with
specific data types are assignable to `CommandHandlerRegistration[]`
(bivariant parameter checking — same pattern as ProcessorRegistration).

## Type Parameters

### TLink

`TLink` _extends_ `Link`

### TSchema

`TSchema` = `unknown`

Schema type for structural validation (JSONSchema7, z.ZodType, etc.).

### TEvent

`TEvent` _extends_ [`IAnticipatedEvent`](IAnticipatedEvent.md) = [`IAnticipatedEvent`](IAnticipatedEvent.md)

Anticipated event type produced by the handler.

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

Cross-aggregate parent references. Each entry maps a data field to the command that produces the ID.

---

### schema?

> `optional` **schema**: `TSchema`

Phase 1: structural schema validation (library-driven).

## Methods

### handler()

> **handler**(`data`, `context`): [`DomainExecutionResult`](../type-aliases/DomainExecutionResult.md)\<`TEvent`\>

Phase 4: produce anticipated events from validated data.

#### Parameters

##### data

`unknown`

##### context

[`HandlerContext`](../type-aliases/HandlerContext.md)

#### Returns

[`DomainExecutionResult`](../type-aliases/DomainExecutionResult.md)\<`TEvent`\>

---

### validate()?

> `optional` **validate**(`data`): `Result`\<`unknown`, `ValidationException`\<[`ValidationError`](ValidationError.md)[]\>\>

Phase 2: custom sync validation for rules the schema can't cover.

#### Parameters

##### data

`unknown`

#### Returns

`Result`\<`unknown`, `ValidationException`\<[`ValidationError`](ValidationError.md)[]\>\>

---

### validateAsync()?

> `optional` **validateAsync**(`data`, `context`): `Promise`\<`Result`\<`unknown`, `ValidationException`\<[`ValidationError`](ValidationError.md)[]\>\>\>

Phase 3: async validation querying local data (permissions, name conflicts, etc.).

#### Parameters

##### data

`unknown`

##### context

[`AsyncValidationContext`](AsyncValidationContext.md)\<`TLink`\>

#### Returns

`Promise`\<`Result`\<`unknown`, `ValidationException`\<[`ValidationError`](ValidationError.md)[]\>\>\>
