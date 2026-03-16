[**@cqrs-toolkit/schema**](../README.md)

---

[@cqrs-toolkit/schema](../globals.md) / ValidatorProvider

# Class: ValidatorProvider

## Constructors

### Constructor

> **new ValidatorProvider**(): `ValidatorProvider`

#### Returns

`ValidatorProvider`

## Accessors

### ajv

#### Get Signature

> **get** **ajv**(): `Ajv`

##### Returns

`Ajv`

---

### registry

#### Get Signature

> **get** **registry**(): [`SchemaRegistry`](SchemaRegistry.md)

##### Returns

[`SchemaRegistry`](SchemaRegistry.md)

## Methods

### getValidator()

> **getValidator**(`schema`): `ValidateFunction`

#### Parameters

##### schema

`JSONSchema7`

#### Returns

`ValidateFunction`

---

### parse()

> **parse**\<`T`\>(`schema`, `value`, `hydrate?`): `Result`\<`T`, [`SchemaException`](SchemaException.md)\>

Cached validation + automatic visitor hydration + optional custom hydrate.

#### Type Parameters

##### T

`T`

#### Parameters

##### schema

`JSONSchema7`

##### value

`unknown`

##### hydrate?

[`HydrateFn`](../type-aliases/HydrateFn.md)

#### Returns

`Result`\<`T`, [`SchemaException`](SchemaException.md)\>

---

### parseOnce()

> **parseOnce**\<`T`\>(`schema`, `value`, `hydrate?`): `Result`\<`T`, [`SchemaException`](SchemaException.md)\>

Parse using a schema that is constructed at runtime and should not be cached.

**Purpose**: for schemas constructed at runtime (e.g., per form field configuration)
that can't be cached by reference without unbounded memory growth.

**Tradeoff**: compile+validate+remove has per-call compilation cost (microseconds for
small schemas), comparable to Zod's per-call approach being replaced. Cached
`parseJsonSchema()` is faster (Map lookup) but leaks memory for dynamic schemas.

**When to switch to custom validation**: if this becomes a hot path (thousands of
validations/sec), replace with manual `typeof`/enum/regex checks returning
`Result<void, SchemaException>` — eliminates compilation overhead and GC pressure,
but requires maintaining validation parity with AJV and separate unit tests.

#### Type Parameters

##### T

`T`

#### Parameters

##### schema

`JSONSchema7`

##### value

`unknown`

##### hydrate?

[`HydrateFn`](../type-aliases/HydrateFn.md)

#### Returns

`Result`\<`T`, [`SchemaException`](SchemaException.md)\>

---

### setAjv()

> **setAjv**(`ajv`, `visitors`): `void`

#### Parameters

##### ajv

`Ajv`

##### visitors

readonly [`SchemaVisitor`](../interfaces/SchemaVisitor.md)[]

#### Returns

`void`

---

### validateOnce()

> **validateOnce**(`schema`, `value`): `object`

Compile, validate, and immediately remove the schema from AJV's internal cache.
Use for schemas constructed at runtime (e.g., per form field configuration)
that can't be cached by reference without unbounded memory growth.

#### Parameters

##### schema

`JSONSchema7`

##### value

`unknown`

#### Returns

`object`

##### errors

> **errors**: `ErrorObject`\<`string`, `Record`\<`string`, `any`\>, `unknown`\>[] \| `null` \| `undefined`

##### valid

> **valid**: `boolean`
