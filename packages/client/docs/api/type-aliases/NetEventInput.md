[**@cqrs-toolkit/client**](../README.md)

---

[@cqrs-toolkit/client](../globals.md) / NetEventInput

# Type Alias: NetEventInput

> **NetEventInput** = \{ `connectionId`: `string`; `kind`: `"ws-created"`; `protocols?`: `string`[]; `url`: `string`; \} \| \{ `connectionId`: `string`; `kind`: `"ws-frame-sent"`; `payload`: `string` \| `ArrayBuffer` \| `ArrayBufferView`; `timestamp?`: `number`; `url?`: `string`; \} \| \{ `connectionId`: `string`; `kind`: `"ws-frame-received"`; `payload`: `string` \| `ArrayBuffer` \| `ArrayBufferView`; `timestamp?`: `number`; `url?`: `string`; \} \| \{ `code?`: `number`; `connectionId`: `string`; `kind`: `"ws-closed"`; `reason?`: `string`; `wasClean?`: `boolean`; \}

Discriminated union of network observations a caller can push into the
devtools panel via `__CQRS_TOOLKIT_DEVTOOLS__.recordNetEvent`. Stable
`connectionId` ties frames to the lifecycle pair (`ws-created` opens,
`ws-closed` terminates).

## Type Declaration

\{ `connectionId`: `string`; `kind`: `"ws-created"`; `protocols?`: `string`[]; `url`: `string`; \}

### connectionId

> **connectionId**: `string`

### kind

> **kind**: `"ws-created"`

### protocols?

> `optional` **protocols**: `string`[]

### url

> **url**: `string`

\{ `connectionId`: `string`; `kind`: `"ws-frame-sent"`; `payload`: `string` \| `ArrayBuffer` \| `ArrayBufferView`; `timestamp?`: `number`; `url?`: `string`; \}

### connectionId

> **connectionId**: `string`

### kind

> **kind**: `"ws-frame-sent"`

### payload

> **payload**: `string` \| `ArrayBuffer` \| `ArrayBufferView`

### timestamp?

> `optional` **timestamp**: `number`

### url?

> `optional` **url**: `string`

Connection URL — carried on every frame so the panel can render
path/url even when `ws-created` was dropped (e.g. fired before
the panel hook was attached).

\{ `connectionId`: `string`; `kind`: `"ws-frame-received"`; `payload`: `string` \| `ArrayBuffer` \| `ArrayBufferView`; `timestamp?`: `number`; `url?`: `string`; \}

### connectionId

> **connectionId**: `string`

### kind

> **kind**: `"ws-frame-received"`

### payload

> **payload**: `string` \| `ArrayBuffer` \| `ArrayBufferView`

### timestamp?

> `optional` **timestamp**: `number`

### url?

> `optional` **url**: `string`

\{ `code?`: `number`; `connectionId`: `string`; `kind`: `"ws-closed"`; `reason?`: `string`; `wasClean?`: `boolean`; \}

### code?

> `optional` **code**: `number`

### connectionId

> **connectionId**: `string`

### kind

> **kind**: `"ws-closed"`

### reason?

> `optional` **reason**: `string`

### wasClean?

> `optional` **wasClean**: `boolean`
