# Design pitfalls

Common design mistakes to avoid when authoring or planning code.
Catching these during design is much cheaper than catching them in code review.

## Temporal coupling

Methods that must be called in a specific order (`init()` before `start()` before `process()`), but nothing in the types enforces it.
Use type-state patterns or builder APIs so calling out of order is a compile error, not a runtime surprise.

## Unclear lifecycle ownership

Resources (connections, subscriptions, timers) created in one place and cleaned up in another — or not at all.
Every resource should have a single owner responsible for its creation and disposal.
If ownership must transfer, make the handoff explicit.

## Shared mutable state without ownership

Multiple components reading and writing the same mutable object with no clear owner.
One component owns and mutates; others get read-only views or subscribe to changes.

## Invisible side effects

Functions that look simple but secretly write to storage, schedule timers, or mutate shared state.
A function's signature and name should reveal what it actually does.
If a function has significant side effects, make them visible — through naming, return types, or explicit dependency injection.

## Derived state stored instead of computed

Keeping a second copy of data in sync via events or notifications instead of deriving it on read.
Two representations of the same truth will eventually diverge.
Compute derived values from the source of truth; only cache when profiling shows a real performance need.

## Responsibility accumulation

A class that grows to handle connection management, retry logic, serialization, caching, and lifecycle is not a class — it is an application crammed into one file.
Each concern should be a separate, composable unit with a clear single responsibility.

## Hidden coupling through shared knowledge

Two components that don't import each other but are coupled because they both "know" the same magic string, localStorage key, or URL format.
Extract shared knowledge into an explicit constant or type that both components import, so changes are caught by the compiler.

## Class dependencies in config objects

Config objects are for plain values (strings, numbers, booleans, feature flags).
Class dependencies are structural — they define what the class collaborates with.
Mixing them conflates configuration with wiring.

When a class needs a collaborator, add it as a direct constructor parameter using TypeScript's `private readonly` parameter property syntax.
Reserve config objects for value-type settings.

## Optional class dependencies

Never add class dependencies as optional unless explicitly told otherwise.
Optional deps create ambiguity about whether the functionality is available and lead to null checks scattered throughout the code.
If a class needs a dependency, it needs it.

When adding a new dependency to a constructor, make it required and update all call sites to pass it.
Only use optional if the user explicitly says to.

## `for..await` in loops is an architecture smell

If you find yourself writing `for (const x of xs) { await op(x) }` — or `Promise.all(xs.map((x) => op(x)))` — that's an architecture signal, not just a perf bug.
The underlying layer doesn't expose the right API.
The correct fix is almost always a batch function (`opMany(xs): Promise<Result[]>`), not a loop over N single-item calls.

**Why batches beat `Promise.all(.map(single))`:**

- One round-trip instead of N.
  A batch call hits storage / network once; `Promise.all` still pays N latencies on any serialized layer (a SQLite driver that funnels through one connection, an RPC channel that serializes messages).
- Amortized overhead: query parsing, transaction setup, RPC framing happen once.
- Atomic semantics available when needed (a batch can run inside a single transaction; fan-out `Promise.all` cannot).
- Backpressure and bounds are explicit; `Promise.all` fans out unbounded.
- Cache and index opportunities — a batch function can group by shard, stream, partition, etc.

**Order of preference:**

1. Use an existing batch API (`storage.getMany(ids)`, `cache.mgetRecords(keys)`, etc.).
2. Add a batch API to the underlying layer if one doesn't exist.
   *This is the correct fix for repeated `for..await`.*
3. Only if batching is genuinely impossible (per-item side effects that must interleave), use `Promise.all` — and say why in a comment.
4. Serial `for..await` — almost never correct; requires explicit justification (total ordering, dependent inputs).

**Concrete:**

```ts
// architecture smell
for (const id of ids) {
  const record = await storage.getById(id)
  // ...
}

// also bad — still N round-trips, just parallel
const records = await Promise.all(ids.map((id) => storage.getById(id)))

// correct — one call
const records = await storage.getManyById(ids)
```

When proposing designs, describe the batch shape — not the loop-of-awaits.
When reading existing code, flag `for..await` and `Promise.all(.map(singleCall))` as missing-batch smells, not just perf bugs.

## Where applied

Repo-wide.
These pitfalls are flagged in design discussion before implementation, not just in code review.
