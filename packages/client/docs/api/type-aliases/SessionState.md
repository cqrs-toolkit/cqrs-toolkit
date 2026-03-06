[**@cqrs-toolkit/client**](../README.md)

---

[@cqrs-toolkit/client](../globals.md) / SessionState

# Type Alias: SessionState

> **SessionState** = \{ `status`: `"uninitialized"`; \} \| \{ `status`: `"no-session"`; \} \| \{ `session`: [`SessionRecord`](../interfaces/SessionRecord.md); `status`: `"cached"`; \} \| \{ `session`: [`SessionRecord`](../interfaces/SessionRecord.md); `status`: `"active"`; \}

Defined in: [packages/client/src/core/session/SessionManager.ts:21](https://github.com/Swifttt-Dev/cqrs-toolkit/blob/master/packages/client/src/core/session/SessionManager.ts#L21)

Session state.
