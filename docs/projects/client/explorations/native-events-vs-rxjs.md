# Native events vs RxJS for the public event surface

## Context

[`§9.5`](../intent/requirements/0010-public-api.md#105-public-api-shape) of `0010-public-api.md` specifies that public modules expose lifecycle notifications as event subscriptions. The intent leans toward a native-events / per-module emitter shape that adapts naturally to whatever subscription primitive the consumer's UI library already provides (Solid signals, Svelte stores, RxJS, Most, etc.) — i.e., not forcing the consumer to import a specific reactive library to subscribe to client events.

## Observation

Surfaced during 2026-05-07 review. Current implementation diverges from this intent:

- A single central `EventBus` exposes events as RxJS Observables (`eventBus.on('cache:key-added').subscribe(...)`).
- Modules emit through the central bus rather than offering per-module emitters.
- RxJS was reused because the library already depended on it (expedient default — "we have it, use it").

## The unresolved question

Two axes are open:

1. **Subscription primitive** — RxJS Observable vs native EventTarget vs something else.
2. **Per-module vs central** — `cacheManager.on(...)` vs `eventBus.on(...)` (the spec's example assumed per-module; impl chose central).

Whether the spec's not-RxJS intent is even justified is itself an open question. The argument *for* a non-RxJS surface: consumers don't need to pull in another reactive library just to subscribe to client events. The argument *against*: every realistic UI library already has its own subscription primitive, and the consumer is going to adapt at the boundary regardless. RxJS is a fine-enough source for that adapter — the same ergonomic concerns would apply to any other choice.

## Possible resolutions

- **Accept the RxJS surface.** Update [`§9.5`](../intent/requirements/0010-public-api.md#105-public-api-shape) to state RxJS Observables as the canonical subscription type. Trade off: consumers without RxJS in their stack pay an extra dependency.
- **Replace with a thinner native-events surface.** EventTarget / DOM-style `addEventListener` API. Trade off: consumer adapters lose RxJS's operator chain when they want it.
- **Offer both.** Native events as the primary surface, RxJS as an optional adapter (or vice versa). Trade off: surface-area bloat.
- **Keep central EventBus regardless.** The per-module-vs-central question is orthogonal and could be settled either way under any of the above.

## Status

Pending. The spec retains the native-events intent; current impl diverges; decision will be made when consumer-facing concerns sharpen up (probably during the real-app build).
