[**@cqrs-toolkit/schema**](../README.md)

---

[@cqrs-toolkit/schema](../globals.md) / SchemaRegistry

# Class: SchemaRegistry

Walks JSON Schema trees, discovers reusable sub-schemas (those with `$id`), registers them
with AJV, replaces inline definitions with `$ref` pointers, and computes hydration plans
for runtime value conversion via pluggable visitors.

**Common schemas** are sub-schemas auto-discovered via `$id` during tree walks.
`getCommonSchemas()` returns them for documentation generation and client discovery.
Schemas passed directly to `register()` are excluded from common schemas because direct
`register()` calls are for validation, not discovery — the caller already knows about them.

## Constructors

### Constructor

> **new SchemaRegistry**(`ajv`, `visitors`): `SchemaRegistry`

#### Parameters

##### ajv

`Ajv`

##### visitors

readonly [`SchemaVisitor`](../interfaces/SchemaVisitor.md)[]

#### Returns

`SchemaRegistry`

## Properties

### visitors

> `readonly` **visitors**: readonly [`SchemaVisitor`](../interfaces/SchemaVisitor.md)[]

## Methods

### compile()

> **compile**(`schema`): `ValidateFunction`

register() + ajv.compile(). Returns the compiled validator.

#### Parameters

##### schema

`JSONSchema7`

#### Returns

`ValidateFunction`

---

### getCommonSchemas()

> **getCommonSchemas**(): `ReadonlyMap`\<`string`, `JSONSchema7`\>

Auto-discovered schemas (found via $id during tree walks).

#### Returns

`ReadonlyMap`\<`string`, `JSONSchema7`\>

---

### getHydrationPlan()

> **getHydrationPlan**(`schema`): [`HydrationPlan`](../type-aliases/HydrationPlan.md)

Cached hydration plan for a registered schema.

#### Parameters

##### schema

`JSONSchema7`

#### Returns

[`HydrationPlan`](../type-aliases/HydrationPlan.md)

---

### hydrate()

> **hydrate**(`data`, `schema`): `void`

Apply all visitor hydrations for a registered schema.

#### Parameters

##### data

`unknown`

##### schema

`JSONSchema7`

#### Returns

`void`

---

### register()

> **register**(`schema`): `void`

Walk schema tree, discover $id sub-schemas, replace with $ref, cache hydration plan.

Schemas referenced via pre-existing `$ref` (not `$id`) must be registered
before the schemas that reference them.

#### Parameters

##### schema

`JSONSchema7`

#### Returns

`void`
