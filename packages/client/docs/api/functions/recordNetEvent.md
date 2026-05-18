[**@cqrs-toolkit/client**](../README.md)

---

[@cqrs-toolkit/client](../globals.md) / recordNetEvent

# Function: recordNetEvent()

> **recordNetEvent**(`event`): `void`

Push a single network observation into the devtools panel if the
extension is attached. No-op if no hook is installed.

Direct callers (custom transports, non-WebSocket protocols) use this.
For standard WebSockets, prefer `wrapWebSocket` — it wires the four
lifecycle events for you.

## Parameters

### event

[`NetEventInput`](../type-aliases/NetEventInput.md)

## Returns

`void`
