[**@cqrs-toolkit/client**](../README.md)

---

[@cqrs-toolkit/client](../globals.md) / shouldRetry

# Function: shouldRetry()

> **shouldRetry**(`attempt`, `config?`): `boolean`

Defined in: [packages/client/src/utils/retry.ts:50](https://github.com/Swifttt-Dev/cqrs-toolkit/blob/93be80a21907f07a104ca0e358c4b366dbf08b7d/packages/client/src/utils/retry.ts#L50)

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
