[**@cqrs-toolkit/client**](../README.md)

---

[@cqrs-toolkit/client](../globals.md) / calculateBackoffDelay

# Function: calculateBackoffDelay()

> **calculateBackoffDelay**(`attempt`, `config?`): `number`

Defined in: [packages/client/src/utils/retry.ts:25](https://github.com/Swifttt-Dev/cqrs-toolkit/blob/93be80a21907f07a104ca0e358c4b366dbf08b7d/packages/client/src/utils/retry.ts#L25)

Calculate delay for a given attempt using exponential backoff.

## Parameters

### attempt

`number`

Current attempt number (1-based)

### config?

[`RetryConfig`](../interfaces/RetryConfig.md) = `{}`

Retry configuration

## Returns

`number`

Delay in milliseconds
