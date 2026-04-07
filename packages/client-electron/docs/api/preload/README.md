[**@cqrs-toolkit/client-electron**](../README.md)

---

[@cqrs-toolkit/client-electron](../modules.md) / preload

# preload

Preload script helper for the Electron CQRS bridge.

Two-phase port delivery:

1. Preload receives the MessagePort from the main process and holds it.
2. Renderer signals readiness via contextBridge callback.
3. Preload transfers the port into the renderer via window.postMessage.

This avoids the race where did-finish-load fires before the renderer's
async module has registered its message listener.

## Functions

- [initElectronPreload](functions/initElectronPreload.md)
