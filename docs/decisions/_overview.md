# decisions/

Repo-wide ADRs (Architecture Decision Records).
Captures _why_ cross-cutting choices were made — choices that affect more than one project.

## Decisions

- [ADR 0001 — Pre-release: no back-compat shims](0001-pre-release-no-back-compat.md) — until a published-stable release exists, the toolkit edits forward freely; consumers handle their own bridging.
- [ADR 0002 — Error handling: three categories](0002-error-handling-three-categories.md) — `Result<T, E>` for expected domain failures, `assert` for invariant violations, `throw` for external/library failures.
- [ADR 0003 — No generic defaults](0003-no-generic-defaults.md) — type parameters carry no default; callers state the type they're working with explicitly.
- [ADR 0004 — Prefer `undefined` over `null`](0004-prefer-undefined-over-null.md) — `undefined` is the absence-of-value default; `null` only where an external interface forces it.

## Wing-specific conventions

(Castle-wide ADR conventions — immutability, dating, numbering, supersession back-pointers — live in [`/docs/map.md`](../map.md)'s Conventions section.)

- Standard sections inside an ADR: Status, Context, Decision, Consequences (Notes / Related as needed).
- Status starts as `Proposed`; transitions to `Accepted` with the acceptance date.
- When superseding, write the new ADR with a "Supersedes ADR-NNNN" line in its context, then add the back-pointer to the old ADR.

## Scope: repo vs. project

If a decision affects only one package or the demo system, the ADR lives in that project's castle (`docs/projects/<name>/decisions/`).
ADRs at this level affect the repo as a whole.

A decision that originated in one package but was later adopted across packages can be promoted.
ADRs are immutable, so promotion produces a _new_ ADR at the higher scope — the original stays in place with a "Generalized by ADR-NNNN" back-pointer.
For the full procedure, see [`/docs/playbooks/promoting-castle-content.md`](../playbooks/promoting-castle-content.md) (the "Immutable wing" path).
Promotion is deliberate, not silent.
