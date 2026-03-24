[**@cqrs-toolkit/client**](../README.md)

---

[@cqrs-toolkit/client](../globals.md) / SchemaValidator

# Interface: SchemaValidator\<TSchema\>

Pluggable schema validator.

Consumer provides a single implementation that knows how to validate their
chosen schema type (JSON Schema via AJV, Zod, etc.). Configured once on
`CqrsConfig.schemaValidator`.

Each validation phase that succeeds may transform the data (coercion,
normalization). The transformed output replaces the command data for
subsequent phases and is persisted to `CommandRecord.data`.

## Type Parameters

### TSchema

`TSchema`

## Methods

### validate()

> **validate**(`schema`, `data`): `Result`\<`unknown`, `ValidationException`\<[`ValidationError`](ValidationError.md)[]\>\>

#### Parameters

##### schema

`TSchema`

##### data

`unknown`

#### Returns

`Result`\<`unknown`, `ValidationException`\<[`ValidationError`](ValidationError.md)[]\>\>
