[**@cqrs-toolkit/hypermedia**](../../../../README.md)

---

[@cqrs-toolkit/hypermedia](../../../../modules.md) / [index](../../../README.md) / [HydraDoc](../README.md) / PlainCommandsDef

# Interface: PlainCommandsDef\<Ext\>

## Type Parameters

### Ext

`Ext` _extends_ `string`

## Properties

### commands

> **commands**: readonly [`PlainCommandCapability`](../type-aliases/PlainCommandCapability.md)\<`Ext`\>[]

Supported versioned commands for this aggregate class.

---

### surfaces

> **surfaces**: readonly [`PlainCommonCommandSurface`](PlainCommonCommandSurface.md)\<`Ext`\>[]

Shared mutation command surfaces keyed by dispatch.

By convention, shared command surface template ids use the form:

`${idStem}-mut-<name>`

where:

- `mut-*` denotes a **mutation entrypoint** (CQRS write surface)
- `<name>` matches the logical dispatch key (`create`, `command`, or a custom extension)

The default surfaces produced by `standardCommandSurfaces()` follow this convention:

- `mut-create` → POST /collection
- `mut-command` → POST /collection/{id}/command

If you introduce additional **re-used** shared mutation surfaces (i.e. extending
`standardCommandSurfaces` with new dispatch keys), you should follow the same
`mut-<dispatch>` naming pattern to keep documentation consistent and readable.

Note: these ids are documentation identifiers only; they are not HTTP routes,
capability ids, or client-facing API tokens.
