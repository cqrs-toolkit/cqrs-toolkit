[**@cqrs-toolkit/client**](../README.md)

***

[@cqrs-toolkit/client](../globals.md) / ConnectivityState

# Interface: ConnectivityState

Defined in: packages/client/src/core/sync-manager/ConnectivityManager.ts:20

Connectivity state.

## Properties

### apiReachable

> **apiReachable**: `boolean`

Defined in: packages/client/src/core/sync-manager/ConnectivityManager.ts:24

Whether we've confirmed API connectivity

***

### lastContact?

> `optional` **lastContact**: `number`

Defined in: packages/client/src/core/sync-manager/ConnectivityManager.ts:26

Last successful API contact timestamp

***

### online

> **online**: `boolean`

Defined in: packages/client/src/core/sync-manager/ConnectivityManager.ts:22

Whether the browser reports being online
