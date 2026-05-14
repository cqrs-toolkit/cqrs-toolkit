[**@cqrs-toolkit/client**](../README.md)

---

[@cqrs-toolkit/client](../globals.md) / defaultLdJsonMapper

# Function: defaultLdJsonMapper()

> **defaultLdJsonMapper**(`response`): [`FailureDescriptor`](../interfaces/FailureDescriptor.md)

ld+json — recognizes JSON-LD shape, lifts `@type` (or `type`) into
`errorCode`, otherwise delegates to [defaultStatusMapper](defaultStatusMapper.md).

## Parameters

### response

[`ServerErrorResponse`](../interfaces/ServerErrorResponse.md)

## Returns

[`FailureDescriptor`](../interfaces/FailureDescriptor.md)
