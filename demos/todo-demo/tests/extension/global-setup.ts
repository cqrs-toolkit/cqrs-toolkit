import { accessSync } from 'node:fs'
import { resolve } from 'node:path'

const REQUIRED_FILES = [
  'manifest.json',
  'panel.html',
  'hook.js',
  'background.js',
  'content-script.js',
  'panel.js',
]

export default function globalSetup(): void {
  const dist = resolve(import.meta.dirname, '../../../../packages/devtools/dist')

  for (const file of REQUIRED_FILES) {
    try {
      accessSync(resolve(dist, file))
    } catch {
      throw new Error(
        `Missing ${file} in ${dist}. Run \`npm run build -w @cqrs-toolkit/devtools\` first.`,
      )
    }
  }
}
