[**@cqrs-toolkit/client**](../README.md)

---

[@cqrs-toolkit/client](../globals.md) / shouldRetry

# Function: shouldRetry()

> **shouldRetry**(`attempt`, `config?`): `boolean`

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
