[**@cqrs-toolkit/schema**](../README.md)

---

[@cqrs-toolkit/schema](../globals.md) / SchemaVisitor

# Interface: SchemaVisitor

## Properties

### name

> `readonly` **name**: `string`

Unique name, used as key in HydrationPlan maps.

## Methods

### hydrate()

> **hydrate**(`value`, `parent`): `unknown`

Convert a validated value. Returns the replacement value, or `undefined` to leave
the original value unchanged (e.g., when conversion fails on an unexpected input).

#### Parameters

##### value

`string`

The validated string value at the matched path.

##### parent

The containing object, or `undefined` when hydrating a bare root value.
Allows visitors to inspect sibling fields for union differentiation
(e.g., checking a `type` field to distinguish date vs date-time).

`Record`\<`string`, `unknown`\> | `undefined`

#### Returns

`unknown`

---

### match()

> **match**(`schema`): `boolean`

Return true if this schema node needs hydration by this visitor.

#### Parameters

##### schema

`JSONSchema7`

#### Returns

`boolean`
