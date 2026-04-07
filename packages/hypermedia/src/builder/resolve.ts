import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import * as process from 'node:process'
import type { SchemaUrnResolver } from '../cli/config-types.js'
import { loadMetaFiles, loadSchemaFiles } from './load.js'
import {
  ResolvedMetaBundle,
  ResolvedSchemaBundle,
  transformMetaFiles,
  transformSchemaFiles,
} from './transform.js'
import { buildSchemaUrnToUrlMapper } from './utils.js'

/** Convert a `urn:vocab:${name}#` to a dereferenceable vocab URL. */
export function urnToVocabUrl(docsEntrypoint: string, urn: string): string {
  // urn:vocab:chat# → ${docsEntrypoint}/vocab/chat#
  const suffix = urn.slice('urn:vocab:'.length)
  return `${docsEntrypoint}/vocab/${suffix}`
}

/**
 * Load committed schema artifacts from disk and resolve URNs to dereferenceable URLs.
 * Reads `apidoc.jsonld` and all `.json` files under `schemas/` from `sourceDir`.
 */
export function loadMetaBundle(opts: {
  sourceDir: string
  docsEntrypoint: string
  apiEntrypoint: string
  schemaUrnResolver: SchemaUrnResolver | undefined
}): ResolvedMetaBundle {
  const { sourceDir, docsEntrypoint, apiEntrypoint, schemaUrnResolver } = opts
  const files = loadMetaFiles(sourceDir, schemaUrnResolver)
  if (!files.apidoc) {
    // TODO: improve message
    console.warn('Missing apidoc')
    process.exit(1)
  }

  const requiresSchemaConfig = files.schemas.size > 0 || files.openapi
  if (requiresSchemaConfig && !opts.schemaUrnResolver) {
    // TODO: improve message
    console.warn('Missing schema config')
    process.exit(1)
  }

  return transformMetaFiles({
    docsEntrypoint,
    apiEntrypoint,
    files,
    schemaUrnResolver,
  })
}

export function loadSchemaBundle(opts: {
  sourceDir: string
  docsEntrypoint: string
  schemaUrnResolver: SchemaUrnResolver
}): ResolvedSchemaBundle {
  const { sourceDir, docsEntrypoint, schemaUrnResolver } = opts
  const schemaUrnToUrlMapper = buildSchemaUrnToUrlMapper(docsEntrypoint, schemaUrnResolver)

  const schemaFiles = loadSchemaFiles(sourceDir, schemaUrnResolver)
  return transformSchemaFiles(schemaFiles, schemaUrnResolver, schemaUrnToUrlMapper)
}

/** Write a resolved schema bundle to a target directory. */
export function writeSchemaBundle(bundle: ResolvedMetaBundle, outputDir: string): void {
  mkdirSync(outputDir, { recursive: true })
  if (bundle.apidoc) {
    writeFileSync(join(outputDir, 'apidoc.jsonld'), bundle.apidoc.content)
    writeFileSync(join(outputDir, 'apidoc.jsonld.etag'), bundle.apidoc.etag)
  }

  for (const [relativePath, content] of bundle.schemas) {
    const filePath = join(outputDir, relativePath)
    mkdirSync(dirname(filePath), { recursive: true })
    writeFileSync(filePath, content)
  }
}

// ---- Private helpers ----
