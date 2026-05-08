# Type system

The type system is the primary tool for preventing bugs at compile time.
A type error or awkward type situation is a design signal — investigate the root cause and fix the types so the compiler catches mistakes now and in the future when someone changes something.
Never silence the compiler with escape hatches (`as`, `!`, `?? fallback` on required fields, `any`).
Each escape hatch is a hole in the safety net: the compiler stops tracking that value, and future changes that would have produced a helpful error instead silently introduce bugs at runtime.

The default response to a type problem is "how do I restructure this so the types work correctly?" — not "how do I make the compiler stop complaining?"

## Rules

### Prefer the most specific type that is practical

Use generics, discriminated unions, and type predicates to preserve type information through call chains.
Do not widen to a base type unless the consumer genuinely does not care about the specific type.
When a function produces a specific type, design its signature so callers receive that specific type.

### `noUncheckedIndexedAccess` is enabled

Array indexing like `arr[0]` returns `T | undefined`, not `T`.
Always handle potential undefined values with optional chaining (`arr[0]?.prop`), nullish coalescing (`arr[0] ?? default`), or explicit checks.

### Every object literal must be type-constrained at its construction site

Through a type annotation on the variable, a typed function parameter, or a generic factory.
An untyped object literal opts out of the type system: the compiler cannot verify it matches the intended shape, and when that shape changes later, the literal silently produces malformed data at runtime.
If you don't know what type an object should be, that's a design problem to solve, not a reason to skip the annotation.

### Do not use `as` type assertions to silence TypeScript errors

Explore the root cause and fix the types so things remain strongly typed.
If after exploration it is unreasonably difficult to strictly type something, find the least hacky option and add a comment explaining why the cast is necessary.
Mock setup in unit tests (e.g., `as unknown as SomeType`) is the one context where casts are self-explanatory and don't require justification.

**When a runtime check is already happening, prefer a type guard.**
If there's already an `if (predicate(v))` or similar, make the predicate a type-guard function (`v is T`) and TS narrows for free.
Casting at the call site when the runtime check is already happening is laziness — the type guard is the fix.
If the helper's predicate signature is the blocker (parameter typed `(v: unknown) => boolean` instead of `(v: unknown) => v is T`), tighten it to a guard and thread the narrowed type through the return type.
That's not scope creep — that's the fix.

**`as` is acceptable only when:**

- Typing is genuinely too complex to express (deep conditional types, cross-generic coupling that would ripple through unrelated code).
- Hot paths where adding a type-guard function call is a measurable cost (profile, don't guess).
- Mock setup in unit tests.
- External-library shapes you don't control.

In all of those cases, add a comment explaining why.
Established casts and their justifying comments are preserved verbatim during refactoring — never delete a `as X` cast or its rationale comment silently while moving code.

### Do not use `!` non-null assertions

If a value could logically be undefined, restructure so the type guarantees its presence (e.g., carry the value through a result type instead of re-finding it).
If the value truly cannot be undefined, the types should already reflect that — a `!` means the types are wrong, not that you need an escape hatch.

### Do not use `?? fallback` or `?.` on values whose type guarantees they are present

If the type says a field is required, trust it — adding a fallback silently masks bugs by converting what should be a crash into incorrect data.
If you are unsure whether a value can be undefined, check the type definition; do not add a fallback "just in case".

### Narrow by asserting what a value IS, not by checking `!== undefined`

For primitives use `typeof x === 'string'` (or `'number'`, `'bigint'`, etc.).
For class instances use `instanceof`.
For objects where the type is already narrowed by context, use truthiness checks (`if (value)`).
This validates both presence and shape in a single check.

Avoid `x !== undefined` or `x === undefined` as the primary narrowing mechanism — neither in new code nor when touching adjacent lines.
The one legitimate case: distinguishing `undefined` from another falsy value (e.g., `0`, `''`, `false`) where truthiness would misclassify.
That's rare and should be obvious from context.

### Prefer `undefined` over `null`

Use `undefined` for absent values — optional properties, missing results, unset state.
Only use `null` at external boundaries that require it:

- **SQL persistence** — `IStorage` record types use `null` for nullable columns.
  The storage layer (`IStorage`, `SQLiteStorage`, `InMemoryStorage`) and types that mirror SQL rows keep `null`.
- **HTTP API contracts** — pagination cursors (`nextCursor: string | null`) and other API response shapes that distinguish `null` from absent.
  Local variables that directly shuttle values to/from these APIs (e.g., a `cursor` loop variable) stay `string | null`.
- **JavaScript built-ins** — `JSON.stringify(x, null, 2)`, `JSON.parse` null checks, etc.

At each boundary, convert `null` to `undefined` so the rest of the codebase deals only with `undefined`.
Consumer-facing types that wrap a nullable storage field (e.g., `ReadModel.serverData`) use `undefined`, with the conversion happening in the read path (e.g., `recordToReadModel`).

### Do not add default values to new generic type parameters

When introducing a generic (e.g., `<TLink extends Link>`), do not add a default (`= Link`).
Thread the generic explicitly through every type, interface, class, and function that references it.
Verify the entire app compiles with the generic properly threaded before considering defaults.
If a default seems reasonable, note it in a `// TODO: default candidate = Link` comment beside the generic — do not apply it.
Defaults may only be introduced later as a deliberate API relaxation after the threading is proven correct.

When a new field or parameter introduces a generic type into a previously non-generic interface, make the interface generic and thread through all usages.
Do not widen to the base type as a shortcut.
For non-trivial cascading changes (multiple files, deep type hierarchies), flag the threading work — token-pressure shortcuts halfway through cascading generic changes create a nightmare to fix.

If `tsc` can auto-detect a generic parameter at the call site, that's fine.
Otherwise the parameter must be passed explicitly.

The historical rationale for the strict no-default rule lives in [`/docs/decisions/0003-no-generic-defaults.md`](../decisions/0003-no-generic-defaults.md).

### Prefer `interface` over `type` for object shapes

Use `interface` for any type that describes an object structure (properties and methods).
Reserve `type` for constructs that require it: unions, intersections, mapped types, conditional types, template literal types, and type aliases for primitives or tuples.

### Use `readonly T[]` not `ReadonlyArray<T>`

Consistent readonly-array style: `readonly Foo[]` in type signatures, property types, and function parameters.
When migrating or editing surrounding code, convert any `ReadonlyArray<T>` to `readonly T[]`.

## Where applied

Repo-wide.
All packages follow this pattern.
Any deviations would be documented as ADRs in the relevant project's `decisions/` wing; none currently exist.

## Referenced from

- [`/docs/decisions/0003-no-generic-defaults.md`](../decisions/0003-no-generic-defaults.md) — the ADR that justifies the no-generic-defaults rule restated in this file.
- [`/docs/decisions/0004-prefer-undefined-over-null.md`](../decisions/0004-prefer-undefined-over-null.md) — the ADR that justifies the `undefined`-over-`null` rule restated in this file.
