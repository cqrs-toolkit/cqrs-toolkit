import { SchemaUrnResolver } from '../cli/config-types.js'
import { stableOrder } from './HydraBuilder.js'
import { MetaFiles } from './load.js'
import { ResolvedDocument } from './types.js'
import {
  buildSchemaUrnToUrlMapper,
  computeEtag,
  resolveApidocUrns,
  resolveOpenApiUrns,
  resolveSchemaUrns,
  SchemaUrnToUrlMapper,
} from './utils.js'

export interface ResolvedSchemaBundle {
  /** Resolved schema files keyed by relative serve path (e.g. "schemas/urn/schema/...json") */
  schemas: ReadonlyMap<string, string>
  /** Map of schema URN → resolved URL for all known schemas */
  schemaUrns: ReadonlyMap<string, string>
}

export interface ResolvedMetaBundle extends ResolvedSchemaBundle {
  /** Resolved Hydra ApiDocumentation */
  apidoc: ResolvedDocument | undefined
  /** Resolved OpenAPI schema */
  openapi: ResolvedDocument | undefined
}

export function transformMetaFiles(opts: {
  docsEntrypoint: string
  apiEntrypoint: string
  files: MetaFiles
  schemaUrnResolver: SchemaUrnResolver | undefined
}): ResolvedMetaBundle {
  const { docsEntrypoint, apiEntrypoint, files, schemaUrnResolver } = opts
  const schemaUrnToUrlMapper = buildSchemaUrnToUrlMapper(docsEntrypoint, schemaUrnResolver)

  const schemas = transformSchemaFiles(files.schemas, schemaUrnResolver, schemaUrnToUrlMapper)

  return {
    apidoc: transformApidoc(files.apidoc, { ...opts, schemaUrnToUrlMapper }),
    ...schemas,
    openapi: transformOpenapi(files.openapi, schemas),
  }
}

export function transformApidoc(
  apidoc: MetaFiles['apidoc'],
  opts: {
    docsEntrypoint: string
    apiEntrypoint: string
    schemaUrnResolver: SchemaUrnResolver | undefined
    schemaUrnToUrlMapper: SchemaUrnToUrlMapper
  },
): ResolvedDocument | undefined {
  if (!apidoc) return

  const { docsEntrypoint, apiEntrypoint, schemaUrnResolver, schemaUrnToUrlMapper } = opts
  const resolvedJsonld = resolveApidocUrns(apidoc, {
    docsEntrypoint,
    apiEntrypoint,
    schemaUrnResolver,
    schemaUrnToUrlMapper,
  })
  const apidocContent = JSON.stringify(stableOrder(resolvedJsonld))
  return {
    content: apidocContent,
    etag: computeEtag(apidocContent),
  }
}

export function transformSchemaFiles(
  schemaFiles: MetaFiles['schemas'],
  schemaUrnResolver: SchemaUrnResolver | undefined,
  schemaUrnToUrlMapper: SchemaUrnToUrlMapper,
): ResolvedSchemaBundle {
  const schemas = new Map<string, string>()
  const schemaUrns = new Map<string, string>()
  const output: ResolvedSchemaBundle = { schemas, schemaUrns }
  if (!schemaUrnResolver) return output

  for (const [relativePath, parsed] of schemaFiles) {
    const resolved = resolveSchemaUrns(parsed, {
      schemaUrnResolver,
      urnMap: schemaUrns,
      schemaUrnToUrlMapper,
    })
    schemas.set(relativePath, JSON.stringify(stableOrder(resolved)))
  }

  return output
}

export function transformOpenapi(
  openapi: MetaFiles['openapi'],
  schemas: ResolvedSchemaBundle,
): ResolvedDocument | undefined {
  const resolvedOpenapi = resolveOpenApiUrns(openapi, schemas.schemaUrns)
  const openapiContent = JSON.stringify(stableOrder(resolvedOpenapi))
  return { content: openapiContent, etag: computeEtag(openapiContent) }
}
