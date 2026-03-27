[**@cqrs-toolkit/client**](../README.md)

---

[@cqrs-toolkit/client](../globals.md) / EntityKeyMatcher

# Interface: EntityKeyMatcher\<TLink\>

Entity key matcher — matches entity cache keys by the link's identifying fields
(type, and service if ServiceLink), ignoring the instance-specific id.

## Type Parameters

### TLink

`TLink` _extends_ `Link`

## Properties

### kind

> **kind**: `"entity"`

---

### link

> **link**: `Omit`\<`TLink`, `"id"`\>

Link fields minus id — { type } for Link, { service, type } for ServiceLink
