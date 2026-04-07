[**@cqrs-toolkit/client-electron**](../../README.md)

---

[@cqrs-toolkit/client-electron](../../modules.md) / [main](../README.md) / ElectronBridge

# Class: ElectronBridge

Bridge between the Electron main process, utility process, and renderer.

Owns the utility process lifecycle and the MessagePort pair that
connects the renderer to the utility process.

## Constructors

### Constructor

> **new ElectronBridge**(`config`): `ElectronBridge`

#### Parameters

##### config

[`ElectronBridgeConfig`](../interfaces/ElectronBridgeConfig.md)

#### Returns

`ElectronBridge`

## Methods

### close()

> **close**(): `void`

Close the bridge and terminate the utility process.

#### Returns

`void`

---

### connectWindow()

> **connectWindow**(`win`): `void`

Transfer the renderer-side MessagePort to a BrowserWindow.

Call this after the window's webContents are ready. The preload script
(via `initElectronPreload`) picks up the port on the other side.

#### Parameters

##### win

`BrowserWindow`

#### Returns

`void`
