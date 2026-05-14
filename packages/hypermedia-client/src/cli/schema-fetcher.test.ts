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
})
