[**@cqrs-toolkit/client**](../README.md)

---

[@cqrs-toolkit/client](../globals.md) / defaultStatusMapper

# Function: defaultStatusMapper()

> **defaultStatusMapper**(`response`): [`FailureDescriptor`](../interfaces/FailureDescriptor.md)

RFC 9110 status code → [FailureCategory](../type-aliases/FailureCategory.md), no body inspection.

Following the strict reading of RFC 9110 / 9457 / 6585 / 8470 / 7725 /
4918 / 5842, with the deliberate convention noted on 500 (treated as
`transient` because the field convention is to retry, despite RFC making
no such assertion) and on 404 (`requires-review` because on the
authoritative command path, 404 is definitive but typically means the
user's local read model was stale — surface to the user).

## Parameters

### response

[`ServerErrorResponse`](../interfaces/ServerErrorResponse.md)

## Returns

[`FailureDescriptor`](../interfaces/FailureDescriptor.md)
