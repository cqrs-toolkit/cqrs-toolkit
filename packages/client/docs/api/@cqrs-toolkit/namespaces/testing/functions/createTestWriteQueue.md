[**@cqrs-toolkit/client**](../../../../README.md)

---

[@cqrs-toolkit/client](../../../../globals.md) / [testing](../README.md) / createTestWriteQueue

# Function: createTestWriteQueue()

> **createTestWriteQueue**\<`TLink`\>(`eventBus`, `cleanup`, `ownedTypes?`, `params?`): `WriteQueue`\<`TLink`\>

Create a WriteQueue for tests with proper lifecycle management.

## Type Parameters

### TLink

`TLink` _extends_ `Link`\<`string`, `string`\>

## Parameters

### eventBus

[`EventBus`](../../../../classes/EventBus.md)\<`TLink`\>

EventBus instance

### cleanup

() => `void`[]

Cleanup array to push destroy callback to

### ownedTypes?

(`"apply-records"` \| `"apply-seed-events"` \| `"apply-ws-event"` \| `"apply-anticipated"` \| `"apply-gap-repair"` \| `"evict-cache-key"` \| `"flush-cache-keys"`)[] = `[]`

Op types registered by real components (skipped from no-op registration).
Example: `['flush-cache-keys']` when CacheManager registers via `setWriteQueue`.

### params?

#### evictionHandler?

(`op`, `reason`) => `void`

#### handler?

(`op`) => `Promise`\<`void`\>

#### onSessionReset?

(`reason`) => `Promise`\<`void`\> \| `"unset"`

## Returns

`WriteQueue`\<`TLink`\>
