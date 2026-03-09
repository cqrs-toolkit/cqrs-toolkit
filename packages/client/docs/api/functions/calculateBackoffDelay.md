[**@cqrs-toolkit/client**](../README.md)

---

[@cqrs-toolkit/client](../globals.md) / calculateBackoffDelay

# Function: calculateBackoffDelay()

> **calculateBackoffDelay**(`attempt`, `config?`): `number`

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
