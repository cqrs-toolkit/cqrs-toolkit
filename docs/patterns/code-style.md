# Code style

Conventions for how code is written — file organization, naming, formatting.
Formatting itself is enforced by Prettier (no semi, single quotes, trailing commas, 100 print width); this document covers what Prettier doesn't.

## File organization

Organize code in this order:

1. **Imports** — external and internal dependencies.
2. **Private constants** — only constants go here; they are not hoisted and are important to keep visible at the top.
3. **Public interface** — exported types, interfaces, classes, and functions.
4. **Private implementation** — internal helper functions, unexported types, implementation details.

**Test files** (`.test.ts`) treat the test blocks as the public interface.
Organize test files in this order:

1. **Imports**
2. **Constants** — dummy IDs, fixed values.
3. **Tests** — `describe`/`it` blocks.
4. **Helpers** — utility functions used across multiple tests.

## Import renames

Do not use `import { x as y }` to rename exports.
If an export name would collide with another import, the export itself should have a scoped, unambiguous name.

The only acceptable use of `as` in imports is for external libraries where you don't control the export name (e.g., `import { v4 as uuid } from 'uuid'`).

## Private field naming

Do not prefix private fields with `_` unless the class exposes a public getter for the same name.
The `_` prefix signals "private mutable, public readonly" — a field like `private _name` paired with `get name()`.
A purely private field with no getter is just `private name`.

For interfaces that leak private context for pragmatism, use the `__` (double underscore) prefix with JSDoc comments explaining the field's purpose.

## Function style

Prefer `function` declarations over arrow functions.
Arrow functions are acceptable in these cases:

- Typed callbacks: `const handler: RequestHandler = () => { ... }`.
- Inline callbacks as parameters or object properties: `arr.map((x) => x.id)`.
- One-liners: `const double = (n: number) => n * 2`.
- When you need the language-level differences: lexical `this`, no `arguments` object, etc.

## Readonly arrays

Use `readonly T[]` instead of `ReadonlyArray<T>` everywhere.
When migrating or editing surrounding code, convert `ReadonlyArray<T>` to `readonly T[]`.

## Package imports use `.js` extensions

Package.json `imports` fields in packages that build to `dist/` must use `.js` extensions, not `.ts`.

TypeScript resolves `.js` → `.ts` during compilation.
At runtime Node resolves `.js` to the actual compiled `.js` in `dist/`.
Using `.ts` causes Node to look for a literal `.ts` file in `dist/` which doesn't exist.

When adding `#import` entries to package.json in any package with a `dist/` build, always use `./src/file.js` (not `.ts`).

## Where applied

Repo-wide.
