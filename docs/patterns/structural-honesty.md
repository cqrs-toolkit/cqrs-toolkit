# Structural honesty

Code structures should honestly represent what they do.
When language machinery (promises, closures, callbacks) is used to implicitly build a data structure or control flow, the result is harder to reason about, debug, and bound than an explicit equivalent.
Watch for these patterns and replace them with explicit structures.

## Smells and their replacements

### Unbounded promise chains as hidden buffers

Chaining `.then()` onto a running promise to serialize async work (`this.pending = this.pending.then(() => work())`) is an unbounded FIFO queue disguised as sequential async code.
You cannot inspect its depth, apply backpressure, bound its size, or cancel pending work.
Use an explicit queue or buffer with clear capacity semantics.

### Fire-and-forget promises

Calling an async function without awaiting or tracking the returned promise (`doWork()` instead of `await doWork()`) creates invisible background work.
Failures are silently swallowed, ordering is unpredictable, and shutdown cannot wait for completion.
If work is intentionally backgrounded, track it in an explicit structure (e.g., a pending-tasks set) so it can be awaited during teardown.

### Boolean flags encoding state machines

Multiple booleans (`isConnected`, `isRetrying`, `isSyncing`) that transition together create implicit states with impossible combinations the type system won't catch.
Use a discriminated union or explicit state field: `state: 'idle' | 'connecting' | 'retrying' | 'syncing'`.

### Recursive `setTimeout` as hidden loops

`setTimeout(() => { ...; setTimeout(self, delay) }, delay)` obscures that this is a loop — its termination condition, iteration count, and cleanup are all implicit.
Use an explicit `while` loop with `await delay()`, or a dedicated scheduler, so the loop structure is visible and the stop condition is a normal `break`/`return`.

### Empty `.catch()` as error suppression

Attaching an empty `.catch()` to silence a promise rejection is not error handling — it is error hiding.
If the error is truly ignorable, add a comment explaining why.
If it needs handling, handle it.
If it should propagate, don't catch it.

(See also: [error-handling.md](error-handling.md).)

## Where applied

Repo-wide.
The smells above are taken seriously in code review; replacements are not optional polish.
