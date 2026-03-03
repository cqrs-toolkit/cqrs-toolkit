[**@cqrs-toolkit/client**](../README.md)

---

[@cqrs-toolkit/client](../README.md) / SessionState

# Type Alias: SessionState

> **SessionState** = \{ `status`: `"uninitialized"`; \} \| \{ `status`: `"no-session"`; \} \| \{ `session`: [`SessionRecord`](../interfaces/SessionRecord.md); `status`: `"cached"`; \} \| \{ `session`: [`SessionRecord`](../interfaces/SessionRecord.md); `status`: `"active"`; \}

Defined in: packages/client/src/core/session/SessionManager.ts:21

Session state.
