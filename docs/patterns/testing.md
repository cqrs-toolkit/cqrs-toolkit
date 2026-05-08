# Testing

Unit tests use Vitest and test logic in isolation.
Test files live beside the source files they test (e.g., `routes.ts` → `routes.test.ts`).
This applies to all test types: unit tests, integration tests, and e2e tests.

## Commands

```bash
# Run all unit tests (single run)
npm run test:run

# Run a specific test file
npm run test:run -- packages/<pkg>/src/<file>.test.ts

# Run all e2e tests (from repo root, not from a demo directory)
npm run test:e2e
```

## Bug-fix workflow

When fixing a non-trivial bug, follow this sequence:

1. **Reproduce first.**
   Write a test that exercises the broken behavior through the public API.
   The test should assert the correct contract — what the code _should_ do — so it fails against the current (buggy) implementation.
2. **Verify the test fails.**
   Run it and confirm the failure matches the reported symptom.
   If the test passes, it does not reproduce the bug — revisit your understanding before proceeding.
3. **Implement the fix.**
4. **Verify the test passes** and all existing tests still pass.

A unit test is preferred when the bug is in a single module's contract.
Use an e2e test only when the bug requires multi-component interaction that a unit test cannot capture.
Skip this workflow for trivial fixes (typos, missing imports, config tweaks) where a regression test adds no value.

## When tests fail

If tests fail during verification, **stop**.
Do not guess a fix and apply it.

This codebase is complex and many issues are interconnected — a naive fix can create cascading problems.
Get to the verification step, run the tests, and check why something failed.
If the problem is not completely trivial, stop making edits, diagnose, present what you think is wrong, and wait for direction before further changes.
Trivial fixes (typos, missing imports) can proceed without asking; anything involving logic or architecture stops and reports.

## Where applied

Repo-wide for unit tests.
E2e tests live in the demo system; demo-specific testing conventions (Accept headers on HTTP requests, CSS-state-classes for state observation) live at [`/docs/projects/demo/patterns/`](../projects/demo/_overview.md).
