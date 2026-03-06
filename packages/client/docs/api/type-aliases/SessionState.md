[**@cqrs-toolkit/client**](../README.md)

---

[@cqrs-toolkit/client](../globals.md) / SessionState

# Type Alias: SessionState

> **SessionState** = \{ `status`: `"uninitialized"`; \} \| \{ `status`: `"no-session"`; \} \| \{ `session`: [`SessionRecord`](../interfaces/SessionRecord.md); `status`: `"cached"`; \} \| \{ `session`: [`SessionRecord`](../interfaces/SessionRecord.md); `status`: `"active"`; \}

Defined in: [packages/client/src/core/session/SessionManager.ts:21](https://github.com/Swifttt-Dev/cqrs-toolkit/blob/93be80a21907f07a104ca0e358c4b366dbf08b7d/packages/client/src/core/session/SessionManager.ts#L21)

Session state.
