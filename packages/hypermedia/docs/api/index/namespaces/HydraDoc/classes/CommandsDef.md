[**@cqrs-toolkit/hypermedia**](../../../../README.md)

---

[@cqrs-toolkit/hypermedia](../../../../modules.md) / [index](../../../README.md) / [HydraDoc](../README.md) / CommandsDef

# Class: CommandsDef\<Ext\>

CQRS command docs

Conventions:

- Standard command endpoint is singular: POST /api/<svc>/<aggregate>/{id}/command
- Envelope-style commands use body: { type: <commandType>, data: ... }
- Custom endpoints (like room's /association) use surfaceOverride.

## Type Parameters

### Ext

`Ext` _extends_ `string`

## Constructors

### Constructor

> **new CommandsDef**\<`Ext`\>(`plain`): `CommandsDef`\<`Ext`\>

#### Parameters

##### plain

[`PlainCommandsDef`](../interfaces/PlainCommandsDef.md)\<`Ext`\>

#### Returns

`CommandsDef`\<`Ext`\>

## Properties

### commands

> `readonly` **commands**: readonly [`CommandCapability`](CommandCapability.md)\<`Ext`\>[]

---

### surfaces

> `readonly` **surfaces**: readonly [`CommandSurface`](CommandSurface.md)\<`Ext`\>[]

## Methods

### getStableId()

> **getStableId**(`commandType`): `string`

#### Parameters

##### commandType

`string`

#### Returns

`string`

---

### mustSurface()

> **mustSurface**(`dispatch`): [`CommandSurface`](CommandSurface.md)\<`Ext`\>

#### Parameters

##### dispatch

[`CommandDispatch`](../type-aliases/CommandDispatch.md)\<`Ext`\>

#### Returns

[`CommandSurface`](CommandSurface.md)\<`Ext`\>

---

### resolveSurfaceForCommand()

> **resolveSurfaceForCommand**(`commandId`): [`CustomCommandSurface`](CustomCommandSurface.md) \| [`CommandSurface`](CommandSurface.md)\<`Ext`\>

#### Parameters

##### commandId

`string`

#### Returns

[`CustomCommandSurface`](CustomCommandSurface.md) \| [`CommandSurface`](CommandSurface.md)\<`Ext`\>
