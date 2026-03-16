[**@cqrs-toolkit/hypermedia**](../../../../README.md)

---

[@cqrs-toolkit/hypermedia](../../../../modules.md) / [index](../../../README.md) / [HAL](../README.md) / LinkObject

# Interface: LinkObject

Standard Link Object for hypermedia (HAL-style).
Describes how a client can navigate to related resources.

## Properties

### deprecation?

> `optional` **deprecation**: `string`

A URI identifying a deprecation notice for the link.
Indicates clients should avoid using this relation.

---

### href

> **href**: `string`

Target URI of the link.
May be absolute or relative to the current resource.

---

### hreflang?

> `optional` **hreflang**: `string`

The language of the link's target resource.
Example: "en", "fr", "en-US".

---

### name?

> `optional` **name**: `string`

Secondary key to distinguish multiple links
with the same relation type. Example: two `thumbnail`
links with different sizes can be disambiguated by `name`.

---

### profile?

> `optional` **profile**: `string`

A URI that hints at the profile (specification or
constraints) of the target resource. Example:
"https://example.com/profiles/task".

---

### templated?

> `optional` **templated**: `boolean`

Indicates that the `href` contains URI template variables
(RFC 6570). Clients must expand before using.

---

### title?

> `optional` **title**: `string`

Human-readable title describing the link's target.
Useful for UIs but not required for clients.

---

### type?

> `optional` **type**: `string`

The media type (MIME type) expected when dereferencing
this link. Example: "application/hal+json".
