/**
 * Audit-titles command — checks generated schema files for a `title` property
 * and warns about any missing one. Exits non-zero if any are missing so the
 * command can gate CI.
 */

import { auditSchemaTitles } from '../builder/audit-titles.js'
import type { ResolvedConfig } from './config.js'

export async function auditTitles(config: ResolvedConfig): Promise<void> {
  const outputDir = config.resolved.docs.outputDir
  const { checked, missing } = auditSchemaTitles(outputDir)

  if (missing.length > 0) {
    const noun = missing.length === 1 ? 'schema' : 'schemas'
    console.warn(
      `Found ${missing.length} ${noun} missing title (of ${checked} checked) in ${outputDir}:`,
    )
    for (const path of missing) {
      console.warn(`  ${path}`)
    }
    process.exit(1)
  }

  console.log(`All ${checked} schemas in ${outputDir} have titles.`)
}
