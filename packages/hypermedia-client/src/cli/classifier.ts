/**
 * Parse the compiler's TypeScript output and classify each top-level
 * declaration by role.
 *
 * Reports unexpected identifiers (declarations the compiler emitted that
 * aren't in our expected name set), validates cross-role references
 * (commands and reps may only depend on shared), and captures byte ranges
 * so the assembler can range-slice the original source.
 */

import {
  AST_NODE_TYPES,
  parse,
  simpleTraverse,
  type TSESTree,
} from '@typescript-eslint/typescript-estree'
import type { Role } from './schema-bundler.js'

export interface ClassifiedDecl {
  name: string
  role: Role
  /** `[start, end]` byte offsets within the compiler's TS source. */
  range: [number, number]
  /** Names of OTHER declared types this decl's body references. */
  references: string[]
}

export interface ClassifyInput {
  /** TS source produced by the compiler adapter. */
  source: string
  /** Generated TS type name → source schema URN. */
  nameToUrn: Map<string, string>
  /** URN → role from the bundler. */
  urnToRole: Map<string, Role>
  /** Names to skip during classification (e.g. the bundle root sentinel). */
  ignoreNames?: ReadonlySet<string>
}

export interface ClassifyResult {
  /** All recognised declarations, in source order. */
  declarations: ClassifiedDecl[]
  /** Declarations emitted by the compiler that aren't in the expected name set. */
  unexpected: string[]
  /** Cross-role-reference violations (`commands` ↔ `reps`). Hard errors. */
  errors: string[]
  warnings: string[]
}

/**
 * Parse the compiler output, identify top-level type declarations, classify
 * each by role using the supplied URN maps, and validate references.
 *
 * Declarations whose names appear in `ignoreNames` are filtered out before
 * classification (used to drop the synthetic bundle-root type emitted by the
 * compiler for the bundle's wrapping object).
 */
export function classifyDeclarations(input: ClassifyInput): ClassifyResult {
  const ignoreNames = input.ignoreNames ?? new Set<string>()
  const ast = parse(input.source, { range: true, loc: false, jsx: false })

  const topLevel = enumerateTopLevel(ast)
  const declaredNames = new Set(topLevel.map((d) => d.name))
  const expectedNames = new Set(input.nameToUrn.keys())

  const unexpected: string[] = []
  for (const name of declaredNames) {
    if (!expectedNames.has(name) && !ignoreNames.has(name)) {
      unexpected.push(name)
    }
  }

  const declarations: ClassifiedDecl[] = []
  const errors: string[] = []
  const warnings: string[] = []

  for (const { name, range, body } of topLevel) {
    if (ignoreNames.has(name)) continue
    const urn = input.nameToUrn.get(name)
    if (urn === undefined) continue
    const role = input.urnToRole.get(urn)
    if (role === undefined) {
      warnings.push(`Declaration '${name}' has URN '${urn}' but no role assignment`)
      continue
    }
    const references = collectTypeRefs(body, declaredNames).filter((ref) => ref !== name)
    declarations.push({ name, role, range, references })

    for (const refName of references) {
      const refUrn = input.nameToUrn.get(refName)
      if (refUrn === undefined) continue
      const refRole = input.urnToRole.get(refUrn)
      if (refRole === undefined) continue
      if (
        (role === 'commands' && refRole === 'reps') ||
        (role === 'reps' && refRole === 'commands')
      ) {
        errors.push(
          `Cross-role reference: '${name}' (${role}) references '${refName}' (${refRole}). ` +
            `commands/ and reps/ may only reference shared/.`,
        )
      }
    }
  }

  return { declarations, unexpected, errors, warnings }
}

// ---------------------------------------------------------------------------
// Private helpers
// ---------------------------------------------------------------------------

interface TopLevelDecl {
  name: string
  range: [number, number]
  body: TSESTree.Node
}

function enumerateTopLevel(ast: TSESTree.Program): TopLevelDecl[] {
  const out: TopLevelDecl[] = []
  for (const stmt of ast.body) {
    const decl = extractDeclaration(stmt)
    if (decl === undefined) continue
    out.push({ ...decl, range: [stmt.range[0], stmt.range[1]] })
  }
  return out
}

function extractDeclaration(
  stmt: TSESTree.ProgramStatement,
): { name: string; body: TSESTree.Node } | undefined {
  if (stmt.type !== AST_NODE_TYPES.ExportNamedDeclaration) return undefined
  const decl = stmt.declaration
  if (decl === null) return undefined
  if (decl.type === AST_NODE_TYPES.TSInterfaceDeclaration) {
    return { name: decl.id.name, body: decl.body }
  }
  if (decl.type === AST_NODE_TYPES.TSTypeAliasDeclaration) {
    return { name: decl.id.name, body: decl.typeAnnotation }
  }
  if (decl.type === AST_NODE_TYPES.TSEnumDeclaration) {
    return { name: decl.id.name, body: decl }
  }
  return undefined
}

function collectTypeRefs(body: TSESTree.Node, declared: ReadonlySet<string>): string[] {
  const found = new Set<string>()
  simpleTraverse(body, {
    enter(node) {
      if (node.type !== AST_NODE_TYPES.TSTypeReference) return
      const tn = node.typeName
      if (tn.type === AST_NODE_TYPES.Identifier && declared.has(tn.name)) {
        found.add(tn.name)
      }
    },
  })
  return [...found]
}
