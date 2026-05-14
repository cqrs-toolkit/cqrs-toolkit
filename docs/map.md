# Castle Map — cqrs-toolkit

The repo-wide entrance hall.
A new session reads this file first, then descends into the relevant wing or project room.

## What this is

A self-contained fractal of project documentation rooted at `docs/`.
Every project — repo-level, package, demo — has its full castle inline at the appropriate path under `docs/projects/`.
Code at `packages/<pkg>/` keeps only what must travel with it (READMEs that ship to npm, generated `docs/api/`, source, a thin `CLAUDE.md` pointing back here).

## Wings

| Wing                                   | Holds                                                                                                                                                               |
| -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [`intent/`](intent/_overview.md)       | what cqrs-toolkit (the monorepo as a whole) is meant to do — vision, non-goals, glossary                                                                            |
| `explorations/`                        | design alternatives under evaluation; open questions and candidate approaches not yet committed _(no repo-level entries yet; client has its own explorations wing)_ |
| [`decisions/`](decisions/_overview.md) | repo-wide ADRs — _why_ specific cross-cutting choices were made (immutable)                                                                                         |
| [`evolution/`](evolution/_overview.md) | repo-wide history — multi-package changelog, milestones, deprecations                                                                                               |
| `atlas/`                               | what _currently exists_ — repo-wide structural maps: dependency graphs, relationship inventories, topology (descriptive, not prescriptive)                          |
| [`patterns/`](patterns/_overview.md)   | how things are done here (construction) — normative repo-wide conventions                                                                                           |
| [`playbooks/`](playbooks/_overview.md) | how recurring activities are performed (procedure) — sequenced cross-package steps                                                                                  |
| `mindset/`                             | how to think about problems here (reasoning) — analytical framings _(no repo-level entries yet; client has its own mindset wing)_                                   |
| [`projects/`](projects/_overview.md)   | nested project castles — packages and demos as recursive entries                                                                                                    |

The construction / procedure / reasoning triplet keeps the three "how" wings distinct: a pattern is _how to act_; a playbook is _how to do a procedure_; a mindset is _how to think_.

## Projects

| Project                           | Castle                                                                   | Public API                                |
| --------------------------------- | ------------------------------------------------------------------------ | ----------------------------------------- |
| `@cqrs-toolkit/client`            | [`projects/client/`](projects/client/_overview.md)                       | experimental                              |
| `@cqrs-toolkit/client-electron`   | [`projects/client-electron/`](projects/client-electron/_overview.md)     | experimental                              |
| `@cqrs-toolkit/client-solid`      | [`projects/client-solid/`](projects/client-solid/_overview.md)           | experimental                              |
| `@cqrs-toolkit/devtools`          | [`projects/devtools/`](projects/devtools/_overview.md)                   | experimental                              |
| `@cqrs-toolkit/hypermedia`        | [`projects/hypermedia/`](projects/hypermedia/_overview.md)               | experimental                              |
| `@cqrs-toolkit/hypermedia-cli`    | [`projects/hypermedia-cli/`](projects/hypermedia-cli/_overview.md)       | experimental                              |
| `@cqrs-toolkit/hypermedia-client` | [`projects/hypermedia-client/`](projects/hypermedia-client/_overview.md) | experimental                              |
| `@cqrs-toolkit/realtime`          | [`projects/realtime/`](projects/realtime/_overview.md)                   | experimental                              |
| `@cqrs-toolkit/schema`            | [`projects/schema/`](projects/schema/_overview.md)                       | experimental                              |
| Demo system                       | [`projects/demo/`](projects/demo/_overview.md)                           | not published; reference impl + e2e suite |

The demo system is itself a project castle with three nested sub-projects: `todo`, `hypermedia`, `electron`.

## Conventions

These conventions apply across the whole castle.
Pattern documents in `patterns/` may elaborate; this section is the load-bearing rules.

- **ADR lifecycle.**
  ADRs have two phases.
  **Draft** (Status: `Proposed`) — freely editable while the work the ADR describes is in progress. Refine Context as constraints surface, narrow Decision as the approach converges, capture alternatives tried and rejected as implementation forces changes. The expected pattern is to draft the ADR alongside the feature work and let it evolve; one-shotting the final ADR before the work converges is not the goal.
  **Accepted** (Status: `Accepted YYYY-MM-DD`) — set when the decision lands (typically when the feature merges). Thereafter the ADR is immutable. The only legitimate post-acceptance edits are back-pointers: `Superseded by ADR-NNNN (YYYY-MM-DD)` if a later ADR replaces this one, or `Generalized by ADR-NNNN (YYYY-MM-DD)` if it's promoted to a higher-scope ADR. Substantive changes after acceptance produce a _new_ ADR with a `Supersedes ADR-NNNN` line in its Context; the original stays in place with the back-pointer.

  **Pre-acceptance coherence check.** Before accepting, cross-check the ADR against existing `patterns/`, `mindset/`, and other castle conventions. Deviations resolve one of three ways, in this order of likelihood: **fix the ADR and re-evaluate its implementation** to align with the convention (the default — usually the dev got it wrong); **document the divergence explicitly** in the ADR's Context if it's intentional and the existing convention should still stand; or **update the pattern / mindset entry**, the rarest case — only when a _pattern_ of divergences shows the existing convention no longer fits. A single justified divergence doesn't earn a convention rewrite. Silent deviation degrades the castle.

- **ADR Consequences shape.**
  ADRs structure the Consequences section into three subsections:
  - **Implementation impact** — one-time work to ship the change. Mandatory when implementation work was needed; omitted for pure-policy ADRs. Cost-only — design gains live below.
  - **Operational implications** — ongoing operational effects, with optional `#### Gains` / `#### Costs` subsections; include only the side(s) with content.
  - **Coding implications** — ongoing code-shape effects, with optional `#### Gains` / `#### Costs` subsections; include only the side(s) with content.

  Replaces the older Easier / Harder split, which collapsed time-shape (one-time vs ongoing) and effect-shape (gain vs cost) onto one axis and misframed migration costs as permanent.

  Existing ADRs in the old shape migrate opportunistically — when an ADR is touched for other reasons, restructure its Consequences then. New ADRs use the new shape from this convention's adoption date forward.

- **Date everything.**
  Every changelog entry, every ADR (creation date and acceptance date), every requirements-log entry, every milestone.
  ISO format (YYYY-MM-DD).

- **Two-file pattern, with scaling.**
  Anywhere both _current state_ and _history of changes_ matter, use paired files.
  Small scope: `X.md` + `X-log.md`.
  Large scope (a directory of docs): `X/NNNN-slug.md` + `X/NNNN-slug-log.md` beside each entry.
  Applies to requirements, playbooks, patterns, mindset entries, and any wing-level documents that accrete change history.
  Log files are created **lazily** — at the first substantive change after initial creation, not preemptively.
  Until the first edit, the current-state file stands alone.
  Stubs don't count as substantive content; the log starts when the stub graduates into a real entry.
  The log explains _why_ the change was made; git history covers what changed line-by-line.
  ADRs are the deliberate exception — see _ADR lifecycle_ above; no paired log ever.

  **Drafting workflow.** During active feature work, the current-state file is editable — revise as the work converges. Iterations _while drafting a change_ don't each need their own log entry; the log captures the _net_ delta from the previous finalized state to the new finalized state once the feature lands. Failed alternatives tried during drafting belong in the ADR that proposed the change (not in the spec's `-log`), so the requirement file stays clean and the trial-and-error narrative lives in one place.

- **NNNN-slug.md numbering.**
  ADRs and large-scope requirements use 1-indexed `NNNN-slug.md` filenames, four-digit zero-padded.
  Numbers are never reused; superseded entries keep their number forever.
  During an active migration or batch authoring pass, number ADRs sequentially as you write them, then renumber to chronology in a single pass before committing — chronological ordering matters for the index, but mid-batch renumbering is churn.

- **Link discipline.**
  Cross-cutting concerns get one canonical home and are linked from elsewhere.
  Canonical documents referenced from many places carry a "Referenced from" backlinks section.
  Link text gives enough context to decide whether to follow the link without opening it.
  All file and section references in castle markdown must be actual markdown links — never bare text — so they're greppable and survive renaming or renumbering.
  Link text may be shortened per standard writing practices once a reference is in scope (a doc's first reference can use the full filename; subsequent references can collapse to just the number or a section anchor) — but every instance must still be wrapped in markdown link syntax pointing at the file. The link wrapper is non-negotiable. See [`patterns/documentation-style.md`](patterns/documentation-style.md) for elaborated documentation conventions.

- **Link targets.**
  The castle may link only to (a) files tracked in this git repository or (b) external resources judged stable and durably accessible — IETF / W3C / WHATWG specifications, foundation-hosted language and standards documentation, RFC archives, and similar.
  Vendor product documentation, marketing pages, and blog posts are not stable enough to reference from a long-lived document; their URLs and content are subject to a single company's product decisions and may be restructured or removed without notice.
  Local filesystem paths outside this repository must not appear — they aren't portable across contributors and aren't preserved by clone.
  When external context is genuinely needed and no stable host exists, restate the relevant content inline (with a date if the source is volatile) rather than linking.

- **Wing `_overview.md` indexes.**
  Every populated wing has an `_overview.md` covering its entries with a one-line hook each.
  Empty wings get no overview; it's created lazily with the wing's first meaningful entry.
  Single-entry wings still get one — consistency over file-count minimization.
  A project's root `_overview.md` doesn't duplicate wing indexes — it points to them, plus a small `## Always Read entries` section (cap ~3) for entries every contributor to that project should know regardless of task.
  Wings whose canonical content is itself a chronological document fold the index and the content into one `_overview.md` (e.g., `evolution/_overview.md` is the changelog, labeled internally for what it is).
  Field-by-field shape for both project root and wing-level overviews lives in [`projects/_overview.md`](projects/_overview.md).

- **Place over precision.**
  When uncertain whether something belongs at the repo level or a project level, ask.
  Wrong placement propagates and gets harder to fix as more content accumulates around it.

- **The handoff rule.**
  An agent working in a single project reads this map, then `projects/<name>/_overview.md`, then descends to the package's local `CLAUDE.md` and operates within the project's castle.
  Surface back to the repo level only when the work crosses project boundaries.

## Conflict handling

When the castle and a task are in conflict, surface the conflict.
"This change would violate ADR-NNNN's constraint that X; do you want to update the decision, or should we approach this differently?" is the correct response.
The castle is useless if its contents get silently overridden.

## Reading paths

What to read before what kind of work.
The handoff rule (map → project `_overview.md` → package `CLAUDE.md` → operate locally) sets the orientation; this matrix says which wings to consult past that, for the kind of task at hand.
Use it as guidance, not a recipe — pick the row that fits, follow the leads, descend further as the task reveals what it actually touches.

| When you're...                                        | Read                                                                                                                                                                                                                                                                                                                                                                                                             |
| ----------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Writing tests for an existing requirement             | Existing tests in the package (for style); the relevant `requirements/NNNN-slug.md` (the contract); tail of its `NNNN-slug-log.md` if it exists (recent contract changes); [`patterns/testing.md`](patterns/testing.md) (workflow).                                                                                                                                                                              |
| Fixing a bug                                          | The project's recent `evolution/_overview.md` entries (when was the area last touched?); the relevant requirement (confirm what correct behaviour is); existing tests (coverage gap); [`patterns/testing.md`](patterns/testing.md) (bug-fix workflow). For client async-storage bugs specifically, [`projects/client/mindset/severity-from-invariants.md`](projects/client/mindset/severity-from-invariants.md). |
| Implementing a new requirement on an existing project | `requirements/_overview.md` (the index); `requirements/NNNN-slug.md` for the affected component; tail of its `-log.md` (recent changes and rationale); recent ADRs in the project's `decisions/` (constraints affecting implementation).                                                                                                                                                                         |
| Refactoring or making architectural changes           | _All_ relevant ADRs in the project's `decisions/` — not just recent. Old decisions are exactly where forgotten constraints live. Plus top-level [`decisions/`](decisions/_overview.md) for cross-cutting impact, and any patterns the refactor will touch.                                                                                                                                                       |
| Adding a new feature to an existing project           | The project's `_overview.md` (status, dependencies); top-level [`intent/non-goals.md`](intent/non-goals.md) (am I about to build a non-goal?); `requirements/_overview.md` (what's already specified); top-level [`decisions/`](decisions/_overview.md) for cross-cutting constraints.                                                                                                                           |
| Adding a new package                                  | Top-level [`intent/vision.md`](intent/vision.md), [`intent/architecture.md`](intent/architecture.md), [`intent/non-goals.md`](intent/non-goals.md); existing project `_overview.md` files (depends-on / depended-on-by graph); the "Maintenance habits" section below for what to seed in `projects/<new-pkg>/`.                                                                                                 |
| Coordinating a cross-package refactor                 | Top-level [`decisions/`](decisions/) (cross-cutting ADRs); each affected project's `_overview.md` (depends-on / depended-on-by); each affected project's `decisions/`; repo-level [`evolution/_overview.md`](evolution/_overview.md) (have we coordinated something similar before?).                                                                                                                            |
| Working on the demo system                            | [`projects/demo/_overview.md`](projects/demo/_overview.md) (the four goals); [`projects/demo/patterns/`](projects/demo/patterns/) (`css-state-classes.md`, `e2e-accept-headers.md`); the relevant sub-project's `_overview.md`.                                                                                                                                                                                  |
| Investigating "why is it like this"                   | The relevant project's `decisions/`; tails of `requirements/*-log.md` files; the project's `evolution/_overview.md` and `evolution/milestones/`.                                                                                                                                                                                                                                                                 |
| Diagnosing a class of problem analytically            | Any `mindset/` entries that apply to the problem class; pattern docs that touch the area; recent ADRs that touch the area.                                                                                                                                                                                                                                                                                       |

When the row doesn't fit cleanly, descend toward the wing that _describes_ the kind of question being asked — `intent/` for "what should this do," `explorations/` for "what might we do," `decisions/` for "why is it this way," `evolution/` for "when did this change," `patterns/` for "how do we do X here," `mindset/` for "how do I think about this class of problem," `playbooks/` for "what's the procedure for X."

## Maintenance habits

The castle only stays useful if its contents stay current.
These habits are how that maintenance happens — they apply to anyone (human or agent) working in the repo.

### When to write to the castle

| When you...                                                                                                              | Write to...                                                                                                                                                                                                               |
| ------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Make a non-trivial architectural decision                                                                                | A new ADR in the relevant `decisions/` wing — repo-level if cross-cutting, project-level otherwise. Draft during the session that produced the decision; the reasoning is fresh then and recoverable for hours, not days. |
| Change a requirement (spec drift correction, new spec content, supersession)                                             | Edit the `NNNN-slug.md` requirement file, append to (or create) `NNNN-slug-log.md` beside it citing the ADR, write the ADR. All three writes are a unit.                                                                  |
| Ship a meaningful change that spans packages                                                                             | Append to [`evolution/_overview.md`](evolution/_overview.md).                                                                                                                                                             |
| Ship a meaningful change inside one project                                                                              | Append to that project's `evolution/_overview.md` (e.g. [`projects/client/evolution/_overview.md`](projects/client/evolution/_overview.md)).                                                                              |
| Deprecate or remove something                                                                                            | Append to the relevant `evolution/deprecations.md` (create the file if it doesn't exist). Capture the date, reason, and migration path. Don't silently delete.                                                            |
| Add a new package                                                                                                        | Create `docs/projects/<pkg>/_overview.md`, add an entry to the projects table in this map, and add a minimal `packages/<pkg>/CLAUDE.md` castle pointer.                                                                   |
| Discover a normative convention worth codifying                                                                          | Pattern entry in the right-scoped `patterns/` wing (repo, project, or sub-project). Add an ADR if the rationale is genuinely recoverable; don't fabricate one.                                                            |
| Discover a recurring activity worth codifying (on the _second_ occurrence, not the first)                                | Playbook in the right-scoped `playbooks/` wing.                                                                                                                                                                           |
| Discover a recurring problem-class worth a shared analytical framing                                                     | Mindset entry in the right-scoped `mindset/` wing.                                                                                                                                                                        |
| Identify an open design question worth tracking — alternatives under evaluation, things to investigate before committing | Exploration entry in the right-scoped `explorations/` wing. The entry resolves up (to a requirement, ADR, or pattern) when settled, or is archived in place with a reason if investigated and rejected.                   |
| Edit anything in the castle                                                                                              | Run `scripts/audit-links.sh` afterwards to verify no broken links.                                                                                                                                                        |

### Habits during a session

- **Read this map first**, then descend to the relevant project's `_overview.md`, then the package's local `CLAUDE.md` if scope is single-package.
- **When uncertain where something belongs, ask** before writing.
  Run the placement test first:
  1. **What kind of content is it?**
     - "What it should do" (spec, requirement, vocabulary) → `intent/`.
     - "What we're considering" (open question, design alternative under evaluation) → `explorations/`.
     - "Why we chose this" (one decision with rationale) → `decisions/` (immutable ADR).
     - "What happened, when" (history, milestones, deprecations) → `evolution/`.
     - "How we do X here" (action convention, code style) → `patterns/`.
     - "How to perform a recurring procedure" (release, deprecation, cross-package refactor) → `playbooks/`.
     - "How to think about a class of problem" (analytical framing) → `mindset/`.
  2. **What scope does it apply at?**
     - Spans multiple projects → top-level wing (`docs/<wing>/`).
     - Lives inside one project (package or demo system) → `docs/projects/<name>/<wing>/`.
     - Lives inside one sub-project (a specific demo) → `docs/projects/<parent>/projects/<sub>/<wing>/`.
  3. **Does it already have a canonical home?**
     If yes, link to that home rather than duplicating.
     If two callers would benefit from the same content, give it one home and link from both.

  If you can't confidently answer (1) and (2), ask before writing.
  Inconsistent placement is worse than no documentation — it teaches future sessions the wrong organisational pattern.

- **When a task conflicts with the castle, surface the conflict** rather than silently overriding (see "Conflict handling" above).
- **Date everything.**
  Every changelog entry, every ADR (creation + acceptance), every requirements-log entry, every milestone.
  ISO format (YYYY-MM-DD).

### Promoting castle content to a higher scope

When content at one castle level proves applicable at a higher level (e.g., a project-scoped pattern adopted repo-wide; a project-scoped ADR that turns out to apply across packages), promote it deliberately.

- **Wings that promote:** `decisions/`, `patterns/`, `mindset/`, `playbooks/`, `explorations/` (rare — explorations tend to be project-specific).
- **Wings that don't:** `intent/`, `evolution/`, and `atlas/` are scoped to the level they describe — they coexist across levels rather than promote.

For the procedure, see [`playbooks/promoting-castle-content.md`](playbooks/promoting-castle-content.md).

### What not to do

- **Don't create empty wings preemptively.**
  A wing exists when it has content; absent wings are normal.
  Filing a `_overview.md` in a project is enough; `intent/`, `explorations/`, `decisions/`, `evolution/`, `atlas/`, `patterns/`, `playbooks/`, `mindset/` get created when there's content to put in them.
- **Don't create paired `-log.md` files preemptively.**
  Logs are created lazily — at the first substantive change, not at current-state-file creation.
- **Never edit accepted ADRs** except to add a "Superseded by ADR-NNNN (YYYY-MM-DD)" or "Generalized by ADR-NNNN (YYYY-MM-DD)" back-pointer.
  Drafts (Status: `Proposed`) are freely editable — see _ADR lifecycle_ in the Conventions section above.
  If circumstances change for an accepted ADR, write a new ADR that supersedes the old one.
- **Don't bulk-import private working memory into the castle.**
  Untracked working dirs and scratch files (planning notes, design memos, ad-hoc TODOs, agent memory — anything in `.gitignore` or `.git/info/exclude` that holds working content) are _undecided_ content; the user hasn't yet committed them to the castle. Each piece is a per-item decision: most often it maps to `explorations/` (open questions, candidate approaches not yet committed), sometimes to `intent/` or another wing, sometimes nowhere. Either it gets extracted into the right wing — and deleted from working memory — or it stays where it is. Bulk-importing skips the per-item judgment.
- **Don't fabricate retrospective ADRs.**
  If you can clearly state context, decision, and consequences from existing material, write the ADR.
  If you'd be inventing the reasoning, don't — leave a brief note in the relevant `_overview.md` instead, and let real future ADRs accumulate naturally.

## Cross-wing constraints

Some load-bearing constraints don't have a single home — they shape every architectural decision in the project, so they manifest in multiple wings at once. Examples: a self-hostable-deployment commitment, a strict-type-system stance, a `Result`-based error-handling discipline, a pre-release-no-back-compat posture.

The pattern: each such constraint has a _primary home in `intent/`_, with _manifestations in `decisions/`, `patterns/`, and (sometimes) `requirements/`_. Each wing answers a different question about the same constraint:

- _intent/_ — what is the project committing to?
- _decisions/_ — why did we commit to it (alternatives considered, trade-offs accepted)?
- _patterns/_ — what rule do contributors apply when the constraint binds new work?
- _requirements/_ — what's the formal contract for things that operationalize it (when applicable)?

### Placement

| Wing            | What it holds                                                                                                                            | Required?                                                 |
| --------------- | ---------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------- |
| `intent/`       | The constraint statement — see "Picking between architecture.md and non-goals.md" below. Single canonical home for the statement itself. | Yes                                                       |
| `decisions/`    | An ADR capturing the _why_. Future contributors who wonder "why don't we just use X?" find the answer here.                              | Yes for load-bearing constraints                          |
| `patterns/`     | The how-to-maintain-it convention — the rule contributors apply when adding new work that touches the constraint.                        | When the constraint binds future work                     |
| `requirements/` | A per-component contract when the constraint operationalizes into something testable or depended-on by name.                             | Only when the operationalization stabilizes as a contract |

### Picking between `architecture.md` and `non-goals.md` (intent home)

The constraint is _one statement_ — pick one file based on which framing is primary.

- **`architecture.md`** when the constraint is a positive structural commitment ("designed to run single-machine; services abstracted").
- **`non-goals.md`** when the constraint is an explicit exclusion that guards against a reader's likely assumption ("not an authentication service", "not multi-tenant").

The test: would a reader of `vision.md` + `architecture.md` reasonably _assume_ the project does X when it deliberately doesn't? If yes → non-goals earns its keep. If no → architecture covers it; non-goals would be redundant.

Don't duplicate the statement across both files. Link-discipline rule applies.

### Worked example: self-hostable architecture

Constraint: "Single-machine hostable; only self-hostable services; abstract external APIs for local↔prod swap."

- **`intent/architecture.md`** — "Designed to run on a single machine (docker-compose / minikube) end-to-end. External-service dependencies accessed through abstracted interfaces; local development uses self-hostable implementations; production may swap to managed equivalents without code changes."
- **`decisions/NNNN-self-hostable-deployment-architecture.md`** — Context (who needs it, what alternatives were considered), Decision (the constraint plus abstraction strategy), Consequences (more code for abstractions, harder vendor-specific optimization, easier local dev / air-gapped deployment).
- **`patterns/external-service-abstraction.md`** — "When adding a new external service dependency: define an interface; ship a self-hostable implementation that runs in the local stack; document the production-equivalent swap. Never directly import a vendor SDK from domain code."
- _(Non-goals skipped — the architecture statement implies "not vendor-locked." Requirements skipped until the dev-environment shape becomes a documented contract.)_

## Migration status

The castle was adopted 2026-05-04 as part of a memory-palace migration.
All migration phases complete — see [`evolution/_overview.md`](evolution/_overview.md) for a phase-by-phase summary.
The link audit ([`scripts/audit-links.sh`](../scripts/audit-links.sh) at the repo root) reports zero broken links.
