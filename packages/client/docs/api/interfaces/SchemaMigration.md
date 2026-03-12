[**@cqrs-toolkit/client**](../README.md)

---

[@cqrs-toolkit/client](../globals.md) / SchemaMigration

# Interface: SchemaMigration

A versioned schema migration.

Consumers declare migrations incrementally. Each migration adds the new
collections (and library steps) introduced in that version.

## Properties

### message

> **message**: `string`

---

### steps

> **steps**: [`MigrationStep`](../type-aliases/MigrationStep.md)[]

---

### version

> **version**: `number`
