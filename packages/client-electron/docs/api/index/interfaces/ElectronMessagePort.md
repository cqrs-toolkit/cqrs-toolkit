[**@cqrs-toolkit/client-electron**](../../README.md)

---

[@cqrs-toolkit/client-electron](../../modules.md) / [index](../README.md) / ElectronMessagePort

# Interface: ElectronMessagePort

Minimal interface for Electron's MessagePortMain.
Used by the utility process to communicate with the renderer.

## Methods

### off()

> **off**(`event`, `handler`): `void`

#### Parameters

##### event

`"message"`

##### handler

(`event`) => `void`

#### Returns

`void`

---

### on()

> **on**(`event`, `handler`): `void`

#### Parameters

##### event

`"message"`

##### handler

(`event`) => `void`

#### Returns

`void`

---

### postMessage()

> **postMessage**(`message`): `void`

#### Parameters

##### message

`unknown`

#### Returns

`void`

---

### start()

> **start**(): `void`

#### Returns

`void`
