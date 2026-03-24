[**@cqrs-toolkit/client**](../README.md)

---

[@cqrs-toolkit/client](../globals.md) / InitializingContext

# Interface: InitializingContext

Context for the first execution of a command handler.

## Properties

### path?

> `optional` **path**: `unknown`

URL path template values from the command envelope.

---

### phase

> **phase**: `"initializing"`

First execution for this command.
