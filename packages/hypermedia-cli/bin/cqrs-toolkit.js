#!/usr/bin/env node

const args = process.argv.slice(2)
const group = args[0]
const command = args[1]

function parseFlag(name) {
  const prefix = `--${name}=`
  const arg = args.find((a) => a.startsWith(prefix))
  return arg ? arg.slice(prefix.length) : undefined
}

const hasHelp = args.includes('-h') || args.includes('--help')

const USAGE = `Usage: cqrs-toolkit <group> <command> [options]

Groups:
  server    Hydra API documentation authoring
  client    Typed client code generation

Options:
  -h, --help    Show this help message

Run \`cqrs-toolkit <group> --help\` for command details.`

const SERVER_USAGE = `Usage: cqrs-toolkit server <command> [options]

Commands:
  docs    Generate stable documentation artifacts (URNs)
  build   Build resolved artifacts for deployment (real URLs)

Options:
  --env=<name>  Environment name (default: dev)
  -h, --help    Show this help message`

const CLIENT_USAGE = `Usage: cqrs-toolkit client <command> [options]

Commands:
  init    Discover apidoc and initialize config
  pull    Generate typed client code from apidoc

Options (init):
  --server=<url>                        Server URL
  --apidoc-path=<path>                  Apidoc endpoint path
  --conflict=abort|update|override      Conflict resolution mode

Options:
  -h, --help    Show this help message`

if (!group || (hasHelp && !['server', 'client'].includes(group))) {
  console.log(USAGE)
  process.exit(hasHelp ? 0 : 1)
}

switch (group) {
  case 'server': {
    if (!command || hasHelp) {
      console.log(SERVER_USAGE)
      process.exit(command ? 0 : 1)
    }
    const opts = { env: parseFlag('env') }
    switch (command) {
      case 'docs': {
        const { run } = await import('../dist/src/server/docs.js')
        await run(process.cwd(), opts).catch(fatal)
        break
      }
      case 'build': {
        const { run } = await import('../dist/src/server/build.js')
        await run(process.cwd(), opts).catch(fatal)
        break
      }
      default:
        console.error(`cqrs-toolkit server: unknown command '${command}'\n`)
        console.error(SERVER_USAGE)
        process.exit(1)
    }
    break
  }

  case 'client': {
    if (!command || hasHelp) {
      console.log(CLIENT_USAGE)
      process.exit(command ? 0 : 1)
    }
    switch (command) {
      case 'init': {
        const server = parseFlag('server')
        const apidocPath = parseFlag('apidoc-path')
        const conflict = parseFlag('conflict')
        if (!server || !apidocPath) {
          console.error(
            'Usage: cqrs-toolkit client init --server=<url> --apidoc-path=<path> [--conflict=abort|update|override]',
          )
          process.exit(1)
        }
        if (conflict && !['abort', 'update', 'override'].includes(conflict)) {
          console.error(
            `Invalid --conflict value: ${conflict}. Must be abort, update, or override.`,
          )
          process.exit(1)
        }
        const { run } = await import('../dist/src/client/init.js')
        await run(process.cwd(), { server, apidocPath, conflict }).catch(fatal)
        break
      }
      case 'pull': {
        const { run } = await import('../dist/src/client/pull.js')
        await run(process.cwd()).catch(fatal)
        break
      }
      default:
        console.error(`cqrs-toolkit client: unknown command '${command}'\n`)
        console.error(CLIENT_USAGE)
        process.exit(1)
    }
    break
  }

  default:
    console.error(`cqrs-toolkit: unknown group '${group}'\n`)
    console.error(USAGE)
    process.exit(1)
}

function fatal(err) {
  console.error(err.message)
  process.exit(1)
}
