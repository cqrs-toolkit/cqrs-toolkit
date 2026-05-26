import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ParsedCommand } from './apidoc-parser.js'
import { fetchSchemas } from './schema-fetcher.js'

function mkResponse(body: string): Response {
  return new Response(body, { status: 200, headers: { 'content-type': 'application/json' } })
}

function mkCommands(entries: Array<[string, string]>): Map<string, ParsedCommand> {
  const map = new Map<string, ParsedCommand>()
  for (const [name, url] of entries) {
    map.set(name, {
      name,
      urn: `urn:cmd:${name}`,
      schemaUrl: url,
      template: '/foo',
      mappings: [],
      dispatch: 'command',
    } as ParsedCommand)
  }
  return map
}

const ROOT = 'http://localhost:3000/api/meta/schemas/urn/schema'
const CMD_URL = `${ROOT}/svc.CmdA/1.0.0.json`
const EVENT_META_URL = `${ROOT}/core.EventMetadata/1.0.0.json`
const INT64_URL = `${ROOT}/core.Int64/1.0.0.json`

describe('fetchSchemas', () => {
  const fetchSpy = vi.fn<typeof globalThis.fetch>()

  beforeEach(() => {
    vi.stubGlobal('fetch', fetchSpy)
    fetchSpy.mockReset()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it(
    'does not duplicate a common schema that is both a direct ref and a transitive ref ' +
      'reached through a peer in the same batch',
    async () => {
      // Command schema refs both EventMetadata AND Int64 directly. EventMetadata
      // also refs Int64. The race: batch 1 = [EventMetadata, Int64] (both in
      // initial pendingRefs). During EventMetadata's iteration, Int64 isn't yet
      // marked fetched (its own iteration hasn't run), so EventMetadata's ref
      // walk re-queues Int64 for batch 2. Int64 then gets fetched + pushed twice.

      fetchSpy.mockImplementation(async (input) => {
        const url = typeof input === 'string' ? input : input.toString()
        switch (url) {
          case CMD_URL:
            return mkResponse(
              JSON.stringify({
                $id: CMD_URL,
                type: 'object',
                properties: {
                  meta: { $ref: EVENT_META_URL },
                  amount: { $ref: INT64_URL },
                },
              }),
            )
          case EVENT_META_URL:
            return mkResponse(
              JSON.stringify({
                $id: EVENT_META_URL,
                type: 'object',
                properties: {
                  position: { $ref: INT64_URL },
                },
              }),
            )
          case INT64_URL:
            return mkResponse(JSON.stringify({ $id: INT64_URL, type: 'integer' }))
          default:
            throw new Error(`unexpected fetch: ${url}`)
        }
      })

      const result = await fetchSchemas(mkCommands([['svc.CmdA', CMD_URL]]))

      const int64Entries = result.common.filter((c) => c.id === INT64_URL)
      expect(int64Entries).toHaveLength(1)

      // The same URL should also only have been fetched once.
      const int64Fetches = fetchSpy.mock.calls.filter(([input]) => {
        const url = typeof input === 'string' ? input : String(input)
        return url === INT64_URL
      })
      expect(int64Fetches).toHaveLength(1)
    },
  )

  it('fetches response schemas from both command responses and representation surfaces', async () => {
    const CMD_RESPONSE_URL = `${ROOT}/svc.CommandResponse/1.0.0.json`
    const REP_COLLECTION_URL = `${ROOT}/nb.TodoCollection/1.0.0.json`
    const REP_RESOURCE_URL = `${ROOT}/nb.Todo/1.0.0.json`

    fetchSpy.mockImplementation(async (input) => {
      const url = typeof input === 'string' ? input : input.toString()
      switch (url) {
        case CMD_URL:
          return mkResponse(JSON.stringify({ $id: CMD_URL, type: 'object' }))
        case CMD_RESPONSE_URL:
          return mkResponse(JSON.stringify({ $id: CMD_RESPONSE_URL, type: 'object' }))
        case REP_COLLECTION_URL:
          return mkResponse(JSON.stringify({ $id: REP_COLLECTION_URL, type: 'object' }))
        case REP_RESOURCE_URL:
          return mkResponse(JSON.stringify({ $id: REP_RESOURCE_URL, type: 'object' }))
        default:
          throw new Error(`unexpected fetch: ${url}`)
      }
    })

    const commands = mkCommands([['svc.CmdA', CMD_URL]])
    const cmdA = commands.get('svc.CmdA')
    if (cmdA !== undefined) {
      cmdA.responseSchema = [{ contentType: 'application/json', schemaUrl: CMD_RESPONSE_URL }]
    }

    const result = await fetchSchemas(commands, {
      'demo:Todo': {
        collection: [{ contentType: 'application/json', schemaUrl: REP_COLLECTION_URL }],
        resource: [{ contentType: 'application/json', schemaUrl: REP_RESOURCE_URL }],
      },
    })

    expect(result.commands.map((s) => s.url)).toEqual([CMD_URL])
    expect(result.responses.map((s) => s.url).sort()).toEqual(
      [CMD_RESPONSE_URL, REP_COLLECTION_URL, REP_RESOURCE_URL].sort(),
    )
    expect(result.common).toEqual([])
  })

  it('deduplicates response URLs (same schema referenced from multiple surfaces)', async () => {
    const SHARED_URL = `${ROOT}/nb.Todo/1.0.0.json`

    fetchSpy.mockImplementation(async (input) => {
      const url = typeof input === 'string' ? input : input.toString()
      switch (url) {
        case CMD_URL:
          return mkResponse(JSON.stringify({ $id: CMD_URL, type: 'object' }))
        case SHARED_URL:
          return mkResponse(JSON.stringify({ $id: SHARED_URL, type: 'object' }))
        default:
          throw new Error(`unexpected fetch: ${url}`)
      }
    })

    const result = await fetchSchemas(mkCommands([['svc.CmdA', CMD_URL]]), {
      'demo:Todo': {
        resource: [{ contentType: 'application/json', schemaUrl: SHARED_URL }],
        collection: [{ contentType: 'application/json', schemaUrl: SHARED_URL }],
      },
    })

    expect(result.responses.filter((s) => s.url === SHARED_URL)).toHaveLength(1)
    const sharedFetches = fetchSpy.mock.calls.filter(([input]) => {
      const url = typeof input === 'string' ? input : String(input)
      return url === SHARED_URL
    })
    expect(sharedFetches).toHaveLength(1)
  })

  it('prefers HAL response schemas and skips plain-JSON twins when both are advertised', async () => {
    const HAL_URL = `${ROOT}/hal/nb.Todo/1.0.0.json`
    const JSON_URL = `${ROOT}/nb.Todo/1.0.0.json`

    fetchSpy.mockImplementation(async (input) => {
      const url = typeof input === 'string' ? input : input.toString()
      switch (url) {
        case CMD_URL:
          return mkResponse(JSON.stringify({ $id: CMD_URL, type: 'object' }))
        case HAL_URL:
          return mkResponse(JSON.stringify({ $id: HAL_URL, type: 'object' }))
        default:
          throw new Error(`unexpected fetch: ${url}`)
      }
    })

    const result = await fetchSchemas(mkCommands([['svc.CmdA', CMD_URL]]), {
      'demo:Todo': {
        resource: [
          { contentType: 'application/json', schemaUrl: JSON_URL },
          { contentType: 'application/hal+json', schemaUrl: HAL_URL },
        ],
      },
    })

    expect(result.responses.map((s) => s.url)).toEqual([HAL_URL])
    const jsonFetches = fetchSpy.mock.calls.filter(([input]) => {
      const url = typeof input === 'string' ? input : String(input)
      return url === JSON_URL
    })
    expect(jsonFetches).toHaveLength(0)
  })

  it('falls back to all advertised response schemas when HAL is not present', async () => {
    const JSON_URL = `${ROOT}/nb.Todo/1.0.0.json`

    fetchSpy.mockImplementation(async (input) => {
      const url = typeof input === 'string' ? input : input.toString()
      switch (url) {
        case CMD_URL:
          return mkResponse(JSON.stringify({ $id: CMD_URL, type: 'object' }))
        case JSON_URL:
          return mkResponse(JSON.stringify({ $id: JSON_URL, type: 'object' }))
        default:
          throw new Error(`unexpected fetch: ${url}`)
      }
    })

    const result = await fetchSchemas(mkCommands([['svc.CmdA', CMD_URL]]), {
      'demo:Todo': {
        resource: [{ contentType: 'application/json', schemaUrl: JSON_URL }],
      },
    })

    expect(result.responses.map((s) => s.url)).toEqual([JSON_URL])
  })

  it('commands bucket wins over responses when a URL is in both', async () => {
    // Pathological but possible: a command schema URL also appearing in a
    // representation's response surface.
    fetchSpy.mockImplementation(async (input) => {
      const url = typeof input === 'string' ? input : input.toString()
      if (url === CMD_URL) {
        return mkResponse(JSON.stringify({ $id: CMD_URL, type: 'object' }))
      }
      throw new Error(`unexpected fetch: ${url}`)
    })

    const result = await fetchSchemas(mkCommands([['svc.CmdA', CMD_URL]]), {
      'demo:Cmd': {
        resource: [{ contentType: 'application/json', schemaUrl: CMD_URL }],
      },
    })

    expect(result.commands.map((s) => s.url)).toEqual([CMD_URL])
    expect(result.responses).toEqual([])
  })
})
