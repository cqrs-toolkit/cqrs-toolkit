import { JSONSchema7 } from 'json-schema'
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { SchemaUrnResolver } from '../cli/config-types.js'
import type { HydraApiDocumentation } from '../HydraApiDocumentation.js'
import { normalizePathSegment } from './utils.js'

export interface MetaFiles {
  /** ApidDocumentation loaded from disk */
  apidoc: HydraApiDocumentation.Document | undefined
  schemas: Map<string, JSONSchema7>
  openapi: JSONSchema7 | undefined
}

export function loadMetaFiles(
  sourceDir: string,
  schemaUrnResolver: SchemaUrnResolver | undefined,
): MetaFiles {
  return {
    apidoc: loadApidoc(sourceDir),
    schemas: loadSchemaFiles(sourceDir, schemaUrnResolver),
    openapi: loadOpenapi(sourceDir),
  }
}

export function loadApidoc(sourceDir: string): HydraApiDocumentation.Document | undefined {
  const docPath = join(sourceDir, 'apidoc.jsonld')
  if (!existsSync(docPath)) return

  const rawOpenapi = readFileSync(docPath, 'utf-8')
  return JSON.parse(rawOpenapi)
}

export function loadSchemaFiles(
  sourceDir: string,
  schemaUrnResolver: SchemaUrnResolver | undefined,
): Map<string, JSONSchema7> {
  const schemas = new Map<string, JSONSchema7>()
  if (!schemaUrnResolver) return schemas

  const schemasDir = join(sourceDir, 'schemas')
  const files = readdirSync(schemasDir, { recursive: true, encoding: 'utf-8' })

  const segment = normalizePathSegment(schemaUrnResolver.pathSegment)
  for (const file of files) {
    if (!file.endsWith('.json')) continue
    const relativePath = `${segment}/${file}`
    const raw = readFileSync(join(schemasDir, file), 'utf-8')
    const parsed = JSON.parse(raw) as JSONSchema7
    schemas.set(relativePath, parsed)
  }

  return schemas
}

export function loadOpenapi(sourceDir: string): JSONSchema7 | undefined {
  const docPath = join(sourceDir, 'openapi.json')
  if (!existsSync(docPath)) return

  const rawOpenapi = readFileSync(docPath, 'utf-8')
  return JSON.parse(rawOpenapi)
}
