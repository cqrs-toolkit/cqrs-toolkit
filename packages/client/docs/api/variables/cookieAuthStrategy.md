[**@cqrs-toolkit/client**](../README.md)

---

[@cqrs-toolkit/client](../globals.md) / cookieAuthStrategy

# Variable: cookieAuthStrategy

> `const` **cookieAuthStrategy**: [`AuthStrategy`](../interfaces/AuthStrategy.md)

Cookie-based auth strategy — all hooks are noop.

The browser sends cookies automatically with both fetch() and WebSocket connections,
so no explicit auth handling is needed.
