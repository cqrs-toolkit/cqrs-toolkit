import { isEqual } from 'moderndash'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import {
  buildHydraApiDocumentation,
  type BuildOptions,
  type BuildResult,
  type SchemaEntry,
} from './HydraBuilder.js'
import { buildOpenApiDocument, type OpenApiBuildOptions } from './OpenApiBuilder.js'

export interface GenerateConfig extends BuildOptions {
  /** Directory to write output files (apidoc.jsonld, schemas/, etc.) */
  outputDir: string
}

export interface GenerateResult {
  /** Non-fatal warnings from the build */
  warnings: string[]
  /** Schema immutability violations (non-latest schemas that changed) */
  immutabilityViolations: string[]
  /** Hydra build result — pass to generateOpenApiDocumentation */
  buildResult: BuildResult
}

/**
 * Build Hydra API documentation and write all output files.
 * Returns warnings and immutability violations for the caller to handle.
 */
export function generateHydraDocumentation(config: GenerateConfig): GenerateResult {
  const { outputDir, ...buildOpts } = config
  const buildResult = buildHydraApiDocumentation(buildOpts)
  const { content, warnings, schemas } = buildResult

  mkdirSync(outputDir, { recursive: true })
  writeFileSync(join(outputDir, 'apidoc.jsonld'), content)

  // Check immutability of non-latest schemas
  const immutabilityViolations: string[] = []
  for (const [relativePath, entry] of schemas) {
    if (entry.isLatest) continue
    const filePath = join(outputDir, relativePath)
    if (!existsSync(filePath)) continue
    const existing = JSON.parse(readFileSync(filePath, 'utf-8'))
    const current = JSON.parse(entry.content)
    if (!isEqual(existing, current)) {
      immutabilityViolations.push(`Non-latest schema changed: ${relativePath}`)
    }
  }

  // Write schemas (latest overwrites, non-latest only if new or unchanged)
  writeSchemaEntries(outputDir, schemas)

  return { warnings, immutabilityViolations, buildResult }
}

// ---------------------------------------------------------------------------
// OpenAPI generation
// ---------------------------------------------------------------------------

export interface OpenApiBuildResult {
  /** Raw OpenAPI content with URN references (stable for commits) */
  content: string
  /** Non-fatal warnings */
  warnings: string[]
}

/**
 * Build OpenAPI documentation. Returns the raw content with URN references.
 * Does not write to disk — the caller is responsible for validation and writing.
 */
export function buildOpenApi(config: OpenApiBuildOptions): OpenApiBuildResult {
  const { content, warnings } = buildOpenApiDocument(config)
  return { content, warnings }
}

// ---------------------------------------------------------------------------
// Schema file writing
// ---------------------------------------------------------------------------

function writeSchemaEntries(outputDir: string, entries: Map<string, SchemaEntry>): void {
  for (const [relativePath, entry] of entries) {
    const filePath = join(outputDir, relativePath)
    if (!entry.isLatest && existsSync(filePath)) continue // already validated as unchanged

    mkdirSync(dirname(filePath), { recursive: true })
    writeFileSync(filePath, entry.content)
  }
}
