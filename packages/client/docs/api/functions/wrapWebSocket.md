[**@cqrs-toolkit/client**](../README.md)

---

[@cqrs-toolkit/client](../globals.md) / wrapWebSocket

# Function: wrapWebSocket()

> **wrapWebSocket**(`socket`, `opts`): `WebSocket`

Wire devtools observation on an existing `WebSocket`. Returns the same
socket so the call stays one line at the construction site:

```ts
const ws = wrapWebSocket(new WebSocket(url), { connectionId: 'cqrs-sync' })
```

## Parameters

### socket

`WebSocket`

### opts

`WrapWebSocketOptions`

## Returns

`WebSocket`
