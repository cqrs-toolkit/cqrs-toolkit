# explorations/ (client-react)

Design alternatives under evaluation; things to investigate before they become committed scope (a requirement) or a settled choice (an ADR).
Mutable — entries are edited as understanding develops, then resolve up into another wing or are dropped.

## Distinguished from neighbours

- **vs `intent/requirements/`**: requirements describe _what the project commits to building_; explorations describe _what we're considering_. An exploration that the project commits to becomes a requirement.
- **vs `decisions/`**: ADRs are settled choices with rationale; explorations are open questions with candidate answers. An exploration that resolves into a chosen approach spawns an ADR; the exploration is then either deleted or trimmed and pointed at the ADR.
- **vs `patterns/`**: patterns are normative conventions applied across new work; explorations are the candidate framings that may graduate _into_ a pattern.

## Naming

Descriptive slugs (`<topic>.md`); no `NNNN-` prefix. Explorations are mutable and can be deleted, so monotonic numbering would be churn for no benefit.

## Lifecycle

Same as [the client project's explorations wing](../../client/explorations/_overview.md#lifecycle).
Promotion to `intent/requirements/`, `decisions/`, or `patterns/` consumes the entry (via `git mv` when convenient) or leaves a trimmed pointer behind.
Investigated-and-rejected entries stay in place with a `Status: Archived YYYY-MM-DD — …` header so future contributors don't re-walk the same path.

## Entries

- [`observable-lifetime-across-rerenders.md`](observable-lifetime-across-rerenders.md) — preserving rxjs subscription and cache-key-hold continuity across React re-renders so the hooks reproduce Solid's session semantics. Drives the implementation shape of every hook in this package.
