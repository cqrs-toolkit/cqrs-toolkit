[**@cqrs-toolkit/hypermedia**](../../../../README.md)

---

[@cqrs-toolkit/hypermedia](../../../../modules.md) / [index](../../../README.md) / [HydraDoc](../README.md) / BaseCommandCapability

# Interface: BaseCommandCapability

## Extended by

- [`PlainCommonCommandCapability`](PlainCommonCommandCapability.md)
- [`PlainCustomCommandCapability`](PlainCustomCommandCapability.md)

## Properties

### adapt()?

> `optional` **adapt**: (`oldData`) => `unknown`

Runtime adapter that transforms old-version data to the current shape.

#### Parameters

##### oldData

`unknown`

#### Returns

`unknown`

---

### commandType?

> `optional` **commandType**: `string`

Optional discriminator for envelope-style command endpoints.

Applies only when the effective surface is the shared "/command" endpoint:
POST .../{id}/command
body: { type: <commandType>, data: ... }

Not used for create-style endpoints or custom endpoints that do not use
the envelope convention.

---

### deprecated?

> `optional` **deprecated**: `boolean`

Marks this command version as deprecated.

Deprecated commands are still documented and accepted for a deprecation window,
but clients should warn and migrate to a newer command id/version.

---

### description?

> `optional` **description**: `string`

Human-readable description of what this command does.

---

### hydrate()?

> `optional` **hydrate**: (`validated`) => `unknown`

Runtime hydrator that converts validated data into the domain command shape.

#### Parameters

##### validated

`unknown`

#### Returns

`unknown`

---

### id

> **id**: `string`

Stable, versioned identifier for this command capability.

Used by clients for compatibility checks:
"Am I programmed to send this command id/version, and is it still documented?"

Example: 'urn:command:chat.RenameRoom:1.0.0'

---

### responses?

> `optional` **responses**: readonly [`ResponseEntry`](../type-aliases/ResponseEntry.md)[]

Response documentation for this command. Overrides dispatch surface defaults when provided.

---

### responseSchemaUrn?

> `optional` **responseSchemaUrn**: `string`

URN for the oneOf union schema when 2xx responses have different schemas per contentType.

---

### schema?

> `optional` **schema**: `JSONSchema7`

JSON Schema describing the request body for this command version.

---

### stableId

> **stableId**: `string`

Version-independent identifier that groups multiple versions of the same
logical command together. Used by the command surface to determine which
version is "latest" and to route old payloads through adapters.

---

### version

> **version**: `string`

Semantic version of this command capability (e.g. '1.0.0').

---

### workflow?

> `optional` **workflow**: [`Workflow`](Workflow.md)

Workflow annotation declaring chained operation semantics.
