# playbooks/

How recurring activities are performed (procedure).
Sequenced steps for *cross-package recurring work* — publishing a release, deprecating a package, coordinating a refactor that touches several packages.

A playbook is created on the *second* occurrence of an activity, not the first.
Two data points are what make a procedure abstract-able.

## Playbooks

- [`adding-a-new-package.md`](adding-a-new-package.md) — end-to-end procedure for creating a new TypeScript workspace package under `packages/<name>/`.
- [`promoting-castle-content.md`](promoting-castle-content.md) — move a pattern, mindset entry, playbook, or ADR from a project scope to a higher scope when it proves applicable beyond its original boundary.

## Distinguished from neighbours

- **vs. `patterns/`**: a pattern is a convention applied in many small places ("use Result<T, E>"); a playbook is a procedure done end-to-end on its own occasion ("publish a release").
- **vs. `decisions/`**: an ADR records *why* a procedure looks the way it does; the playbook records *how to execute* it.

## Scope

Repo-level playbooks cover activities that span packages.
A project grows its own `playbooks/` wing when it has project-scoped procedures (e.g. demo-system "how to add a new e2e test scenario") that don't apply outside that project.

## Playbook entry shape

Each playbook is one file: `<activity-name>.md`.
Suggested structure:

- Purpose (what the procedure achieves).
- Trigger (when to run it).
- Prerequisites.
- Steps, in order, with command examples where applicable.
- Verification (how to confirm success).
- Rollback (if applicable).

## Promotion

A project-scoped playbook that widens to cross-package use is promoted by `git mv` to this wing.
For the procedure, see [`promoting-castle-content.md`](promoting-castle-content.md).
