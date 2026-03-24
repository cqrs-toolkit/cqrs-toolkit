#!/usr/bin/env node
import { init } from '../dist/src/cli/init.js'
import { pull } from '../dist/src/cli/pull.js'

const subcommand = process.argv[2]

function parseFlag(name) {
  const prefix = `--${name}=`
  const arg = process.argv.find((a) => a.startsWith(prefix))
  return arg ? arg.slice(prefix.length) : undefined
}

switch (subcommand) {
  case 'init': {
    const server = parseFlag('server')
    const apidocPath = parseFlag('apidoc-path')
    const conflict = parseFlag('conflict')
    if (!server || !apidocPath) {
      console.error(
        'Usage: cqrs-pull init --server=<url> --apidoc-path=<path> [--conflict=abort|update|override]',
      )
      process.exit(1)
    }
    if (conflict && !['abort', 'update', 'override'].includes(conflict)) {
      console.error(`Invalid --conflict value: ${conflict}. Must be abort, update, or override.`)
      process.exit(1)
    }
    init(process.cwd(), { server, apidocPath, conflict }).catch((err) => {
      console.error(err.message)
      process.exit(1)
    })
    break
  }

  case 'generate':
  case undefined: {
    // Default: run generate (backwards-compatible with old `cqrs-pull` behavior)
    pull(process.cwd()).catch((err) => {
      console.error(err.message)
      process.exit(1)
    })
    break
  }

  default:
    console.error(`Unknown command: ${subcommand}`)
    console.error('Usage: cqrs-pull [init|generate]')
    process.exit(1)
}
