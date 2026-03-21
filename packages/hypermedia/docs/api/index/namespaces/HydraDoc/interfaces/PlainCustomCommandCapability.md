[**@cqrs-toolkit/hypermedia**](../../../../README.md)

---

[@cqrs-toolkit/hypermedia](../../../../modules.md) / [index](../../../README.md) / [HydraDoc](../README.md) / PlainCustomCommandCapability

# Interface: PlainCustomCommandCapability

## Extends

- [`BaseCommandCapability`](BaseCommandCapability.md)

## Properties

### adapt()?

> `optional` **adapt**: (`oldData`) => `unknown`

Runtime adapter that transforms old-version data to the current shape.

#### Parameters

##### oldData

`unknown`

#### Returns

`unknown`

#### Inherited from

[`BaseCommandCapability`](BaseCommandCapability.md).[`adapt`](BaseCommandCapability.md#adapt)

---

### commandType?

> `optional` **commandType**: `string`

Optional discriminator for envelope-style command endpoints.

Applies only when the effective surface is the shared "/command" endpoint:
POST .../{id}/command
body: { type: <commandType>, data: ... }

Not used for create-style endpoints or custom endpoints that do not use
the envelope convention.

#### Inherited from

[`BaseCommandCapability`](BaseCommandCapability.md).[`commandType`](BaseCommandCapability.md#commandtype)

---

### deprecated?

> `optional` **deprecated**: `boolean`

Marks this command version as deprecated.

Deprecated commands are still documented and accepted for a deprecation window,
but clients should warn and migrate to a newer command id/version.

#### Inherited from

[`BaseCommandCapability`](BaseCommandCapability.md).[`deprecated`](BaseCommandCapability.md#deprecated)

---

### dispatch?

> `optional` **dispatch**: `undefined`

Disallow dispatch on custom capabilities.

---

### hydrate()?

> `optional` **hydrate**: (`validated`) => `unknown`

Runtime hydrator that converts validated data into the domain command shape.

#### Parameters

##### validated

`unknown`

#### Returns

`unknown`

#### Inherited from

[`BaseCommandCapability`](BaseCommandCapability.md).[`hydrate`](BaseCommandCapability.md#hydrate)

---

### id

> **id**: `string`

Stable, versioned identifier for this command capability.

Used by clients for compatibility checks:
"Am I programmed to send this command id/version, and is it still documented?"

Example: 'urn:command:chat.RenameRoom:1.0.0'

#### Inherited from

[`BaseCommandCapability`](BaseCommandCapability.md).[`id`](BaseCommandCapability.md#id)

---

### schema?

> `optional` **schema**: `JSONSchema7`

JSON Schema describing the request body for this command version.

#### Inherited from

[`BaseCommandCapability`](BaseCommandCapability.md).[`schema`](BaseCommandCapability.md#schema)

---

### stableId

> **stableId**: `string`

Version-independent identifier that groups multiple versions of the same
logical command together. Used by the command surface to determine which
version is "latest" and to route old payloads through adapters.

#### Inherited from

[`BaseCommandCapability`](BaseCommandCapability.md).[`stableId`](BaseCommandCapability.md#stableid)

---

### surface

> **surface**: [`PlainCustomCommandSurface`](PlainCustomCommandSurface.md)

Explicit surface for rare commands that use a bespoke endpoint.

When present, this surface is the command's invocation contract.
There is no fallback to a shared dispatch surface.

---

### version

> **version**: `string`

Semantic version of this command capability (e.g. '1.0.0').

#### Inherited from

[`BaseCommandCapability`](BaseCommandCapability.md).[`version`](BaseCommandCapability.md#version)
