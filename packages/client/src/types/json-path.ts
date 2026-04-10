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
 * | Index selector    | `[n]`      | Access a specific array element (extracted `entityRefData` output only)      |
 *
 * Not supported: slice (`[start:end]`), union (`[a,b]`), recursive descent (`..`), filter (`[?()]`).
 *
 * `entityRefPaths` on a command handler registration declares paths where `EntityRef` values may appear in nested or array structures.
 * Declaration paths use `[*]` for array traversal.
 * Multiple `[*]` segments may appear in a single path for nested arrays.
 *
 * ```typescript
 * {
 *   commandType: 'CreateProjectFromTemplate',
 *   entityRefPaths: ['$.forms[*].id', '$.metadata.orgId', '$.sections[*].items[*].parentId'],
 * }
 * ```
 */
export type JSONPathExpression = string
