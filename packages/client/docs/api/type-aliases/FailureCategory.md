[**@cqrs-toolkit/client**](../README.md)

---

[@cqrs-toolkit/client](../globals.md) / FailureCategory

# Type Alias: FailureCategory

> **FailureCategory** = `"transient"` \| `"requires-review"` \| `"redundant"` \| `"unauthenticated"` \| `"permission-denied"` \| `"permanent"`

Typed classification for a command failure. Drives retry, user-intervention,
and cancellation decisions in one place; UI consumers switch on this rather
than parsing status codes or matching `errorCode` strings.

The union is **extensible** — new categories graduate as new behaviours
emerge. Adding a member is a single edit; the compiler enforces exhaustive
handling at every dispatch site.

Distinctions:

- `'unauthenticated'` (re-auth fixes it) is intentionally distinct from
  `'permission-denied'` (re-auth does not).
- `'redundant'` is distinct from `'requires-review'` because nothing needs
  reviewing — the user's intent is already satisfied (duplicate edit,
  idempotent no-op).
