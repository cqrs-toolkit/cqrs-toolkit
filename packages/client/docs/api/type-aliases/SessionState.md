[**@cqrs-toolkit/client**](../README.md)

---

[@cqrs-toolkit/client](../globals.md) / SessionState

# Type Alias: SessionState

> **SessionState** = \{ `status`: `"uninitialized"`; \} \| \{ `status`: `"no-session"`; \} \| \{ `session`: [`SessionRecord`](../interfaces/SessionRecord.md); `status`: `"cached"`; \} \| \{ `session`: [`SessionRecord`](../interfaces/SessionRecord.md); `status`: `"active"`; \}

Session state.
