[**@cqrs-toolkit/hypermedia**](../../../../README.md)

---

[@cqrs-toolkit/hypermedia](../../../../modules.md) / [index](../../../README.md) / [HydraDoc](../README.md) / ResponseDef

# Interface: ResponseDef

Object form of a response entry.

## Properties

### code

> **code**: `number`

---

### contentType?

> `optional` **contentType**: `string`

Defaults to 'application/json' when omitted.

---

### description?

> `optional` **description**: `string`

---

### responseHeaders?

> `optional` **responseHeaders**: readonly [`HeaderEntry`](../type-aliases/HeaderEntry.md)[]

Headers attached to this response. Emitted ONLY in OpenAPI output; not represented in
the Hydra JSON-LD apidoc since Hydra has no native header concept. When multiple
`ResponseDef` entries share a status code across content-type variants, their
`responseHeaders` are aggregated into a single `headers` object on the OpenAPI Response
Object for that status code.

---

### schema?

> `optional` **schema**: `JSONSchema7` \| _typeof_ [`NO_BODY`](../variables/NO_BODY.md)

Response body schema. Use NO_BODY for explicitly empty responses.
