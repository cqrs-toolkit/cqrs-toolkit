# The Meta-Castle: A Primer

You have already read the project memory palace primer and are working through (or have completed) the migration of this monorepo's documentation into a project castle. This primer extends that work in two directions: the **repo-level castle** that organizes cross-cutting concerns spanning the packages inside this monorepo, and the **personal meta-castle** that lives outside the repo entirely and holds knowledge that crosses projects.

The repo-level castle is something you should start using _now_, during the monorepo migration, because cross-cutting concerns are exactly the things you'll encounter as you move documentation around and they need a clean home. The personal meta-castle is something the user wants to start building, possibly during this work — at minimum we want to seed it with the things that genuinely belong to that layer rather than letting them accumulate in the wrong place.

Read this primer through once before continuing the migration. The structure it describes affects classification calls you'll be making in real time, especially Phase 2 (feature/package decomposition) and Phase 5 (extracting decisions retroactively).

---

## Part 1: Three layers of memory

The project castle you've been building answers questions about _this project_. It holds intent, evolution, and decisions specific to the work in this repository.

But not all the knowledge that affects this project lives inside the project. There are at least two other layers:

**The repo-level castle** sits _above_ individual packages in this monorepo. It holds cross-cutting concerns that span packages — shared conventions, repo-wide ADRs, infrastructure decisions, demos that prove the system works as a whole. It's a project castle, just at the scale of "the repository as a whole" rather than "one package inside it."

**The personal meta-castle** sits _outside_ the repo entirely. It holds knowledge that spans projects — accumulated practice, patterns the user has used across multiple efforts, playbooks for recurring activities, and a registry of all projects that point into their individual castles. It's the user's institutional memory of their own work as a whole.

The three layers form a containment hierarchy:

```
Personal meta-castle (~/palace/)
  └── knows about → multiple project castles, including this monorepo
       └── this monorepo's repo-level castle (docs/ at repo root)
            └── knows about → multiple package castles inside the repo
                 └── package castle (packages/<name>/docs/)
                      └── may have feature rooms inside it
```

Each layer holds what's true at _its_ scope and points at the next layer down for anything more specific.

This primer covers the top two layers. The bottom (project and feature) is what the project memory palace primer already handled.

---

## Part 2: The repo-level castle

### What it is

The repo-level castle is a project castle whose "project" is the monorepo as a whole. The same wing structure applies — intent, evolution, decisions — and the same conventions (ADRs, two-file pattern, link discipline, dating) apply at this level too.

What's different is the scope of what each wing holds. At the repo level, the wings hold things that span packages or describe the repo as a unified artifact. Things specific to one package go in that package's own castle, not here.

### Structure

```
docs/                          # at the repo root; your migration target
  CLAUDE.md                    # auto-loaded; repo-wide operational guidance
  map.md                       # repo-wide structural index

  intent/                      # what this monorepo as a whole is for
    vision.md
    non-goals.md
    glossary.md                # vocabulary shared across packages

  decisions/                   # ADRs that affect the repo as a whole
    0001-monorepo-layout.md
    0002-shared-build-system.md
    ...

  evolution/                   # repo-wide history
    changelog.md
    milestones/
    deprecations.md

  patterns/                    # repo-internal conventions
    error-handling.md
    api-versioning.md
    testing-strategy.md

  playbooks/                   # how to do recurring repo-level activities
    adding-a-new-package.md
    deprecating-a-package.md
    cross-package-refactor.md

  packages/                    # registry of package castles (pointers + summaries)
    package-a.md
    package-b.md
    ...
```

Each package then has its own project castle in its own subtree:

```
packages/package-a/
  src/
  tests/
  docs/                        # this package's project castle
    CLAUDE.md                  # package-local operational guidance
    map.md
    intent/
    decisions/                 # package-specific ADRs
    evolution/
    features/                  # if the package is large enough to need them
```

### What goes at the repo level vs. inside a package

The dividing rule is the same one used for top-level vs. feature-level inside a project castle, just at a different scale:

**Repo-level wings hold what spans packages.** Build system, CI, repo-wide conventions, infrastructure decisions, the vision for the repo as a whole, the milestone marking a multi-package release, demos that prove the system as a whole works.

**Package-level wings hold what's specific to that package.** A package's internal architecture decisions, its requirements, its changelog of changes that don't affect other packages, its own features and demos.

When a decision _currently_ affects only one package but might generalize, write it as a package-level ADR initially. Promote it to the repo level only when another package actually adopts it. Premature promotion creates repo-level decisions that don't really apply uniformly, which corrupts the trust in the wing. Promotion is a deliberate act: write a new repo-level ADR, mark it as "promoted from packages/X/docs/decisions/000Y" in its context, and add a back-pointer in the original.

### The packages/ wing is a registry, not a duplicate

The most important wing of the repo-level castle for this monorepo is `packages/`. It contains one file per package, and each file is a thin pointer document — _not_ a copy of the package's documentation. The package's own castle owns the substantive content.

Template for a package registry entry:

```markdown
# package-a

**Status:** Active | Mature | Deprecated
**Castle:** [packages/package-a/docs/](../../packages/package-a/docs/)
**Purpose:** One sentence: what this package does
**Public API:** stable | experimental | internal-only
**Owners:** <team or person>
**Depends on (within repo):** package-x, shared-utils
**Depended on by (within repo):** service-y, demo-z
**External dependencies of note:** <noteworthy ones, not exhaustive>

## Recent significant decisions

- Local ADR-NNNN: <slug> (YYYY-MM)
- Local ADR-NNNN: <slug> (YYYY-MM)

## Recent significant changes

See packages/package-a/docs/evolution/changelog.md.
```

The "Depends on / Depended on by" sections are doing real work in a monorepo specifically. They make impact radius visible — anyone (human or agent) considering a change to a shared package can see at a glance what else might be affected. This is documentation that the build system also encodes, but in a form readable without running tooling.

### Patterns at the repo level are normative

Patterns at the personal meta-castle level (Part 3) are descriptive — "approaches that have worked across my projects." Patterns at the repo level are **normative** — "this is how things are done in this repo." A repo-level pattern is closer to a style guide than to a personal note.

Template for a repo-level pattern:

```markdown
# Error handling

## Convention

[How errors are handled across this repo: types, propagation, logging, etc.]

## Rationale

Established by ADR-NNNN. Refined by ADR-MMMM.

## Where applied

- package-a: standard adoption
- package-b: standard adoption with one deviation — see packages/package-b/docs/decisions/000X-error-handling-deviation.md
- package-c: legacy code, partial adoption — see packages/package-c/docs/decisions/000Y-error-handling-migration.md

## Exceptions and known issues

[Where the convention doesn't fit and what we do instead, with links to ADRs that document the exceptions]
```

The "Where applied" section is what makes the pattern grounded rather than aspirational. If a pattern claims to be a repo convention but no package follows it, that's a fiction — either the pattern is being newly proposed (and should be marked as such) or it should be retired.

### Playbooks for repo-level activities

Playbooks are step-by-step procedures for recurring repo-level work. The candidates that earn their place in this wing are activities that:

- Cross multiple packages (so individual package CLAUDE.md files can't cover them)
- Recur often enough that codifying them saves real effort
- Have non-obvious steps that have caused problems before

Likely starting playbooks for this monorepo:

- **adding-a-new-package.md** — directory structure, what to set up, where to register it, what ADRs to write
- **deprecating-a-package.md** — how to retire a package without breaking dependents
- **cross-package-refactor.md** — how to coordinate changes that touch multiple packages, including the milestone-and-changelog discipline
- **bumping-a-shared-dependency.md** — if relevant
- **promoting-a-pattern-to-repo-level.md** — the procedure for moving a successful pattern from one package up to a repo-wide convention

Don't create playbook files preemptively for activities that haven't actually recurred. Wait for the second occurrence and write the playbook then, when you have two data points to abstract from.

### CLAUDE.md hierarchy

The monorepo has CLAUDE.md files at multiple levels:

```
CLAUDE.md                              # repo root: auto-loaded
packages/package-a/CLAUDE.md           # package-specific operational guidance
packages/package-b/CLAUDE.md
...
```

The repo-root CLAUDE.md is the one that auto-loads, so it has to do double duty: enough orientation that any task can start from it, plus pointers into package-level CLAUDE.md files for deeper work. Suggested structure:

- One paragraph on what this repo is, with a pointer to `docs/intent/vision.md`
- The packages list with one-line descriptions and links to each package's CLAUDE.md
- Repo-wide conventions: error handling, testing, ADR practice, link discipline (or pointers to those pattern files)
- Operations for repo-level tasks: cross-package work, adding a new package
- The handoff rule (next section)

Each package's CLAUDE.md is shorter and more focused — operations specific to that package, conventions that diverge from repo defaults (with reasons), and the local map.

### The handoff rule

When a task is scoped to a single package, the agent should follow this sequence:

1. Read the auto-loaded repo-root CLAUDE.md
2. Read `docs/map.md` to confirm scope and locate the relevant package
3. Read `docs/packages/<package>.md` to understand its place in the repo
4. **Hand off** to the package's own CLAUDE.md and operate within the package's castle
5. Surface back to the repo level only if the work crosses package boundaries

The handoff is the key idea. The agent doesn't try to hold both castles in working context simultaneously — it uses the repo-level castle to orient, then descends and operates with the package's local guidance. This keeps context budgets reasonable and concerns separated.

For tasks that _do_ span multiple packages, the agent operates primarily at the repo level (with the relevant playbook open) and consults each package's castle as needed for local context. Cross-package work is exactly what the repo-level castle exists for; it's the time to be at that level rather than diving into one package.

### Demos and how they're classified

This monorepo contains demos that prove things work. Classify them during the migration:

**Package-internal demos** — demos that exist to show how a single package works in isolation — live inside that package's castle. Their existence is mentioned in the package's `_overview.md`. They don't appear at the repo level except as a line in the package registry entry.

**System demos** — demos that show multiple packages composing into a working system — are cross-cutting artifacts and deserve their own room at the repo level. Options for placement:

- `docs/demos/` as a dedicated wing with one file per demo
- A top-level `features/` wing in the repo-level castle, with each system demo treated as a feature

The system-demo room (regardless of which placement) holds intent (what the demo is supposed to prove), evolution (how the demo has changed as the system has changed), and decisions (architectural choices specific to how the demo is constructed). It links to the packages it composes.

The principle is the same as elsewhere: place things where they live and die. A demo that exists to prove one package works belongs to that package. A demo that proves the system works belongs to the system.

---

## Part 3: The personal meta-castle

The user wants to begin building a personal meta-castle — a layer above this repo and any other projects they work on, that holds knowledge crossing projects. This section explains what that layer is, why we're seeding it during the monorepo migration, and what specifically to put there now versus what to defer.

### What it is

The personal meta-castle is the user's institutional memory of their own practice across all projects. It holds:

- A registry of projects (active, dormant, archived) with pointers into each project's castle
- Patterns: distilled approaches that have worked across multiple projects
- Domains: subject-matter expertise the user has accumulated
- Playbooks: procedures for recurring activities that cross projects (e.g., starting a new project, doing a security review)
- A cross-project journal: the personal-history layer above individual project changelogs

Unlike the repo-level castle, the personal meta-castle is **descriptive, not normative**. It captures what the user has learned, what they've done before, and how they tend to approach things. It doesn't dictate; it informs.

### Suggested structure

```
~/palace/                        # location is the user's choice
  CLAUDE.md                      # operational guidance for cross-project work
  map.md                         # entrance hall

  projects/                      # registry of project castles
    active/
      <this-monorepo>.md         # pointer + summary for this repo
      <other-project>.md
    dormant/
    archived/

  patterns/                      # cross-project approaches
    <pattern-name>.md

  domains/                       # subject-matter expertise
    <domain>/
      _overview.md
      patterns.md
      references.md

  playbooks/                     # recurring cross-project activities
    starting-a-new-project.md
    adopting-a-new-skill.md

  log/                           # cross-project history
    journal.md
    retrospectives/

  glossary.md                    # personal vocabulary
```

This is a sketch, not a mandate. The personal meta-castle should grow by demand, just like a project castle. Don't create empty wings the user hasn't asked for.

### The patterns wing is the index of record for skills

This is the most important wing of the personal meta-castle for understanding why it exists.

A "skill" in the LLM-agent sense is portable expertise — a self-contained, generic capability that travels across projects (e.g., "how to author ADRs," "how to read PDFs"). Skills are designed to be loaded on demand and used by anyone, in any project.

The patterns wing is where skills get **contextualized** with the user's accumulated experience. A pattern entry for something that's also a skill becomes mostly an annotated index:

- Pointer to the skill (or to where the skill lives)
- List of projects where the user has applied this skill, linking to specific ADRs or implementations
- Notes on what worked, what was adapted, what failed
- Cross-references to related patterns

The lookup chain for any non-trivial task becomes:

1. **Patterns wing first.** Has the user already done this? If so, what did they use and what was the result?
2. **Skills second.** If the pattern points to a skill, follow the pointer.
3. **Web or external search third.** Only when the patterns wing has nothing.

This ordering matters. Going straight to a skill (or worse, the web) skips the user's own accumulated knowledge of how that capability has actually performed in their work. The pattern entry is what turns generic capability into seasoned, contextualized capability.

For patterns that don't yet exist as skills (because they're idiosyncratic or early-stage), the meta-castle entry contains the actual approach. These are candidates for skill-ification later if they generalize.

### The promotion lifecycle

Knowledge moves between layers:

- A constraint or convention emerges in **one project** → captured as a project-level ADR
- It shows up in a **second project** → start a personal meta-castle pattern entry, link both projects
- It stabilizes across enough projects that it could help others → consider extracting a skill (or contributing to an existing one)
- A skill the user adopts (theirs or imported) → annotated in the patterns wing with the user's specific applications and lessons

Promotion in the other direction (from skill to pattern) doesn't quite happen — the pattern _is_ the contextual layer that wraps a skill. But forking, customizing, or replacing a skill might happen, and that's a pattern-level event worth recording.

### What to seed during this monorepo migration

Now, the practical question: what should you actually create in the personal meta-castle while doing the monorepo work, versus what should you defer?

**Create now:**

1. **A minimal directory skeleton** at the user's chosen location. At minimum: `~/palace/` (or equivalent) with `map.md`, `projects/active/`, and `patterns/`. Don't create empty subdirectories beyond these — wait until they're needed.

2. **The project registry entry for this monorepo.** Create `~/palace/projects/active/<monorepo-name>.md` using the template below. This is the pointer into the work you're doing now. Without this, when the personal meta-castle gets fleshed out later, this monorepo will be invisible to it.

3. **A `map.md` with one line** describing what the meta-castle is and listing what wings exist (initially: just `projects/`). This file grows as the meta-castle does.

**Seed when encountered:**

During the monorepo migration, you will likely identify content that doesn't really belong to this project at all — things the user has clearly carried over from other work, conventions that come from their broader practice rather than from this specific repo. When you find such content:

4. **Create a pattern entry** in `~/palace/patterns/` for it, with a stub structure (problem it addresses, where it's applied — link this monorepo, notes — to be filled in). Don't try to write the pattern fully right now. The goal is to claim a home for it so future cross-project work can find it.

5. **Flag it in your migration notes** for the user's review. The user is the one who knows whether something is genuinely cross-project or just feels like it. Don't unilaterally promote project-specific content to the meta-castle — surface candidates and let them confirm.

**Defer:**

Domains, playbooks, and the cross-project log can wait. They become useful once there are multiple projects in the registry, and seeding them with one project's content risks producing meta-castle content that's secretly project-specific. Better to leave those wings empty for now and let them grow as the meta-castle matures.

### Project registry entry template

For the project registry entry for this monorepo, in `~/palace/projects/active/<name>.md`:

```markdown
# <Project Name>

**Status:** Active
**Castle:** <absolute path to the repo's docs/ directory>
**Repo location:** <where the repo lives on disk>
**Started:** <YYYY-MM if known, otherwise approximate>
**Domains:** <comma-separated list, can be filled in later>
**Summary:** One paragraph: what this project is and why it matters in the user's portfolio.

## Notable patterns used

<To be filled in as patterns are recognized. Initially can be empty or a placeholder.>

## Recent significant work

See <repo>/docs/evolution/changelog.md for project-level history.
Last meta-update: <YYYY-MM-DD>
```

The "Notable patterns used" section will start empty and accrete entries as you (or future sessions) recognize patterns the user has applied here that also show up in their other work. Leave it as a placeholder rather than fabricating entries.

---

## Part 4: How this affects the migration you're already doing

Reading this primer should change a few specific things about the monorepo migration in progress (or yet to begin). The changes are surgical, not structural — you don't need to redo work, but you should adjust forward-looking calls.

### Phase 2 (decomposition) becomes two-step

Originally feature decomposition. Now: **package decomposition first, then feature-within-package decomposition where packages are large enough to need it.**

The packages are the most natural top-level rooms in the repo-level castle because they already exist as units in the code. Inside each package, if the package is large or has multiple distinct features, decompose further into feature rooms within the package's own castle.

Demos get classified during this same phase as either package-internal (live inside their package's castle) or system-level (live at the repo level).

### Phase 5 (extracting decisions) gains a "promote or keep local" call

For every retrospective ADR you draft, ask: does this decision affect only one package, or does it span packages?

- **Affects one package** → ADR lives in that package's `decisions/` wing
- **Spans packages** → ADR lives in the repo-level `docs/decisions/` wing
- **Affects multiple packages but originated in one** → ADR lives at the repo level, with a "promoted from..." note in its context if you can identify the origin

This call should be conservative. When in doubt, place an ADR at the package level. Promotion to the repo level can happen later when its broader applicability is confirmed.

### Phase 5 also gains a "candidate for personal meta-castle" call

For every decision, convention, or pattern you encounter during the migration, ask: is this _really_ about this monorepo, or is it something the user has carried in from their broader practice?

If it's the latter, flag it (don't move it yet) for the user to review. The migration notes should include a section titled "Possible meta-castle candidates" listing things that might belong one layer up.

Examples of what might be a meta-castle candidate:

- "We always use idempotency keys on write endpoints" — could be repo convention or could be a personal pattern the user applies everywhere
- "We prefer event-sourcing for state machines with many transitions" — same
- A specific way of structuring tests, error handling, or logging that the user clearly believes in independent of this project

The user's review will reveal which are which. You should not unilaterally lift content into the personal meta-castle — only seed pattern stubs and flag candidates.

### Phase 7 (CLAUDE.md slimdown) becomes "split into a hierarchy"

Originally: rewrite a single CLAUDE.md as a behavioral guide. Now: **build the CLAUDE.md hierarchy** — repo-root CLAUDE.md plus per-package CLAUDE.md files. The repo-root version handles cross-cutting orientation and the handoff rule; per-package versions handle local operational specifics.

Anything in the original CLAUDE.md that was about a specific package belongs in that package's CLAUDE.md (or its `docs/`). Anything cross-cutting belongs in the repo-root CLAUDE.md. Anything that turned out to be the user's personal preference rather than this project's specific convention is a meta-castle candidate.

### A new Phase 9: seed the personal meta-castle

After the existing eight phases, add:

1. Create the minimal personal meta-castle skeleton at the location the user specifies (or propose `~/palace/` and confirm)
2. Create the project registry entry for this monorepo
3. Create stub pattern entries for any meta-castle candidates flagged during Phase 5, with the "Where applied" section linking back to this monorepo's relevant ADRs
4. Hand the candidate list back to the user for review

This phase is intentionally light. The personal meta-castle is meant to grow with use, not to be retrofitted as elaborately as the project castle. The goal is to _exist_ as a destination by the end of this work, not to be mature.

---

## Part 5: Operational notes

A few things to keep in mind as you carry out the work:

### Place over precision

When uncertain whether something belongs at the repo level or the package level, ask the user. Wrong placement at this stage propagates: future ADRs link to the wrong location, and the structural error becomes harder to fix as more content accumulates around it.

### Promotion is deliberate

Both kinds of promotion — package-level ADR to repo-level, or project-specific knowledge to personal meta-castle — should be explicit acts. They produce a new artifact at the higher level and add a back-pointer at the lower level. Silent duplication or quiet movement of files is the failure mode that corrupts the structure most quickly.

### The personal meta-castle is the user's, not the repo's

The personal meta-castle does not live inside this repo. It lives in a location the user designates (likely their home directory or a dedicated repo of its own). When you create files in the personal meta-castle, you are operating outside this monorepo's tree. Make this distinction clear in any commits or write operations — the user should never be surprised by changes to the meta-castle showing up in this repo's diff.

### Surface candidates, don't unilateral

For anything ambiguous between repo-level and personal-meta — and there will be ambiguous cases — flag the candidate and ask. The user has context you don't about which conventions are this-project-specific and which span their work. Your job is to surface the question, not answer it.

### The handoff rule applies to you, too

When you finish working at the repo level and descend into a specific package, follow the handoff rule. Read the package's CLAUDE.md as if you'd just arrived. Don't assume you can operate inside a package on the basis of repo-level orientation alone — the package may have local conventions that diverge from repo defaults, and those local conventions are what the package CLAUDE.md exists to communicate.

---

## Part 6: How to start

You're already in the middle of the monorepo migration, so the start is small:

1. Read this primer end to end (you just did).
2. Confirm with the user the location of the personal meta-castle (suggest `~/palace/` if no preference exists).
3. Continue the monorepo migration with the adjustments described in Part 4.
4. As you encounter cross-cutting content during the migration, route it to the repo-level wings.
5. As you encounter content that might be personal rather than project-specific, log it as a meta-castle candidate.
6. When the migration's Phase 8 (link audit) completes, execute the new Phase 9 to seed the personal meta-castle.
7. Hand the candidate list and the seeded skeleton back to the user.

The end state of this work is a monorepo with a mature project castle (organized at repo and package levels), a slim personal meta-castle with one project registered and a handful of pattern stubs awaiting fleshing-out, and a clear set of next-step questions for the user about which candidates to promote and which to leave at the repo level.

Maturity of the personal meta-castle will come with use, not with this migration. The goal here is to build the destination, not to fill it.
