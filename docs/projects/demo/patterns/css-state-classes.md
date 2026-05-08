# CSS state classes for reliable e2e testing

Demo components must expose their lifecycle state through CSS classes.
E2e tests then wait for deterministic CSS class transitions instead of guessing about DOM state with timeouts, attribute polling (e.g., `disabled`), or visibility race conditions.

The principle: e2e infrastructure should *observe* explicit state, not *infer* it from intermediate render artifacts.
DOM-attribute checks (`disabled`, visibility, presence-of-element) reflect interim render state and are race-prone.
CSS class names reflect application-controlled state machines and are deterministic.

## Pattern

When adding an interactive component to a demo, include CSS classes that reflect the component's lifecycle state.
Common examples:

- Forms that submit asynchronously: `.add-idle` / `.add-saving`.
- Editors with save / delete actions: `.editor-idle` / `.editor-saving` / `.editor-deleting`.
- Lists with mutating items: per-row state classes like `.note-item-saving`, `.note-item-deleting`.

E2e helpers in `e2e-helpers.ts` files use these classes as the wait target rather than waiting on text content or DOM-attribute changes.

## Where applied

This is a demo-system-wide convention.
All three demo sub-projects use it:

- [`/docs/projects/demo/projects/todo/`](../projects/todo/_overview.md)
- [`/docs/projects/demo/projects/hypermedia/`](../projects/hypermedia/_overview.md)
- [`/docs/projects/demo/projects/electron/`](../projects/electron/_overview.md)

## Why this is demo-scoped, not repo-scoped

The libraries themselves (`@cqrs-toolkit/client`, `@cqrs-toolkit/hypermedia`, etc.) don't render UI; they have no CSS classes to surface.
The pattern applies wherever there's a UI rendered for e2e testing, which in this monorepo means the demos.
If the toolkit ever ships a UI component library, the convention can be re-evaluated for promotion to a repo-level pattern; until then, this lives at the demo system.
