[**@cqrs-toolkit/client**](../README.md)

---

[@cqrs-toolkit/client](../README.md) / shouldRetry

# Function: shouldRetry()

> **shouldRetry**(`attempt`, `config?`): `boolean`

Defined in: packages/client/src/utils/retry.ts:50

Check if we should retry based on attempt count.

## Parameters

### attempt

`number`

Current attempt number (1-based)

### config?

[`RetryConfig`](../interfaces/RetryConfig.md) = `{}`

Retry configuration

## Returns

`boolean`

Whether to retry
