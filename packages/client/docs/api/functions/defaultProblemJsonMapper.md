[**@cqrs-toolkit/client**](../README.md)

---

[@cqrs-toolkit/client](../globals.md) / defaultProblemJsonMapper

# Function: defaultProblemJsonMapper()

> **defaultProblemJsonMapper**(`response`): [`FailureDescriptor`](../interfaces/FailureDescriptor.md)

Problem+json (RFC 9457) — recognizes the document shape, lifts `type` into
`errorCode`, delegates to [defaultStatusMapper](defaultStatusMapper.md) for category. When
the body is not a problem document, behaves identically to
`defaultStatusMapper`.

## Parameters

### response

[`ServerErrorResponse`](../interfaces/ServerErrorResponse.md)

## Returns

[`FailureDescriptor`](../interfaces/FailureDescriptor.md)
