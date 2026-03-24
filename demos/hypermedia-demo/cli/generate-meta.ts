/**
 * Generate Hydra API documentation — writes apidoc.jsonld + schemas to static/meta/.
 *
 * Run with: npm run generate-meta -w @cqrs-toolkit/hypermedia-demo
 */

import { generateHydraDocumentation } from '@cqrs-toolkit/hypermedia/builder'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { HydraDemoClasses } from '../server/doc.js'

const __dirname = fileURLToPath(new URL('.', import.meta.url))
const outputDir = resolve(__dirname, '../static/meta')

const { warnings, immutabilityViolations } = generateHydraDocumentation({
  outputDir,
  classes: HydraDemoClasses,
  prefixes: ['demo', 'svc'],
})

if (warnings.length) {
  console.warn('Warnings:')
  for (const w of warnings) console.warn(`  ${w}`)
}

if (immutabilityViolations.length) {
  console.error('Schema immutability violations:')
  for (const err of immutabilityViolations) console.error(`  ${err}`)
  process.exit(1)
}

console.log(`Generated Hydra docs to ${outputDir}`)
