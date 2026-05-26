import { describe, expect, it } from 'vitest'
import { assembleFiles } from './assembler.js'
import { classifyDeclarations } from './classifier.js'
import { createJsonSchemaToTypescriptCompiler } from './json-schema-compiler.js'
import { BUNDLE_ROOT_NAME, bundleSchemas } from './schema-bundler.js'

function invert<K, V>(m: Map<K, V>): Map<V, K> {
  const out = new Map<V, K>()
  for (const [k, v] of m) out.set(v, k)
  return out
}

async function pipeline(
  schemas: object[],
  commandUrns: string[],
  representationUrns: string[],
  extras: {
    linkType?: 'Link' | 'ServiceLink'
    idReferences?: Parameters<typeof bundleSchemas>[0]['idReferences']
  } = {},
) {
  const bundled = bundleSchemas({
    schemas: schemas as never,
    commandUrns,
    representationUrns,
    idReferences: extras.idReferences,
    linkType: extras.linkType,
  })
  const source = await createJsonSchemaToTypescriptCompiler().compile(bundled.bundle)
  const ignoreNames = new Set<string>([BUNDLE_ROOT_NAME])
  for (const external of bundled.externalsUsed) {
    ignoreNames.add(`__External_${external}`)
  }
  const classified = classifyDeclarations({
    source,
    nameToUrn: invert(bundled.urnToName),
    urnToRole: bundled.urnToRole,
    ignoreNames,
  })
  return { source, classified }
}

describe('assembleFiles', () => {
  it('emits shared, commands, reps with the declarations they own', async () => {
    const { source, classified } = await pipeline(
      [
        {
          $id: 'urn:schema:foo.Shared:1.0.0',
          title: 'SharedV1_0_0',
          type: 'object',
          properties: { id: { type: 'string' } },
          required: ['id'],
        },
        {
          $id: 'urn:schema:foo.Cmd:1.0.0',
          title: 'CmdV1_0_0',
          type: 'object',
          properties: { target: { $ref: 'urn:schema:foo.Shared:1.0.0' } },
          required: ['target'],
        },
        {
          $id: 'urn:schema:foo.Rep:1.0.0',
          title: 'RepV1_0_0',
          type: 'object',
          properties: { value: { $ref: 'urn:schema:foo.Shared:1.0.0' } },
          required: ['value'],
        },
      ],
      ['urn:schema:foo.Cmd:1.0.0'],
      ['urn:schema:foo.Rep:1.0.0'],
    )
    const out = assembleFiles({ source, declarations: classified.declarations })

    expect(out.shared).toContain('export interface SharedV1_0_0')
    expect(out.shared).not.toContain('CmdV1_0_0')
    expect(out.shared).not.toContain('RepV1_0_0')

    expect(out.commands).toContain('export interface CmdV1_0_0')
    expect(out.commands).not.toContain('export interface RepV1_0_0')

    expect(out.reps).toContain('export interface RepV1_0_0')
    expect(out.reps).not.toContain('export interface CmdV1_0_0')
  })

  it('adds import-type lines for shared references in commands/reps', async () => {
    const { source, classified } = await pipeline(
      [
        {
          $id: 'urn:schema:foo.Shared:1.0.0',
          title: 'SharedV1_0_0',
          type: 'object',
          properties: { id: { type: 'string' } },
          required: ['id'],
        },
        {
          $id: 'urn:schema:foo.Cmd:1.0.0',
          title: 'CmdV1_0_0',
          type: 'object',
          properties: { target: { $ref: 'urn:schema:foo.Shared:1.0.0' } },
          required: ['target'],
        },
        {
          $id: 'urn:schema:foo.Rep:1.0.0',
          title: 'RepV1_0_0',
          type: 'object',
          properties: { value: { $ref: 'urn:schema:foo.Shared:1.0.0' } },
          required: ['value'],
        },
      ],
      ['urn:schema:foo.Cmd:1.0.0'],
      ['urn:schema:foo.Rep:1.0.0'],
    )
    const out = assembleFiles({ source, declarations: classified.declarations })

    expect(out.commands).toContain("import type { SharedV1_0_0 } from '../shared/types.js'")
    expect(out.reps).toContain("import type { SharedV1_0_0 } from '../shared/types.js'")
    expect(out.shared).not.toContain('import type')
  })

  it('emits `export {}` for an empty role file', async () => {
    const { source, classified } = await pipeline(
      [
        {
          $id: 'urn:schema:foo.Cmd:1.0.0',
          title: 'CmdV1_0_0',
          type: 'object',
        },
      ],
      ['urn:schema:foo.Cmd:1.0.0'],
      [],
    )
    const out = assembleFiles({ source, declarations: classified.declarations })
    expect(out.reps).toContain('export {}')
    expect(out.shared).toContain('export {}')
  })

  it('sorts declarations within a file by name', async () => {
    const { source, classified } = await pipeline(
      [
        { $id: 'urn:schema:z.Zebra:1.0.0', title: 'ZebraV1_0_0', type: 'object' },
        { $id: 'urn:schema:a.Apple:1.0.0', title: 'AppleV1_0_0', type: 'object' },
        { $id: 'urn:schema:m.Mango:1.0.0', title: 'MangoV1_0_0', type: 'object' },
      ],
      ['urn:schema:z.Zebra:1.0.0', 'urn:schema:a.Apple:1.0.0', 'urn:schema:m.Mango:1.0.0'],
      [],
    )
    const out = assembleFiles({ source, declarations: classified.declarations })
    const idxA = out.commands.indexOf('AppleV1_0_0')
    const idxM = out.commands.indexOf('MangoV1_0_0')
    const idxZ = out.commands.indexOf('ZebraV1_0_0')
    expect(idxA).toBeGreaterThan(-1)
    expect(idxA).toBeLessThan(idxM)
    expect(idxM).toBeLessThan(idxZ)
  })

  it('rewrites __External_X identifiers and emits grouped imports per module', async () => {
    const { source, classified } = await pipeline(
      [
        {
          $id: 'urn:schema:foo.Cmd:1.0.0',
          title: 'CmdV1_0_0',
          type: 'object',
          properties: {
            id: { type: 'string' },
            related: { type: 'object' },
          },
          required: ['id', 'related'],
        },
      ],
      ['urn:schema:foo.Cmd:1.0.0'],
      [],
      {
        linkType: 'ServiceLink',
        idReferences: [
          {
            urn: 'urn:schema:foo.Cmd:1.0.0',
            paths: [
              { kind: 'id', path: '$.id' },
              { kind: 'link', path: '$.related' },
            ],
          },
        ],
      },
    )
    const out = assembleFiles({ source, declarations: classified.declarations })

    expect(out.commands).toContain("import type { EntityId } from '@cqrs-toolkit/client'")
    expect(out.commands).toContain("import type { ServiceLink } from '@meticoeus/ddd-es'")
    expect(out.commands).not.toContain('__External_')
    expect(out.commands).toMatch(/id:\s*EntityId/)
    expect(out.commands).toMatch(/related:\s*ServiceLink/)
  })

  it('respects a custom banner', async () => {
    const { source, classified } = await pipeline(
      [{ $id: 'urn:schema:foo.A:1.0.0', title: 'AV1_0_0', type: 'object' }],
      ['urn:schema:foo.A:1.0.0'],
      [],
    )
    const out = assembleFiles({
      source,
      declarations: classified.declarations,
      bannerComment: '// CUSTOM_HEADER',
    })
    expect(out.commands.startsWith('// CUSTOM_HEADER')).toBe(true)
  })
})
