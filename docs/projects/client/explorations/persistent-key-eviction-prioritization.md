# Persistent key eviction prioritization under pressure

## Context

When multiple persistent cache keys are eligible for eviction (under capacity or quota pressure), the order in which they're evicted is a tuning concern that goes beyond the LRU + frozen semantics already in the spec.

Surfaced from the previous open-ambiguities section.

## Open considerations

Implementations may prefer:

- **Non-active keys first** — keys without active window holds get evicted before active ones.
- **Smaller estimated size first** — quickly free a known small amount of space without disturbing larger / more valuable keys.
- **Larger estimated size first** — free more space per eviction, fewer eviction operations needed.
- **Older access timestamps** — straightforward LRU.
- **Combination** — composite scoring across the above.

## Constraint

This is a tuning concern; it does **not** affect the correctness contract. The spec's LRU + frozen semantics are the floor; the prioritization strategy on top is implementation-defined.

## Status

Open. Tuning concern. Will be revisited when storage pressure on real workloads makes a particular ordering observably better.
