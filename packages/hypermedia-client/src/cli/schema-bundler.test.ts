import type { JSONSchema7 } from 'json-schema'
import { describe, expect, it } from 'vitest'
import { bundleSchemas } from './schema-bundler.js'

function todoSchema(): JSONSchema7 {
  return {
    $id: 'urn:schema:nb.Todo:1.0.0',
    title: 'TodoReadModelV1_0_0',
    type: 'object',
    properties: {
      id: { type: 'string' },
      content: { type: 'string' },
    },
    required: ['id', 'content'],
  }
}

function todoCollectionSchema(): JSONSchema7 {
  return {
    $id: 'urn:schema:nb.TodoCollection:1.0.0',
    title: 'TodoCollectionReadModelV1_0_0',
    type: 'object',
    properties: {
      entities: {
        type: 'array',
        items: { $ref: 'urn:schema:nb.Todo:1.0.0' },
      },
    },
    required: ['entities'],
  }
}

function createTodoSchema(): JSONSchema7 {
  return {
    $id: 'urn:schema:nb.CreateTodo:1.0.0',
    title: 'CreateTodoCommandV1_0_0',
    type: 'object',
    properties: { content: { type: 'string' } },
    required: ['content'],
  }
}

describe('bundleSchemas', () => {
  it('rewrites external URN refs to internal #/definitions pointers', () => {
    const { bundle } = bundleSchemas({
      schemas: [todoSchema(), todoCollectionSchema()],
      commandUrns: [],
      representationUrns: ['urn:schema:nb.TodoCollection:1.0.0'],
    })

    const collection = bundle.definitions?.['TodoCollectionReadModelV1_0_0'] as JSONSchema7
    const items = (collection.properties?.['entities'] as JSONSchema7).items as JSONSchema7
    expect(items.$ref).toBe('#/definitions/TodoReadModelV1_0_0')
  })

  it('uses title as the definitions key', () => {
    const { bundle } = bundleSchemas({
      schemas: [createTodoSchema()],
      commandUrns: ['urn:schema:nb.CreateTodo:1.0.0'],
      representationUrns: [],
    })
    expect(Object.keys(bundle.definitions ?? {})).toContain('CreateTodoCommandV1_0_0')
  })

  it('strips $id and svc:urn from definition entries (but keeps title)', () => {
    const schema: JSONSchema7 = {
      ...todoSchema(),
    }
    // svc:urn isn't part of standard JSON Schema; assigned via index
    ;(schema as Record<string, unknown>)['svc:urn'] = 'urn:schema:nb.Todo:1.0.0'

    const { bundle } = bundleSchemas({
      schemas: [schema],
      commandUrns: [],
      representationUrns: ['urn:schema:nb.Todo:1.0.0'],
    })
    const todo = bundle.definitions?.['TodoReadModelV1_0_0'] as Record<string, unknown>
    expect(todo['$id']).toBeUndefined()
    expect(todo['svc:urn']).toBeUndefined()
    expect(todo['title']).toBe('TodoReadModelV1_0_0')
  })

  it('classifies top-level entries as commands or reps regardless of cross-reference', () => {
    const { urnToRole } = bundleSchemas({
      schemas: [createTodoSchema(), todoSchema(), todoCollectionSchema()],
      commandUrns: ['urn:schema:nb.CreateTodo:1.0.0'],
      representationUrns: ['urn:schema:nb.TodoCollection:1.0.0'],
    })
    expect(urnToRole.get('urn:schema:nb.CreateTodo:1.0.0')).toBe('commands')
    expect(urnToRole.get('urn:schema:nb.TodoCollection:1.0.0')).toBe('reps')
    expect(urnToRole.get('urn:schema:nb.Todo:1.0.0')).toBe('reps')
  })

  it('classifies a schema reachable from both commands and reps as shared', () => {
    const commandRef: JSONSchema7 = {
      $id: 'urn:schema:nb.CmdWithTodo:1.0.0',
      title: 'CmdWithTodoV1_0_0',
      type: 'object',
      properties: { target: { $ref: 'urn:schema:nb.Todo:1.0.0' } },
    }
    const { urnToRole } = bundleSchemas({
      schemas: [commandRef, todoSchema(), todoCollectionSchema()],
      commandUrns: ['urn:schema:nb.CmdWithTodo:1.0.0'],
      representationUrns: ['urn:schema:nb.TodoCollection:1.0.0'],
    })
    expect(urnToRole.get('urn:schema:nb.Todo:1.0.0')).toBe('shared')
  })

  it('silently dedupes duplicate URN inputs and keeps the first', () => {
    const { warnings, bundle } = bundleSchemas({
      schemas: [todoSchema(), todoSchema()],
      commandUrns: [],
      representationUrns: ['urn:schema:nb.Todo:1.0.0'],
    })
    expect(warnings.some((w) => /duplicate/i.test(w))).toBe(false)
    expect(Object.keys(bundle.definitions ?? {})).toHaveLength(1)
  })

  it('warns on orphan schemas (not reachable from any top-level entry)', () => {
    const { warnings } = bundleSchemas({
      schemas: [createTodoSchema(), todoSchema()],
      commandUrns: ['urn:schema:nb.CreateTodo:1.0.0'],
      representationUrns: [],
    })
    expect(warnings.some((w) => w.includes('not reachable'))).toBe(true)
  })

  it('throws on type-name collision between two different URNs', () => {
    const a: JSONSchema7 = { $id: 'urn:schema:a.Foo:1.0.0', title: 'Same', type: 'object' }
    const b: JSONSchema7 = { $id: 'urn:schema:b.Foo:1.0.0', title: 'Same', type: 'object' }
    expect(() =>
      bundleSchemas({
        schemas: [a, b],
        commandUrns: ['urn:schema:a.Foo:1.0.0', 'urn:schema:b.Foo:1.0.0'],
        representationUrns: [],
      }),
    ).toThrowError(/type-name collision/)
  })

  it('throws on external $ref that has no fetched target', () => {
    const dangling: JSONSchema7 = {
      $id: 'urn:schema:nb.Dangling:1.0.0',
      title: 'DanglingV1_0_0',
      type: 'object',
      properties: { x: { $ref: 'urn:schema:nb.Missing:1.0.0' } },
    }
    expect(() =>
      bundleSchemas({
        schemas: [dangling],
        commandUrns: ['urn:schema:nb.Dangling:1.0.0'],
        representationUrns: [],
      }),
    ).toThrowError(/unresolved external \$ref/)
  })

  it('preserves internal fragment refs (e.g. #/definitions/X)', () => {
    const withInternalRef: JSONSchema7 = {
      $id: 'urn:schema:nb.SelfRef:1.0.0',
      title: 'SelfRefV1_0_0',
      type: 'object',
      properties: { sibling: { $ref: '#/definitions/Inner' } },
      definitions: { Inner: { type: 'string' } },
    }
    const { bundle } = bundleSchemas({
      schemas: [withInternalRef],
      commandUrns: ['urn:schema:nb.SelfRef:1.0.0'],
      representationUrns: [],
    })
    const self = bundle.definitions?.['SelfRefV1_0_0'] as JSONSchema7
    const sibling = self.properties?.['sibling'] as JSONSchema7
    expect(sibling.$ref).toBe('#/definitions/Inner')
  })

  it('accepts string inputs and parses them', () => {
    const { bundle } = bundleSchemas({
      schemas: [JSON.stringify(todoSchema())],
      commandUrns: [],
      representationUrns: ['urn:schema:nb.Todo:1.0.0'],
    })
    expect(Object.keys(bundle.definitions ?? {})).toContain('TodoReadModelV1_0_0')
  })

  it('applies idReferences kind: "id" — replaces field with __External_EntityId ref', () => {
    const { bundle, externalsUsed } = bundleSchemas({
      schemas: [todoSchema()],
      commandUrns: [],
      representationUrns: ['urn:schema:nb.Todo:1.0.0'],
      idReferences: [{ urn: 'urn:schema:nb.Todo:1.0.0', paths: [{ kind: 'id', path: '$.id' }] }],
    })
    const todo = bundle.definitions?.['TodoReadModelV1_0_0'] as JSONSchema7
    const idProp = todo.properties?.['id'] as JSONSchema7
    expect(idProp.$ref).toBe('#/definitions/__External_EntityId')
    expect(externalsUsed.has('EntityId')).toBe(true)
    expect(bundle.definitions?.['__External_EntityId']).toBeDefined()
  })

  it('applies idReferences kind: "link" using configured linkType', () => {
    const withLink: JSONSchema7 = {
      $id: 'urn:schema:foo.Bar:1.0.0',
      title: 'BarV1_0_0',
      type: 'object',
      properties: { related: { type: 'object' } },
    }
    const { bundle, externalsUsed } = bundleSchemas({
      schemas: [withLink],
      commandUrns: ['urn:schema:foo.Bar:1.0.0'],
      representationUrns: [],
      linkType: 'ServiceLink',
      idReferences: [
        { urn: 'urn:schema:foo.Bar:1.0.0', paths: [{ kind: 'link', path: '$.related' }] },
      ],
    })
    const bar = bundle.definitions?.['BarV1_0_0'] as JSONSchema7
    const related = bar.properties?.['related'] as JSONSchema7
    expect(related.$ref).toBe('#/definitions/__External_ServiceLink')
    expect(externalsUsed.has('ServiceLink')).toBe(true)
  })

  it('throws when a idReferences kind: "link" entry lacks a configured linkType', () => {
    const withLink: JSONSchema7 = {
      $id: 'urn:schema:foo.Bar:1.0.0',
      title: 'BarV1_0_0',
      type: 'object',
      properties: { related: { type: 'object' } },
    }
    expect(() =>
      bundleSchemas({
        schemas: [withLink],
        commandUrns: ['urn:schema:foo.Bar:1.0.0'],
        representationUrns: [],
        idReferences: [
          { urn: 'urn:schema:foo.Bar:1.0.0', paths: [{ kind: 'link', path: '$.related' }] },
        ],
      }),
    ).toThrowError(/has kind 'link' but no 'linkType' configured/)
  })

  it('applies idReferences kind: "link" over a oneOf — preserves literal branches', () => {
    const linkLiteralUnion: JSONSchema7 = {
      $id: 'urn:schema:foo.Asset:1.0.0',
      title: 'AssetV1_0_0',
      type: 'object',
      properties: {
        association: {
          description: 'Either the default sentinel or an Asset link.',
          oneOf: [
            { const: 'default', type: 'string' },
            {
              additionalProperties: false,
              type: 'object',
              properties: {
                id: { type: 'string' },
                type: { enum: ['Asset'], type: 'string' },
              },
              required: ['type', 'id'],
            },
          ],
        },
      },
    }
    const { bundle, externalsUsed } = bundleSchemas({
      schemas: [linkLiteralUnion],
      commandUrns: ['urn:schema:foo.Asset:1.0.0'],
      representationUrns: [],
      linkType: 'ServiceLink',
      idReferences: [
        { urn: 'urn:schema:foo.Asset:1.0.0', paths: [{ kind: 'link', path: '$.association' }] },
      ],
    })
    const asset = bundle.definitions?.['AssetV1_0_0'] as JSONSchema7
    const association = asset.properties?.['association'] as JSONSchema7
    expect(association.oneOf).toBeDefined()
    expect(association.oneOf?.length).toBe(2)
    const literal = association.oneOf?.[0] as JSONSchema7
    expect(literal.const).toBe('default')
    const link = association.oneOf?.[1] as JSONSchema7
    expect(link.$ref).toBe('#/definitions/__External_ServiceLink')
    expect(association.description).toBe('Either the default sentinel or an Asset link.')
    expect(externalsUsed.has('ServiceLink')).toBe(true)
  })

  it('applies idReferences kind: "id" over a oneOf — preserves literal branches', () => {
    const idLiteralUnion: JSONSchema7 = {
      $id: 'urn:schema:foo.Slot:1.0.0',
      title: 'SlotV1_0_0',
      type: 'object',
      properties: {
        owner: {
          oneOf: [{ const: 'unassigned', type: 'string' }, { type: 'string' }],
        },
      },
    }
    const { bundle, externalsUsed } = bundleSchemas({
      schemas: [idLiteralUnion],
      commandUrns: ['urn:schema:foo.Slot:1.0.0'],
      representationUrns: [],
      idReferences: [
        { urn: 'urn:schema:foo.Slot:1.0.0', paths: [{ kind: 'id', path: '$.owner' }] },
      ],
    })
    const slot = bundle.definitions?.['SlotV1_0_0'] as JSONSchema7
    const owner = slot.properties?.['owner'] as JSONSchema7
    expect(owner.oneOf?.length).toBe(2)
    expect((owner.oneOf?.[0] as JSONSchema7).const).toBe('unassigned')
    expect((owner.oneOf?.[1] as JSONSchema7).$ref).toBe('#/definitions/__External_EntityId')
    expect(externalsUsed.has('EntityId')).toBe(true)
  })

  it('collapses a oneOf where every branch matches into a single $ref', () => {
    const allLinks: JSONSchema7 = {
      $id: 'urn:schema:foo.Multi:1.0.0',
      title: 'MultiV1_0_0',
      type: 'object',
      properties: {
        link: {
          oneOf: [
            { type: 'object', properties: { id: { type: 'string' }, type: { const: 'A' } } },
            { type: 'object', properties: { id: { type: 'string' }, type: { const: 'B' } } },
          ],
        },
      },
    }
    const { bundle } = bundleSchemas({
      schemas: [allLinks],
      commandUrns: ['urn:schema:foo.Multi:1.0.0'],
      representationUrns: [],
      linkType: 'ServiceLink',
      idReferences: [
        { urn: 'urn:schema:foo.Multi:1.0.0', paths: [{ kind: 'link', path: '$.link' }] },
      ],
    })
    const multi = bundle.definitions?.['MultiV1_0_0'] as JSONSchema7
    const link = multi.properties?.['link'] as JSONSchema7
    expect(link.$ref).toBe('#/definitions/__External_ServiceLink')
    expect(link.oneOf).toBeUndefined()
  })

  it('throws when a oneOf at an idReferences target has no matching branch', () => {
    const noMatch: JSONSchema7 = {
      $id: 'urn:schema:foo.NoMatch:1.0.0',
      title: 'NoMatchV1_0_0',
      type: 'object',
      properties: {
        ref: {
          oneOf: [
            { const: 'a', type: 'string' },
            { const: 'b', type: 'string' },
          ],
        },
      },
    }
    expect(() =>
      bundleSchemas({
        schemas: [noMatch],
        commandUrns: ['urn:schema:foo.NoMatch:1.0.0'],
        representationUrns: [],
        linkType: 'ServiceLink',
        idReferences: [
          { urn: 'urn:schema:foo.NoMatch:1.0.0', paths: [{ kind: 'link', path: '$.ref' }] },
        ],
      }),
    ).toThrowError(/no branch matching the 'link' shape/)
  })

  it('throws when an allOf composition is at an idReferences target', () => {
    const allOfTarget: JSONSchema7 = {
      $id: 'urn:schema:foo.AllOf:1.0.0',
      title: 'AllOfV1_0_0',
      type: 'object',
      properties: {
        link: { allOf: [{ type: 'object', properties: { id: { type: 'string' } } }] },
      },
    }
    expect(() =>
      bundleSchemas({
        schemas: [allOfTarget],
        commandUrns: ['urn:schema:foo.AllOf:1.0.0'],
        representationUrns: [],
        linkType: 'ServiceLink',
        idReferences: [
          { urn: 'urn:schema:foo.AllOf:1.0.0', paths: [{ kind: 'link', path: '$.link' }] },
        ],
      }),
    ).toThrowError(/'allOf' compositions are not supported/)
  })

  it('warns when a idReferences URN was not bundled', () => {
    const { warnings } = bundleSchemas({
      schemas: [todoSchema()],
      commandUrns: [],
      representationUrns: ['urn:schema:nb.Todo:1.0.0'],
      idReferences: [
        { urn: 'urn:schema:unknown.Thing:1.0.0', paths: [{ kind: 'id', path: '$.id' }] },
      ],
    })
    expect(warnings.some((w) => w.includes('was not bundled'))).toBe(true)
  })
})

describe('bundleSchemas — type-name derivation', () => {
  function untitled(): JSONSchema7 {
    return {
      $id: 'urn:schema:nb.NoTitle:1.0.0',
      type: 'object',
      properties: { id: { type: 'string' } },
    }
  }

  it('throws with an aggregated message when a schema has no title and no deriveTypeName mapper', () => {
    expect(() =>
      bundleSchemas({
        schemas: [untitled()],
        commandUrns: ['urn:schema:nb.NoTitle:1.0.0'],
        representationUrns: [],
      }),
    ).toThrowError(/no 'title' and no 'codegen\.deriveTypeName' mapper configured/)
  })

  it('uses the supplied deriveTypeName mapper when title is missing', () => {
    const { bundle, urnToName } = bundleSchemas({
      schemas: [untitled()],
      commandUrns: ['urn:schema:nb.NoTitle:1.0.0'],
      representationUrns: [],
      deriveTypeName: (urn) => {
        const last = urn.split(':')[2]
        return last ? last.replace(/^[^.]+\./, '') : 'Unknown'
      },
    })
    expect(urnToName.get('urn:schema:nb.NoTitle:1.0.0')).toBe('NoTitle')
    expect(bundle.definitions?.['NoTitle']).toBeDefined()
  })

  it('rejects an invalid return value from deriveTypeName', () => {
    expect(() =>
      bundleSchemas({
        schemas: [untitled()],
        commandUrns: ['urn:schema:nb.NoTitle:1.0.0'],
        representationUrns: [],
        deriveTypeName: () => '',
      }),
    ).toThrowError(/returned an invalid name/)
  })

  it('aggregates multiple name-derivation failures into one thrown error', () => {
    const other: JSONSchema7 = {
      $id: 'urn:schema:nb.AlsoNoTitle:1.0.0',
      type: 'object',
    }
    expect(() =>
      bundleSchemas({
        schemas: [untitled(), other],
        commandUrns: ['urn:schema:nb.NoTitle:1.0.0', 'urn:schema:nb.AlsoNoTitle:1.0.0'],
        representationUrns: [],
      }),
    ).toThrowError(/2 error\(s\) building type-name map/)
  })
})
