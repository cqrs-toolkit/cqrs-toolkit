/**
 * Audit the saved schema files under a docs output directory for a top-level
 * `title` property. Pure helper; the CLI wrapper handles logging and exit codes.
 */

import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join, relative } from 'node:path'

export interface AuditSchemaTitlesResult {
  /** Total schema files examined */
  checked: number
  /** Paths of schemas missing a title, relative to outputDir */
  missing: string[]
}

export function auditSchemaTitles(outputDir: string): AuditSchemaTitlesResult {
  const schemasDir = join(outputDir, 'schemas')
  if (!existsSync(schemasDir)) {
    return { checked: 0, missing: [] }
  }

  const missing: string[] = []
  let checked = 0
  const files = readdirSync(schemasDir, { recursive: true, encoding: 'utf-8' })

  for (const file of files) {
    if (!file.endsWith('.json')) continue
    const filePath = join(schemasDir, file)
    const parsed: unknown = JSON.parse(readFileSync(filePath, 'utf-8'))
    checked++
    const hasTitle =
      typeof parsed === 'object' &&
      parsed !== null &&
      'title' in parsed &&
      typeof parsed.title === 'string' &&
      parsed.title.length > 0
    if (!hasTitle) {
      missing.push(relative(outputDir, filePath))
    }
  }

  return { checked, missing }
}
