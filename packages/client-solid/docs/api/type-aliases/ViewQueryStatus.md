[**@cqrs-toolkit/client-solid**](../README.md)

---

[@cqrs-toolkit/client-solid](../globals.md) / ViewQueryStatus

# Type Alias: ViewQueryStatus

> **ViewQueryStatus** = \{ `status`: `"loading"`; \} \| \{ `status`: `"ready"`; \} \| \{ `error`: `string`; `status`: `"error"`; \}

Lifecycle status for a view query.

Simpler than the list-query lifecycle: views don't have a built-in "seeding"
distinction since seed status is per-cache-key and views read across
multiple keys. Consumers that need the distinction layer it via their own
cache-key acquisition flow.
