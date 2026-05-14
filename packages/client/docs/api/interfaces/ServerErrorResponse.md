[**@cqrs-toolkit/client**](../README.md)

---

[@cqrs-toolkit/client](../globals.md) / ServerErrorResponse

# Interface: ServerErrorResponse

Parsed shape of an error response from the server, handed to a
[FailureMapper](../type-aliases/FailureMapper.md). HTTP-shaped because that's the dominant transport;
non-HTTP senders may pass synthetic values where appropriate.

## Properties

### body

> **body**: `unknown`

Parsed body if the sender parsed it (problem+json document, ld+json
document, or bespoke shape); raw text if parsing failed; undefined when
there is no body.

---

### headers

> **headers**: `Headers`

Response headers — for Retry-After-aware classification, content-type sniffing, etc.

---

### status

> **status**: `number`

HTTP status code (RFC 9110 aligned).
