# Documentation style

Conventions for prose documentation — markdown, JSDoc, comments.

## Markdown

- Place each sentence on its own line in markdown files.
  Improves diffs and readability.
- List items may use single lines for brevity, but must wrap with proper indentation if line length exceeds 120 characters.

## JSDoc on exported APIs must use `{@link}` for type references

When writing doc comments on exported functions, types, classes, or members, use `{@link TypeName}` or `{@link Type.member}` for any reference to another type, function, or member.
Plain-text mentions like "True for CommandEvents" or "Distinct from isTerminalStatus" render as unlinked prose in generated docs, leaving readers unsure whether a word is a type, a concept, or just English.

The project runs `npm run docs` (TypeDoc) to generate API docs.
Generators only produce clickable navigation when references use explicit link syntax.
Plain-text identifiers carry no information for the doc output.

**How to apply:**

- Reference a type / interface / class: `{@link CommandEvent}`.
- Reference a member / method / field: `{@link CommandEvent.eventType}`, `{@link CommandQueue.waitForCompletion}`.
- Plural is fine: `{@link CommandEvent}s`.
- String-literal values stay in backticks: `` `status-changed` ``, `` `completed` `` — those are values, not identifiers.
- If a reference genuinely cannot be linked (cross-package private, external library), use backticks and keep the prose — but default to linking whenever the target exists in a way the doc generator can resolve.

## Comments in code

Default to writing no comments.
Only add a comment when the *why* is non-obvious: a hidden constraint, a subtle invariant, a workaround for a specific bug, behaviour that would surprise a reader.
If removing the comment wouldn't confuse a future reader, don't write it.

Don't explain *what* the code does, since well-named identifiers already do that.
Don't reference the current task, fix, or callers ("used by X", "added for the Y flow", "handles the case from issue #123") — those belong in the PR description and rot as the codebase evolves.

When refactoring, **carry every existing `as X` cast and its justifying comment verbatim** to the new location.
The "Trust boundary:" comment style and similar pre-cast explanations are deliberate institutional knowledge.
If a cast is no longer needed in the new context, propose removing it explicitly — don't delete it silently.
Same rule for `// TODO`, `// HACK`, `// NOTE` comments.

## Where applied

Repo-wide for prose docs and JSDoc.
The two-file pattern conventions and ADR conventions are documented in [`/docs/map.md`](../map.md) and the relevant wing READMEs.
