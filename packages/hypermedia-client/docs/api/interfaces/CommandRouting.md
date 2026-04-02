[**@cqrs-toolkit/hypermedia-client**](../README.md)

---

[@cqrs-toolkit/hypermedia-client](../README.md) / CommandRouting

# Interface: CommandRouting

Routing info for a single command, read from commands.json.

## Properties

### commandType?

> `optional` **commandType**: `string`

Command type discriminator for envelope-style endpoints

---

### dispatch

> **dispatch**: `string`

Dispatch type ('create', 'command', or custom)

---

### mappings

> **mappings**: [`TemplateMapping`](TemplateMapping.md)[]

Template variable mappings

---

### responseSchema?

> `optional` **responseSchema**: `ResponseSchemaEntry`[]

Per-content-type response schemas for this command's success response

---

### template

> **template**: `string`

URI template (e.g. '/api/todos/{id}/command')

---

### urn

> **urn**: `string`

Full command URN

---

### workflow?

> `optional` **workflow**: `object`

Workflow annotation — type identifies the convention, nextStepId references an external endpoint

#### nextStepId?

> `optional` **nextStepId**: `string`

#### type

> **type**: `string`
