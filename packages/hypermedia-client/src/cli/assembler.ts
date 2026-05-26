/**
 * Assemble three TypeScript source files from classified declarations.
 *
 * Sorts within each role, computes per-file imports (commands and reps
 * may only reference shared), slices declaration source ranges from the
 * compiler output, and concatenates with a banner comment.
 */

import type { ClassifiedDecl } from './classifier.js'
import { EXTERNAL_NAME_BY_KEY, type ExternalTypeName, type Role } from './schema-bundler.js'

const MODULE_BY_EXTERNAL: Record<ExternalTypeName, string> = {
  EntityId: '@cqrs-toolkit/client',
  Link: '@meticoeus/ddd-es',
  ServiceLink: '@meticoeus/ddd-es',
}

const EXTERNAL_TOKEN_RE = /__External_(\w+)/g

export interface AssembleInput {
  /** Original compiler output; declaration source ranges are sliced from here. */
  source: string
  /** Classified declarations from {@link classifyDeclarations}. */
  declarations: ClassifiedDecl[]
  /** Banner prepended to every generated file. */
  bannerComment?: string
  /**
   * Relative module path from commands/reps to the shared file, used in
   * import statements. Must work from `commands/types.ts` and `reps/types.ts`.
   */
  sharedImportPath?: string
}

export interface AssembleResult {
  shared: string
  commands: string
  reps: string
}

const DEFAULT_BANNER = `/**
 * Generated types — do not edit.
 * Regenerate with: cqrs-toolkit client pull
 */`

const DEFAULT_SHARED_IMPORT_PATH = '../shared/types.js'

/**
 * Build the three TypeScript output files. Returns their full source as
 * plain strings; writing to disk is the caller's responsibility.
 */
export function assembleFiles(input: AssembleInput): AssembleResult {
  const banner = input.bannerComment ?? DEFAULT_BANNER
  const sharedImportPath = input.sharedImportPath ?? DEFAULT_SHARED_IMPORT_PATH

  const byRole = groupByRole(input.declarations)
  const nameToRole = buildNameToRole(input.declarations)

  return {
    shared: buildFile({
      banner,
      decls: byRole.shared,
      source: input.source,
      sharedImports: [],
    }),
    commands: buildFile({
      banner,
      decls: byRole.commands,
      source: input.source,
      sharedImports: computeSharedImports(byRole.commands, nameToRole),
      sharedImportPath,
    }),
    reps: buildFile({
      banner,
      decls: byRole.reps,
      source: input.source,
      sharedImports: computeSharedImports(byRole.reps, nameToRole),
      sharedImportPath,
    }),
  }
}

// ---------------------------------------------------------------------------
// Private helpers
// ---------------------------------------------------------------------------

interface FileInput {
  banner: string
  decls: ClassifiedDecl[]
  source: string
  sharedImports: string[]
  sharedImportPath?: string
}

function buildFile(input: FileInput): string {
  const externalsByModule = collectExternalImports(input.decls)
  const externalLines = renderExternalImports(externalsByModule)
  const sharedLine =
    input.sharedImports.length > 0
      ? `import type { ${[...input.sharedImports].sort().join(', ')} } from '${input.sharedImportPath}'`
      : undefined

  const parts: string[] = [input.banner]
  const importBlock = [...externalLines, ...(sharedLine !== undefined ? [sharedLine] : [])]
  if (importBlock.length > 0) {
    parts.push(importBlock.join('\n'))
  }

  if (input.decls.length === 0) {
    parts.push('export {}')
  } else {
    for (const decl of input.decls) {
      parts.push(rewriteExternals(input.source.slice(decl.range[0], decl.range[1])))
    }
  }

  return parts.join('\n\n') + '\n'
}

function collectExternalImports(decls: ClassifiedDecl[]): Map<string, Set<ExternalTypeName>> {
  const byModule = new Map<string, Set<ExternalTypeName>>()
  for (const decl of decls) {
    for (const ref of decl.references) {
      const externalName = EXTERNAL_NAME_BY_KEY[ref]
      if (externalName === undefined) continue
      const mod = MODULE_BY_EXTERNAL[externalName]
      const set = byModule.get(mod) ?? new Set<ExternalTypeName>()
      set.add(externalName)
      byModule.set(mod, set)
    }
  }
  return byModule
}

function renderExternalImports(byModule: Map<string, Set<ExternalTypeName>>): string[] {
  const lines: string[] = []
  const modules = [...byModule.keys()].sort()
  for (const mod of modules) {
    const names = [...(byModule.get(mod) ?? new Set())].sort().join(', ')
    lines.push(`import type { ${names} } from '${mod}'`)
  }
  return lines
}

function rewriteExternals(slice: string): string {
  return slice.replace(EXTERNAL_TOKEN_RE, (_full, name: string) => name)
}

function groupByRole(decls: ClassifiedDecl[]): Record<Role, ClassifiedDecl[]> {
  const out: Record<Role, ClassifiedDecl[]> = { shared: [], commands: [], reps: [] }
  for (const d of decls) {
    out[d.role].push(d)
  }
  for (const role of ['shared', 'commands', 'reps'] as const) {
    out[role].sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0))
  }
  return out
}

function buildNameToRole(decls: ClassifiedDecl[]): Map<string, Role> {
  const map = new Map<string, Role>()
  for (const d of decls) map.set(d.name, d.role)
  return map
}

function computeSharedImports(decls: ClassifiedDecl[], nameToRole: Map<string, Role>): string[] {
  const imports = new Set<string>()
  for (const d of decls) {
    for (const ref of d.references) {
      if (nameToRole.get(ref) === 'shared') {
        imports.add(ref)
      }
    }
  }
  return [...imports]
}
