[**@cqrs-toolkit/hypermedia**](../../../../README.md)

---

[@cqrs-toolkit/hypermedia](../../../../modules.md) / [index](../../../README.md) / [HydraDoc](../README.md) / CommandCapability

# Class: CommandCapability\<Ext\>

## Type Parameters

### Ext

`Ext` _extends_ `string`

## Constructors

### Constructor

> **new CommandCapability**\<`Ext`\>(`envelope`): `CommandCapability`\<`Ext`\>

#### Parameters

##### envelope

`CommandCapabilityEnvelope`\<`Ext`\>

#### Returns

`CommandCapability`\<`Ext`\>

## Properties

### adapt?

> `readonly` `optional` **adapt**: [`Adapter`](../type-aliases/Adapter.md)

Runtime adapter that transforms old-version data to the current shape.

---

### commandType?

> `readonly` `optional` **commandType**: `string`

Optional discriminator for envelope-style /command endpoint bodies.

---

### deprecated

> `readonly` **deprecated**: `boolean`

Defaults to false; deprecated commands remain documented for a deprecation window.

---

### description?

> `readonly` `optional` **description**: `string`

Human-readable description of what this command does.

---

### dispatch?

> `readonly` `optional` **dispatch**: [`CommandDispatch`](../type-aliases/CommandDispatch.md)\<`Ext`\>

Present only for shared-surface commands.

---

### hydrate?

> `readonly` `optional` **hydrate**: [`Hydrator`](../type-aliases/Hydrator.md)

Runtime hydrator that converts validated data into the domain command shape.

---

### id

> `readonly` **id**: `string`

---

### isLatest

> `readonly` **isLatest**: `boolean`

True if this is the latest (highest semver) version within its stableId group.

---

### responses?

> `readonly` `optional` **responses**: readonly [`ResponseEntry`](../type-aliases/ResponseEntry.md)[]

Response documentation. Overrides dispatch surface defaults when provided.

---

### responseSchemaUrn?

> `readonly` `optional` **responseSchemaUrn**: `string`

---

### schema?

> `readonly` `optional` **schema**: `JSONSchema7`

JSON Schema describing the request body for this command version.

---

### stableId

> `readonly` **stableId**: `string`

Version-independent identifier grouping multiple versions of the same logical command.

---

### surface?

> `readonly` `optional` **surface**: [`CustomCommandSurface`](CustomCommandSurface.md)

Present only for custom-endpoint commands.

---

### version

> `readonly` **version**: `string`

Semantic version of this command capability.

---

### workflow?

> `readonly` `optional` **workflow**: [`Workflow`](../interfaces/Workflow.md)

Workflow annotation declaring chained operation semantics.
