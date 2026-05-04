# The Project Memory Palace: A Primer

You are being asked to help convert this project's existing documentation into a structured "memory palace" (or "castle") — a deliberately organized documentation tree that lets future agents (and humans) navigate intent, history, and reasoning without crawling the codebase or re-deriving lost context. The project already has substantial documentation, some of it stale. The CLAUDE.md file contains architecture framing that probably belongs elsewhere. The codebase is a monorepo with multiple related projects and their demos. The goal of this work is to land a _mature_ castle within a day or two of focused effort.

This primer explains the whole approach so you can apply judgment, not just follow steps. Read it through once before doing anything. Then walk the existing documentation and CLAUDE.md with this primer in mind before proposing a migration plan.

---

## Part 1: The concept

### Why a memory palace

Code shows what was built. It does not show what was intended, what was rejected, what constraints made the chosen path the right one, or how the project's understanding of itself has evolved. That information lives in people's heads, in old chat logs, in commit messages of varying quality, and in documentation files that drift out of sync with reality.

The memory palace is a way of organizing project documentation so that this normally-invisible knowledge becomes durable and navigable. The metaphor is the classical method of loci: information has a _place_, and you retrieve it by walking to that place. In our version, the places are directories and the contents are markdown files, linked together so that following references mimics associative recall.

The structure is fractal. The top-level project castle has wings. Features inside the project have their own miniature castles with the same wing structure. Cross-cutting concerns live at the level where they apply and are linked from everywhere they're relevant.

### Three kinds of knowledge, three wings

The castle is built around the recognition that documentation answers three different kinds of questions, each with a different update pattern:

**Intent** — what the project is meant to do. Slow-changing, deliberately edited. Answers "what are we building and what are we not building?"

**Evolution** — how the project got to where it is. Append-only, narrative, dated. Answers "what happened and when?"

**Decisions** — why specific choices were made. Append-only, immutable once accepted, linked aggressively. Answers "why is it this way and what were the alternatives?"

These map to three top-level wings in the project castle:

```
docs/
  map.md                    # entrance hall: index and conventions
  intent/                   # what the project is meant to do
    vision.md
    non-goals.md
    glossary.md
  evolution/                # how it got here, append-only
    changelog.md
    milestones/
    deprecations.md
  decisions/                # why choices were made (ADRs)
    0001-<slug>.md
    0002-<slug>.md
    ...
  features/                 # feature-level rooms (see Part 2)
    <feature-name>/
      _overview.md
      intent/
      decisions/
      evolution/
  packages/                 # mirror of code structure where useful
    <package-name>/
      _overview.md
      decisions/
```

Each feature room repeats the wing structure inside it. Top-level wings hold things that span features. Feature-level wings hold things that live and die with the feature.

### Architecture Decision Records (ADRs)

The decisions wing is built from ADRs. An ADR is a numbered, dated, immutable markdown file that captures one significant decision. The standard sections are:

- **Status** — proposed, accepted, superseded by ADR-NNNN, deprecated
- **Context** — what situation prompted the decision, what constraints existed
- **Decision** — what was chosen
- **Consequences** — what becomes easier, harder, or different as a result

ADRs link aggressively: to the requirements they satisfy, to milestones where they were implemented, to prior decisions they build on or supersede.

The immutability rule is critical. **You do not edit an accepted ADR.** If circumstances change, you write a new ADR that supersedes the old one and add a "Superseded by ADR-NNNN" back-pointer to the original. That back-pointer is the _only_ legitimate post-acceptance edit. This rule preserves an honest historical record instead of a constantly-rewritten "current truth" that loses its own reasoning.

### The two-file pattern for evolving specs

Anywhere both _current state_ and _history of changes_ matter, use two files:

- `requirements.md` (or similar) — the current state, edited freely
- `requirements-log.md` — append-only history of changes, each entry dated and linked to the ADR that drove the change

This applies to feature requirements, API contracts, data models — anywhere the "what is true now" and "how it got that way" questions both deserve good answers.

### Links over duplication

Cross-cutting concerns are handled by giving each piece of information one canonical home and linking to it from everywhere else it's relevant. A meeting that affects three features lives in one chronological place; each feature's decisions wing links to it with context. Duplication causes drift; links don't.

Two link conventions matter:

**Backlinks.** When something gets linked from multiple places, it should know about its callers. The canonical document gets a "Referenced from:" section listing the files that point to it. Without backlinks, a canonical document becomes an orphan from its own perspective and you can't navigate from it back to its dependents.

**Contextual link text.** `[pricing review where we agreed to tiered enterprise rates](../meetings/2026-05-04.md)` is far more useful than `[pricing review](../meetings/2026-05-04.md)`. The link text should help the reader decide whether following it is worth it without opening the file.

---

## Part 2: Feature rooms

For a monorepo with multiple related projects, the most important pattern is that **each feature (or sub-project) is a room with its own castle structure inside it**:

```
docs/features/<feature-name>/
  _overview.md              # the room's entrance hall
  intent/
    requirements.md         # current spec
    requirements-log.md     # change history
    non-goals.md
  decisions/
    0001-<slug>.md
    0002-<slug>.md
  evolution/
    changelog.md
    milestones/
```

The `_overview.md` is doing significant work. It's what an agent reads first when entering the feature, and it should give enough context to make further reading targeted. A reasonable template:

```markdown
# <Feature Name>

**Status:** Active / Mature / Deprecated
**Owners:** <team or person>
**Depends on:** <other features>
**Depended on by:** <other features>

## Purpose

One paragraph: what this feature does and why it exists.

## Current state

One paragraph: what works, what's in progress, what's planned.
Link to requirements.md for the spec.

## Recent significant decisions

- ADR-NNNN: <slug> (YYYY-MM)
- ADR-NNNN: <slug> (YYYY-MM)

## Recent significant changes

See changelog.md; last updated YYYY-MM-DD.

## Where things live

- Code: <paths>
- Tests: <paths>
- Demos: <paths>
- Runbooks: <paths if applicable>
```

The "Where things live" section is especially valuable in a monorepo because the relationship between docs and code isn't always one-to-one.

### What goes top-level vs. inside a feature

The dividing rule:

**Top-level wings hold things that span multiple features.** Project vision, monorepo-wide architectural decisions, cross-cutting milestones.

**Feature-level wings hold things that live and die with the feature.** Decisions that only constrain that feature. Requirements specific to it. Its own changelog.

When a feature-level concern grows to span features, _promote_ the relevant ADR to the top level and leave a stub link from the feature where it originated. Promotion is deliberate, not silent.

---

## Part 3: How to read the castle

Different operations require different reading paths. The principle is: read what gives you context to _act correctly_ before acting, but don't exhaust your context loading documents you won't use.

**Always read first, every session:**

- `docs/map.md` — small, primes everything else
- The `_overview.md` of any feature you'll touch

**Operation-to-reading-path:**

_Writing tests for an existing feature:_ feature's existing tests (style), feature's `requirements.md` (behavior to cover), tail of feature's `changelog.md` (recent changes that may have stale coverage).

_Implementing a new requirement on an existing feature:_ `requirements.md`, then tail of `requirements-log.md` (what just changed and why), then recent ADRs in the feature's `decisions/` (constraints affecting implementation), with `_overview.md` first to establish dependencies.

_Refactoring or architectural changes:_ all relevant ADRs in the feature's `decisions/` (not just recent — old decisions are exactly the ones most likely to contain forgotten constraints), plus top-level `decisions/` for cross-cutting impact.

_Fixing a bug:_ recent changelog entries (bug was likely introduced or exposed recently), relevant `requirements.md` (confirm what correct behavior even is), tests (existing coverage and gap).

_Adding a new feature:_ top-level `intent/vision.md` and `intent/non-goals.md`, `_overview.md` of any features it'll integrate with, top-level ADRs for cross-cutting constraints.

**When uncertain:** read `_overview.md` first. It's designed to make further reading targeted.

**When something feels wrong:** the castle and the task may be in conflict. Surface the conflict, don't silently resolve it. "This change would violate ADR-0017's constraint that X; do you want to update the decision, or should we approach this differently?" is the correct response. The castle is useless if its contents get ignored.

---

## Part 4: How to write the castle

### What triggers a write

**A new ADR** is created when a significant decision is made. Not every decision — significant ones. Heuristic: if a future contributor would benefit from understanding _why_ this was chosen, it warrants an ADR. If the decision is obvious or trivial, it doesn't.

**A requirements update** edits `requirements.md` (current state) AND appends to `requirements-log.md` (history) AND usually triggers a new ADR explaining the change. These three writes are a unit. Doing one without the others corrupts the structure.

**A changelog entry** is written when a feature ships a meaningful change. Cross-feature changes also get a top-level changelog entry. Date everything.

**A deprecation entry** is written when something is being removed or replaced. Include date, reason, and migration path. This wing is the most often neglected and the one whose absence causes the most pain later.

### ADR mechanics

ADRs are numbered sequentially across the wing they live in (top-level or feature-level — feature-level ADRs are numbered within their feature). Numbers are never reused. A superseded ADR keeps its number forever.

Filenames: `NNNN-short-slug.md`. Four-digit zero-padded numbers. Lowercase hyphenated slug.

The "Status" field starts as `Proposed`. When accepted, change to `Accepted` with the acceptance date. After this point, the ADR is immutable except for adding a "Superseded by ADR-NNNN (YYYY-MM-DD)" line if the decision is later replaced.

When superseding an ADR, write the new ADR with a "Supersedes ADR-NNNN" line in its context section, then add the back-pointer to the old ADR. This is the only post-acceptance edit allowed.

### Date everything

Every changelog entry, every ADR (creation date and acceptance date), every requirements-log entry, every milestone. "Recent" is meaningless without dates. ISO format (YYYY-MM-DD) preferred.

### Where to put things — the placement test

Before writing a new file, answer:

1. Is this about _what we're building_ (intent), _what happened_ (evolution), or _why we chose_ (decision)?
2. Does it span multiple features (top-level) or live inside one (feature-level)?
3. Does it already have a canonical home somewhere? If so, link to that home rather than duplicating.

If you can't confidently answer these, ask before writing. Inconsistent placement is worse than no documentation because it teaches future sessions the wrong organizational pattern.

### CLAUDE.md is a map, not the territory

The CLAUDE.md file at the project root should be small, link-heavy, and focused on _behavior_ — how to use the castle — not on _content_. The map.md inside the docs tree is the structural index. Don't duplicate it in CLAUDE.md; the two will drift.

CLAUDE.md should contain:

- A short orientation pointing at `docs/map.md`
- An operations section with reading/writing patterns for common tasks (see Part 3)
- A conventions section covering ADR immutability, dating, the two-file pattern, link discipline
- A conflict-handling section: when the castle and a task disagree, surface it

The architecture framing currently in CLAUDE.md is almost certainly content that should move into the castle — likely some combination of `intent/vision.md`, top-level ADRs, and feature `_overview.md` files. Strip CLAUDE.md down to behavioral guidance and let the castle hold the content.

---

## Part 5: Migrating the existing documentation

This project has substantial existing docs, some stale. CLAUDE.md has architecture framing that should move. There are demos proving things work. The migration is a real piece of work but it's tractable in a day or two of focused effort if you approach it in the right order.

**Do not** start by creating empty wings and then trying to fill them. The structure should be pulled into existence by the content, not pushed by the template. Start by inventorying what exists and letting the structure emerge from the inventory.

### Phase 1: Inventory and triage (don't write yet)

Walk the repository and catalog every documentation artifact. This includes:

- All markdown files in the repo (`README.md` files, docs directories, design notes, anything)
- The current `CLAUDE.md` file, section by section
- Other agent memory or instruction files (`.cursorrules`, `.claude/`, etc.)
- Substantive comments at the top of code files that document intent or rationale
- Per-package READMEs

For each artifact, classify into one of:

- **Intent** — describes what something is meant to do
- **Evolution** — describes what happened or how things changed
- **Decision** — captures _why_ something was done a particular way
- **Reference** — API documentation, generated docs, or material that should stay where it is and not move into the castle
- **Stale** — documents something that no longer reflects reality
- **Mixed** — contains multiple kinds and will need splitting

For "Stale" items, note whether they describe (a) something that was removed, (b) something that changed but the doc didn't update, or (c) intent that was abandoned. Each case has a different fate (deprecations entry, requirements update + log entry + new ADR, or non-goal addition + ADR).

Produce this inventory as a working document before writing any castle content. Share it with the user (the human you're working with) to confirm the classification before acting on it. Stale documentation in particular is a place where you'll want their judgment — they know which "stale" docs are actually stale versus which are aspirational and still load-bearing.

### Phase 2: Identify features

In a monorepo with multiple related projects and demos, the feature decomposition is often the hardest call. Some heuristics:

- Each top-level project usually maps to a feature room
- Each demo usually maps to a feature room or lives inside one
- A shared library that's used across projects is its own feature room (often under `docs/packages/`)
- If two "things" are always discussed together and always change together, they may be one feature, not two

Sketch the feature list and confirm with the user before building the rooms. Wrong feature decomposition is the structural mistake hardest to fix later.

### Phase 3: Build the skeleton, minimally

Once features are agreed:

1. Create `docs/map.md` with the wing index and feature list (one line per feature with a link to its overview)
2. For each feature, create the directory and an `_overview.md` populated from existing docs and your inventory
3. Create top-level `docs/intent/`, `docs/evolution/`, `docs/decisions/` as empty directories with a single `README.md` in each describing what goes there
4. Do **not** create empty `intent/`, `decisions/`, `evolution/` subdirectories inside features yet. Add them only when you have content to put in them.

The feature `_overview.md` files are the load-bearing artifacts at this stage. Get them right.

### Phase 4: Migrate intent

Move content classified as intent into the appropriate wing:

- Project-wide vision and non-goals → `docs/intent/vision.md` and `docs/intent/non-goals.md`
- Feature-specific requirements → `docs/features/<feature>/intent/requirements.md`
- Glossary terms → `docs/intent/glossary.md`

For each move, ask: is this still accurate? If yes, move it. If no, note it for the deprecation/correction pass in Phase 6.

### Phase 5: Extract decisions retroactively

This is the most subjective phase and the one most worth slowing down on. Walk the existing documentation, the CLAUDE.md architecture sections, and (carefully) your inventory of code comments. For each piece of reasoning that explains _why_ something is the way it is, decide whether it deserves an ADR.

Retroactive ADRs are honest only when the reasoning is recoverable. If you can clearly state context, decision, and consequences from existing material, write the ADR. If you'd be inventing the reasoning, **don't** — instead, write a brief note in the relevant `_overview.md` that "this area lacks documented decision history; ADRs will be created as decisions arise going forward."

This restraint matters. Fabricated retrospective ADRs are worse than missing ones because they teach future sessions that the format is fiction.

Number ADRs sequentially as you write them. Date them with the date of the original decision if known, or mark them "Documented YYYY-MM-DD; original decision date unknown."

### Phase 6: Capture evolution and deprecate the stale

For evolution:

- Major historical milestones get entries in `docs/evolution/milestones/`
- Recent significant changes get entries in `docs/evolution/changelog.md` and feature-level changelogs

For stale documentation:

- If it describes something that was removed: write a `docs/evolution/deprecations.md` entry (or feature-level equivalent), then delete or archive the stale doc
- If it describes something that changed: update the corresponding `requirements.md`, log the change in `requirements-log.md`, and write an ADR for the change
- If it describes abandoned intent: add to `non-goals.md` with an ADR explaining why it was abandoned, then delete the stale doc

Do not silently delete stale documentation. Every stale doc represents a decision that was made (even if implicitly) — capture it before removing the trace.

### Phase 7: Slim down CLAUDE.md

Once content has migrated into the castle, rewrite CLAUDE.md as a behavioral guide pointing into the castle:

- Short orientation pointing at `docs/map.md`
- Operations section (reading/writing patterns)
- Conventions section
- Conflict-handling section

Anything substantive that was in the old CLAUDE.md should now be in the castle, with CLAUDE.md linking to it rather than containing it.

### Phase 8: Audit links and dust the castle

Before declaring the migration complete:

- Walk every link in the castle and confirm it resolves
- For each canonical document referenced from multiple places, ensure the "Referenced from:" backlinks are present
- For each ADR, confirm its status field is set and dated
- Confirm the `map.md` accurately reflects the structure

This is the renovation pass. After this, the castle is mature.

---

## Part 6: Habits to leave in place

Once the migration is done, the castle only stays useful if maintenance habits persist. Encode these in the new CLAUDE.md:

**Read `map.md` first, every session.**

**When making a real architectural decision, write an ADR.** Draft it during the session that produced the decision; the reasoning is fresh then and recoverable for hours, not days.

**When changing requirements, do all three writes:** edit `requirements.md`, append to `requirements-log.md`, write the ADR.

**When shipping a meaningful change, append to the changelog.**

**Never edit accepted ADRs except to add supersession back-pointers.**

**Date everything.**

**When a task conflicts with the castle, surface the conflict.**

**When uncertain where something belongs, ask before writing.**

---

## Part 7: How to start

Read this primer end to end. Then:

1. Walk `docs/`, `CLAUDE.md`, any agent memory files, and the project's per-package READMEs. Don't change anything yet.
2. Produce the Phase 1 inventory as a working document.
3. Propose a feature decomposition (Phase 2) for confirmation.
4. Confirm with the user before proceeding to Phase 3 onward.

The first two steps are reversible. After step 3 you'll be moving and rewriting files, so the user's confirmation of inventory and feature list before that point is what makes the rest of the work safe to do at speed.

The goal at the end of this work is a castle a fresh Claude Code session can navigate to come up to speed on the project — its intent, its history, its reasoning — by reading a handful of well-linked files instead of doing code archaeology. That's the test of success: not whether the structure is pretty, but whether a stranger to the project could orient inside it in fifteen minutes.
