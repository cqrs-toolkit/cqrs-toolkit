import type { JSONSchema7 } from 'json-schema'
import { describe, expect, it } from 'vitest'
import type { HydraApiDocumentation } from '../HydraApiDocumentation.js'
import { HydraDoc } from '../HydraDoc.js'
import { makeClassDef, PREFIXES, RENAME_SCHEMA } from './builder.fixtures.js'
import { buildHydraApiDocumentation, type BuildResult } from './HydraBuilder.js'
import { urnToVocabUrl } from './resolve.js'

const DOCS_ENTRYPOINT = 'https://example.com/api/meta'
const API_ENTRYPOINT = 'https://example.com/api'

const SHARED_SUB_SCHEMA: JSONSchema7 = {
  $id: 'urn:schema:test.SharedId:1.0.0',
  type: 'string',
  format: 'uuid',
}

describe('resolve', () => {
  describe('urnToVocabUrl', () => {
    it('converts a vocab URN to a dereferenceable URL', () => {
      expect(urnToVocabUrl(DOCS_ENTRYPOINT, 'urn:vocab:chat#')).toBe(
        `${DOCS_ENTRYPOINT}/vocab/chat#`,
      )
    })
  })
})

function buildSimple(): BuildResult {
  return buildHydraApiDocumentation({
    classes: [
      makeClassDef({
        surfaces: HydraDoc.standardCommandSurfaces({
          idStem: '#test',
          collectionHref: '/api/test/entities',
          idProperty: 'test:entityId',
        }),
        commands: [
          {
            id: 'urn:command:test.RenameItem:1.0.0',
            stableId: 'test.RenameItem',
            version: '1.0.0',
            dispatch: 'command',
            commandType: 'rename',
            schema: RENAME_SCHEMA,
          },
        ],
      }),
    ],
    prefixes: PREFIXES,
    strictPrefixes: true,
  })
}

function buildWithSharedSchema(): BuildResult {
  const schema: JSONSchema7 = {
    $id: 'urn:schema:test.RenameItem:1.0.0',
    type: 'object',
    properties: {
      targetId: { ...SHARED_SUB_SCHEMA },
    },
    required: ['targetId'],
    additionalProperties: false,
  }
  return buildWithCustomSchema(schema)
}

function buildWithCustomSchema(schema: JSONSchema7): BuildResult {
  return buildHydraApiDocumentation({
    classes: [
      makeClassDef({
        surfaces: HydraDoc.standardCommandSurfaces({
          idStem: '#test',
          collectionHref: '/api/test/entities',
          idProperty: 'test:entityId',
        }),
        commands: [
          {
            id: 'urn:command:test.RenameItem:1.0.0',
            stableId: 'test.RenameItem',
            version: '1.0.0',
            dispatch: 'command',
            commandType: 'rename',
            schema,
          },
        ],
      }),
    ],
    prefixes: PREFIXES,
    strictPrefixes: true,
  })
}

function findCommand(
  apidoc: HydraApiDocumentation.Document,
  commandId: string,
): HydraApiDocumentation.CommandCapability {
  const classes = apidoc['hydra:supportedClass']
  for (const cls of classes) {
    const cmds = cls['svc:commands']?.['svc:supportedCommand']
    if (!cmds) continue
    for (const cmd of cmds) {
      if (cmd['@id'] === commandId) return cmd
    }
  }
  throw new Error(`Command ${commandId} not found in apidoc`)
}
