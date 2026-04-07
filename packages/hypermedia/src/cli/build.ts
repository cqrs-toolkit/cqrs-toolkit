/**
 * Build command — reads committed stable artifacts, resolves URNs to real URLs
 * for the target environment, and writes deployment-ready output.
 */

import { loadMetaBundle, writeSchemaBundle } from '../builder/resolve.js'
import type { ResolvedConfig } from './config.js'

export async function build(config: ResolvedConfig): Promise<void> {
  const envConfig = config.environments?.[config.envName]
  if (!envConfig) {
    console.error(
      `Build failed: no '${config.envName}' environment in config. ` +
        `Add environments: { ${config.envName}: { apiEntrypoint: '...', documentEntrypoint: '...' } }`,
    )
    process.exit(1)
  }

  if (!config.schema) {
    console.error(`Build failed: 'schema' config is required for URN resolution.`)
    process.exit(1)
  }

  const bundle = loadMetaBundle({
    sourceDir: config.resolved.docs.outputDir,
    docsEntrypoint: envConfig.documentEntrypoint,
    apiEntrypoint: envConfig.apiEntrypoint,
    schemaUrnResolver: config.schema,
  })

  writeSchemaBundle(bundle, config.resolved.build.outputDir)

  console.log(`Built resolved docs for '${config.envName}' to ${config.resolved.build.outputDir}`)
}
