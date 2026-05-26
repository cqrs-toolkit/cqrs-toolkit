import { describe, expect, it } from 'vitest'
import { classifyDeclarations } from './classifier.js'
import { createJsonSchemaToTypescriptCompiler } from './json-schema-compiler.js'
import { BUNDLE_ROOT_NAME, bundleSchemas, type Role } from './schema-bundler.js'

function invert<K, V>(m: Map<K, V>): Map<V, K> {
  const out = new Map<V, K>()
  for (const [k, v] of m) out.set(v, k)
  return out
}

describe('classifyDeclarations', () => {
  const compiler = createJsonSchemaToTypescriptCompiler()

  it('classifies a single command-only declaration', async () => {
    const { bundle, urnToName, urnToRole } = bundleSchemas({
      schemas: [
        {
          $id: 'urn:schema:foo.Cmd:1.0.0',
          title: 'CmdV1_0_0',
          type: 'object',
          properties: { x: { type: 'string' } },
          required: ['x'],
        },
      ],
      commandUrns: ['urn:schema:foo.Cmd:1.0.0'],
      representationUrns: [],
    })
    const source = await compiler.compile(bundle)
    const result = classifyDeclarations({
      source,
      nameToUrn: invert(urnToName),
      urnToRole,
      ignoreNames: new Set([BUNDLE_ROOT_NAME]),
    })
    expect(result.errors).toEqual([])
    expect(result.unexpected).toEqual([])
    const cmd = result.declarations.find((d) => d.name === 'CmdV1_0_0')
    expect(cmd?.role).toBe<Role>('commands')
    expect(cmd?.references).toEqual([])
  })

  it('detects references between declarations', async () => {
    const { bundle, urnToName, urnToRole } = bundleSchemas({
      schemas: [
        {
          $id: 'urn:schema:foo.Inner:1.0.0',
          title: 'InnerV1_0_0',
          type: 'object',
          properties: { v: { type: 'string' } },
          required: ['v'],
        },
        {
          $id: 'urn:schema:foo.Outer:1.0.0',
          title: 'OuterV1_0_0',
          type: 'object',
          properties: { inner: { $ref: 'urn:schema:foo.Inner:1.0.0' } },
          required: ['inner'],
        },
      ],
      commandUrns: [],
      representationUrns: ['urn:schema:foo.Outer:1.0.0'],
    })
    const source = await compiler.compile(bundle)
    const result = classifyDeclarations({
      source,
      nameToUrn: invert(urnToName),
      urnToRole,
      ignoreNames: new Set([BUNDLE_ROOT_NAME]),
    })
    expect(result.errors).toEqual([])
    const outer = result.declarations.find((d) => d.name === 'OuterV1_0_0')
    expect(outer?.references).toEqual(['InnerV1_0_0'])
    // Inner is reached from the rep top-level, so it's also 'reps' (not 'shared')
    const inner = result.declarations.find((d) => d.name === 'InnerV1_0_0')
    expect(inner?.role).toBe<Role>('reps')
  })

  it('classifies a doubly-reached schema as shared', async () => {
    const { bundle, urnToName, urnToRole } = bundleSchemas({
      schemas: [
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
      commandUrns: ['urn:schema:foo.Cmd:1.0.0'],
      representationUrns: ['urn:schema:foo.Rep:1.0.0'],
    })
    const source = await compiler.compile(bundle)
    const result = classifyDeclarations({
      source,
      nameToUrn: invert(urnToName),
      urnToRole,
      ignoreNames: new Set([BUNDLE_ROOT_NAME]),
    })
    expect(result.errors).toEqual([])
    expect(result.declarations.find((d) => d.name === 'SharedV1_0_0')?.role).toBe<Role>('shared')
  })

  it('errors on a direct commands→reps reference', async () => {
    // Top-level command directly $refs a top-level rep — this is the forbidden
    // shape.
    const { bundle, urnToName, urnToRole } = bundleSchemas({
      schemas: [
        {
          $id: 'urn:schema:foo.Rep:1.0.0',
          title: 'RepV1_0_0',
          type: 'object',
          properties: { id: { type: 'string' } },
          required: ['id'],
        },
        {
          $id: 'urn:schema:foo.Cmd:1.0.0',
          title: 'CmdV1_0_0',
          type: 'object',
          properties: { rep: { $ref: 'urn:schema:foo.Rep:1.0.0' } },
          required: ['rep'],
        },
      ],
      commandUrns: ['urn:schema:foo.Cmd:1.0.0'],
      representationUrns: ['urn:schema:foo.Rep:1.0.0'],
    })
    const source = await compiler.compile(bundle)
    const result = classifyDeclarations({
      source,
      nameToUrn: invert(urnToName),
      urnToRole,
      ignoreNames: new Set([BUNDLE_ROOT_NAME]),
    })
    expect(result.errors.length).toBeGreaterThan(0)
    expect(result.errors[0]).toMatch(/Cross-role reference/)
    expect(result.errors[0]).toContain('CmdV1_0_0')
    expect(result.errors[0]).toContain('RepV1_0_0')
  })

  it('filters the synthetic bundle-root name', async () => {
    const { bundle, urnToName, urnToRole } = bundleSchemas({
      schemas: [
        {
          $id: 'urn:schema:foo.A:1.0.0',
          title: 'AV1_0_0',
          type: 'object',
        },
      ],
      commandUrns: ['urn:schema:foo.A:1.0.0'],
      representationUrns: [],
    })
    const source = await compiler.compile(bundle)
    const result = classifyDeclarations({
      source,
      nameToUrn: invert(urnToName),
      urnToRole,
      ignoreNames: new Set([BUNDLE_ROOT_NAME]),
    })
    expect(result.declarations.find((d) => d.name === BUNDLE_ROOT_NAME)).toBeUndefined()
    expect(result.unexpected).not.toContain(BUNDLE_ROOT_NAME)
  })

  it('captures source ranges that the assembler can slice', async () => {
    const { bundle, urnToName, urnToRole } = bundleSchemas({
      schemas: [
        {
          $id: 'urn:schema:foo.A:1.0.0',
          title: 'AV1_0_0',
          type: 'object',
          properties: { x: { type: 'string' } },
          required: ['x'],
        },
      ],
      commandUrns: ['urn:schema:foo.A:1.0.0'],
      representationUrns: [],
    })
    const source = await compiler.compile(bundle)
    const result = classifyDeclarations({
      source,
      nameToUrn: invert(urnToName),
      urnToRole,
      ignoreNames: new Set([BUNDLE_ROOT_NAME]),
    })
    const decl = result.declarations.find((d) => d.name === 'AV1_0_0')
    expect(decl).toBeDefined()
    const slice = source.slice(decl!.range[0], decl!.range[1])
    expect(slice).toContain('export interface AV1_0_0')
    expect(slice).toContain('x: string')
  })
})
