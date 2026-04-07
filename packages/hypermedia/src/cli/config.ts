/**
 * Config validation and resolution for `cqrs-toolkit server` commands.
 */

import type { JSONSchema7 } from 'json-schema'
import { resolve } from 'node:path'
import { HydraDoc } from '../HydraDoc.js'
import type { HydraConfig } from './config-types.js'

export interface CommandOptions {
  /** Environment name to use for URN resolution (default: 'dev') */
  env?: string
}

export interface ResolvedConfig extends HydraConfig {
  envName: string
  /** Resolved absolute paths to the output directories */
  resolved: {
    docs: {
      outputDir: string
    }
    build: {
      outputDir: string
    }
  }
}

/**
 * Validate and resolve a raw HydraConfig into a ResolvedConfig.
 * Throws on invalid config.
 */
export function resolveConfig(
  rawConfig: HydraConfig,
  projectRoot: string,
  opts: CommandOptions = {},
): ResolvedConfig {
  validateConfig(rawConfig)
  return {
    ...rawConfig,
    envName: opts.env ?? 'dev',
    resolved: {
      docs: {
        outputDir: resolve(projectRoot, rawConfig.docs.outputDir),
      },
      build: {
        outputDir: resolve(projectRoot, rawConfig.build.outputDir),
      },
    },
  }
}

function validateConfig(config: unknown): asserts config is HydraConfig {
  if (typeof config !== 'object' || config === null) {
    throw new Error(`Server config must be an object`)
  }
  const c = config as Record<string, unknown>
  if (!Array.isArray(c['classes']) || c['classes'].length === 0) {
    throw new Error(`Config 'server.classes' must be a non-empty array`)
  }
  if (!Array.isArray(c['prefixes'])) {
    throw new Error(`Config 'server.prefixes' must be an array of prefix strings`)
  }
  const docs = c['docs'] as Record<string, unknown> | undefined
  if (typeof docs !== 'object' || docs === null || typeof docs['outputDir'] !== 'string') {
    throw new Error(`Config 'server.docs.outputDir' must be a string`)
  }
  const build = c['build'] as Record<string, unknown> | undefined
  if (typeof build !== 'object' || build === null || typeof build['outputDir'] !== 'string') {
    throw new Error(`Config 'server.build.outputDir' must be a string`)
  }

  const classes = c['classes'] as HydraDoc.ClassDef[]
  const { hasSchemas, errors } = scanSchemas(classes)

  if (errors.length > 0) {
    throw new Error(`Schema validation errors:\n${errors.map((e) => `  ${e}`).join('\n')}`)
  }

  if (hasSchemas) {
    const schema = c['schema'] as HydraConfig['schema']
    if (!schema) {
      throw new Error(
        `Config 'server.schema' is required when classes define schemas. ` +
          `Provide schema: { isUrn, mapUrnToUrl } to control how schema URNs are resolved.`,
      )
    }
    if (typeof schema.isUrn !== 'function') {
      throw new Error(`Config 'server.schema.isUrn' must be a function`)
    }
    if (typeof schema.mapUrnToUrl !== 'function') {
      throw new Error(`Config 'server.schema.mapUrnToUrl' must be a function`)
    }
  }
}

/** Walk all classes to find schemas and validate they have $id. */
function scanSchemas(classes: HydraDoc.ClassDef[]): {
  hasSchemas: boolean
  errors: string[]
} {
  const errors: string[] = []
  let hasSchemas = false

  function checkSchema(schema: JSONSchema7, label: string): void {
    hasSchemas = true
    if (!schema.$id) {
      errors.push(`${label}: schema is missing $id`)
    }
  }

  function checkResponses(
    responses: readonly HydraDoc.ResponseEntry[] | undefined,
    label: string,
  ): void {
    if (!responses) return
    for (const entry of responses) {
      if (typeof entry === 'number') continue
      if (!entry.schema || entry.schema === HydraDoc.NO_BODY) continue
      checkSchema(entry.schema, `${label} response [${entry.code}]`)
    }
  }

  for (const cls of classes) {
    if (cls.commands) {
      for (const s of cls.commands.surfaces) {
        checkResponses(s.responses, `${cls.class} surface ${s.dispatch}`)
      }
      for (const c of cls.commands.commands) {
        if (c.schema) {
          checkSchema(c.schema, `${cls.class} command ${c.id}`)
        }
        checkResponses(c.responses, `${cls.class} command ${c.id}`)
      }
    }
    for (const rep of cls.representations) {
      checkResponses(rep.resource.responses, `${cls.class} rep ${rep.id} resource`)
      checkResponses(rep.collection.responses, `${cls.class} rep ${rep.id} collection`)
    }
  }

  return { hasSchemas, errors }
}
