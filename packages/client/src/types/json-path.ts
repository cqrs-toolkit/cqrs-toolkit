/**
 * Path expressions implement a subset of JSONPath (RFC 9535).
 * Only structural access operators are supported — no query, filter, or selection operators.
 *
 * Supported RFC 9535 operators:
 *
 * | Operator          | Syntax     | Usage                                                                        |
 * | ----------------- | ---------- | ---------------------------------------------------------------------------- |
 * | Root identifier   | `$`        | Required prefix for all paths                                                |
 * | Dot member        | `.name`    | Object property access                                                       |
 * | Bracket member    | `['name']` | Object property access for field names containing dots or special characters |
 * | Wildcard selector | `[*]`      | Iterate all elements of an array (declaration paths only)                    |
 * | Index selector    | `[n]`      | Access a specific array element (resolved `commandIdPaths` output only)      |
 *
 * Not supported: slice (`[start:end]`), union (`[a,b]`), recursive descent (`..`), filter (`[?()]`).
 *
 * `commandIdReferences` on a command handler registration declares paths where ID values
 * (plain strings or Link objects containing EntityRefs) may appear in the command record.
 * Paths are rooted at the command object: `$.data.*` for command data, `$.path.*` for URL
 * template variables. Declaration paths use `[*]` for array traversal.
 * Multiple `[*]` segments may appear in a single path for nested arrays.
 *
 * ```typescript
 * {
 *   commandType: 'CreateProjectFromTemplate',
 *   commandIdReferences: [
 *     { aggregate: formAggregate, path: '$.data.forms[*].id' },
 *     { aggregate: orgAggregate, path: '$.data.metadata.orgId' },
 *     { aggregate: sectionAggregate, path: '$.data.sections[*].items[*].parentId' },
 *   ],
 * }
 * ```
 */
export type JSONPathExpression = string
