[**@cqrs-toolkit/hypermedia**](../../README.md)

---

[@cqrs-toolkit/hypermedia](../../modules.md) / [server](../README.md) / CommandPlanner

# Class: CommandPlanner

CommandPlanner: boundary validation + version negotiation + hydration for commands.

Composes a ProfileNegotiator for Content-Profile header negotiation,
cascades adapters for old-version data, validates against the latest
version's JSON Schema, and optionally hydrates domain types.

Construction-time validations (all assert):

- Every capability must have `stableId`
- No duplicate URNs
- Capabilities sharing a `stableId` must have distinct versions
- Per stableId group (sorted by semver ascending): all except last must have `adapt`,
  last must have `schema`

## Constructors

### Constructor

> **new CommandPlanner**(`commandsDef`, `extractor`): `CommandPlanner`

#### Parameters

##### commandsDef

[`CommandsDef`](../../index/namespaces/HydraDoc/classes/CommandsDef.md)\<`string`\>

##### extractor

[`CommandDispatchExtractor`](../interfaces/CommandDispatchExtractor.md)

#### Returns

`CommandPlanner`

## Properties

### commandsDef

> `protected` `readonly` **commandsDef**: [`CommandsDef`](../../index/namespaces/HydraDoc/classes/CommandsDef.md)\<`string`\>

---

### extractor

> `protected` `readonly` **extractor**: [`CommandDispatchExtractor`](../interfaces/CommandDispatchExtractor.md)

## Methods

### applyHeaders()

> **applyHeaders**(`reply`, `urn`): `void`

Set response headers after successful command processing.

#### Parameters

##### reply

`FastifyReply`

##### urn

`string`

#### Returns

`void`

---

### parse()

> **parse**\<`T`\>(`request`, `reply`, `data`, `stableId`): `Result`\<[`ValidateValue`](../type-aliases/ValidateValue.md)\<`T`\>, `SchemaException`\>

Negotiate version + validate + hydrate.

`stableId` identifies the logical command for "no preference" resolution.
`T` is the latest domain params type (e.g., RenameRoomParams).

Returns a discriminated union in the Ok channel:
{ kind: 'replied' } — 406 already sent (caller returns early)
{ kind: 'validated', value: T, urn } — validation succeeded, typed data ready
Err channel:
SchemaException — validation failed

#### Type Parameters

##### T

`T`

#### Parameters

##### request

[`ReqLike`](../../index/interfaces/ReqLike.md)

##### reply

`FastifyReply`

##### data

`unknown`

##### stableId

`string`

#### Returns

`Result`\<[`ValidateValue`](../type-aliases/ValidateValue.md)\<`T`\>, `SchemaException`\>

---

### parseCommandDispatch()

> **parseCommandDispatch**\<`U`\>(`request`, `reply`, `data`, `dispatch`): `Result`\<[`RepliedValue`](../interfaces/RepliedValue.md) \| `object` & `U`, `SchemaException`\>

Validate a command-dispatch request body.

Looks up the stableId from the dispatch string, then delegates to validate()
for version negotiation + schema validation (using the extractor for schema selection).

For command-envelope routes only (not create or custom surfaces).
Assumes the envelope is already validated by Fastify — only the domain data is validated here.

#### Type Parameters

##### U

`U` _extends_ `object`

#### Parameters

##### request

[`ReqLike`](../../index/interfaces/ReqLike.md)

##### reply

`FastifyReply`

##### data

`unknown`

##### dispatch

`string`

#### Returns

`Result`\<[`RepliedValue`](../interfaces/RepliedValue.md) \| `object` & `U`, `SchemaException`\>
