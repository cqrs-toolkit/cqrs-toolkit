/**
 * Docs command — generates Hydra + optional OpenAPI documentation artifacts.
 */

import { validate } from '@hyperjump/json-schema/openapi-3-1'
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { buildOpenApiDocument } from '../builder/OpenApiBuilder.js'
import { generateHydraDocumentation } from '../builder/generate.js'
import type { BuildResult } from '../builder/index.js'
import { loadSchemaBundle } from '../builder/resolve.js'
import { resolveOpenApiUrns } from '../builder/utils.js'
import type { ResolvedConfig } from './config.js'

export async function docs(config: ResolvedConfig): Promise<void> {
  // ---- Step 1: Hydra generation (writes apidoc.jsonld + schemas to disk) ----
  const { warnings, immutabilityViolations, buildResult } = generateHydraDocumentation({
    outputDir: config.resolved.docs.outputDir,
    classes: config.classes,
    prefixes: config.prefixes,
    extraContext: config.extraContext,
    strictPrefixes: config.strictPrefixes,
  })

  if (warnings.length) {
    console.warn('Hydra warnings:')
    for (const w of warnings) console.warn(`  ${w}`)
  }

  if (immutabilityViolations.length) {
    console.error('Schema immutability violations:')
    for (const err of immutabilityViolations) console.error(`  ${err}`)
    process.exit(1)
  }

  console.log(`Generated Hydra docs to ${config.resolved.docs.outputDir}`)

  await generateOpenApiDocs(buildResult, config)
}

async function generateOpenApiDocs(buildResult: BuildResult, config: ResolvedConfig) {
  if (!config.openapi || !config.schema) return

  const envConfig = config.environments?.[config.envName]
  if (!envConfig) {
    // TODO: fix this message
    console.warn(
      `OpenAPI generation skipped: no '${config.envName}' environment in config. ` +
        `Add environments: { ${config.envName}: { apiEntrypoint: '...', documentEntrypoint: '...' } } to enable OpenAPI generation and validation.`,
    )
    return
  }

  const { content, warnings: openapiWarnings } = buildOpenApiDocument({
    classes: config.classes,
    hydraBuild: buildResult,
    info: config.openapi.info,
    hydraPropertyDictionary: config.openapi.hydraPropertyDictionary,
    globalResponses: config.openapi.globalResponses,
    responses: config.openapi.responses,
  })

  if (openapiWarnings.length) {
    console.warn('OpenAPI warnings:')
    for (const w of openapiWarnings) console.warn(`  ${w}`)
  }

  const { schemaUrns } = loadSchemaBundle({
    sourceDir: config.resolved.docs.outputDir,
    docsEntrypoint: envConfig.documentEntrypoint,
    schemaUrnResolver: config.schema,
  })

  const resolved = resolveOpenApiUrns(JSON.parse(content), schemaUrns)
  const validateOpenApi = await validate('https://spec.openapis.org/oas/3.1/schema-base')
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- library expects Json type
  const result = validateOpenApi(resolved as any, 'DETAILED')

  if (!result.valid) {
    const errors: string[] = []
    collectErrors(result, errors)
    console.error('OpenAPI validation failed:')
    for (const err of errors) console.error(`  ${err}`)
    return
  }

  mkdirSync(config.resolved.docs.outputDir, { recursive: true })
  writeFileSync(join(config.resolved.docs.outputDir, 'openapi.json'), content)

  console.log(`Generated OpenAPI docs to ${config.resolved.docs.outputDir}/openapi.json`)
}

/** Recursively collect leaf validation errors from the OutputUnit tree. */
function collectErrors(unit: any, out: string[]): void {
  if (unit.errors?.length) {
    for (const child of unit.errors) {
      collectErrors(child, out)
    }
  } else if (!unit.valid) {
    const location = unit.instanceLocation ?? '(root)'
    const keyword = unit.keyword ?? '(unknown)'
    out.push(`${location}: ${keyword}`)
  }
}
