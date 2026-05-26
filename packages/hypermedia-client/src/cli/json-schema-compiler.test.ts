import { describe, expect, it } from 'vitest'
import { createJsonSchemaToTypescriptCompiler } from './json-schema-compiler.js'
import { bundleSchemas } from './schema-bundler.js'

describe('JsonSchemaToTsCompiler (json-schema-to-typescript impl)', () => {
  const compiler = createJsonSchemaToTypescriptCompiler()

  it('compiles a bundle into TS source with one named type per definition', async () => {
    const { bundle } = bundleSchemas({
      schemas: [
        {
          $id: 'urn:schema:foo.Bar:1.0.0',
          title: 'BarV1_0_0',
          type: 'object',
          properties: { name: { type: 'string' } },
          required: ['name'],
        },
      ],
      commandUrns: ['urn:schema:foo.Bar:1.0.0'],
      representationUrns: [],
    })
    const ts = await compiler.compile(bundle)
    expect(ts).toContain('export interface BarV1_0_0')
    expect(ts).toContain('name: string')
  })

  it('emits cross-ref schemas as named-type references, not inlined', async () => {
    const { bundle } = bundleSchemas({
      schemas: [
        {
          $id: 'urn:schema:foo.Inner:1.0.0',
          title: 'InnerV1_0_0',
          type: 'object',
          properties: { val: { type: 'string' } },
          required: ['val'],
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
    const ts = await compiler.compile(bundle)
    expect(ts).toContain('export interface OuterV1_0_0')
    expect(ts).toContain('export interface InnerV1_0_0')
    expect(ts).toMatch(/inner:\s*InnerV1_0_0/)
  })

  it('emits string enums as literal unions, not TS enum declarations', async () => {
    const { bundle } = bundleSchemas({
      schemas: [
        {
          $id: 'urn:schema:foo.Color:1.0.0',
          title: 'ColorV1_0_0',
          type: 'string',
          enum: ['red', 'green', 'blue'],
        },
      ],
      commandUrns: [],
      representationUrns: ['urn:schema:foo.Color:1.0.0'],
    })
    const ts = await compiler.compile(bundle)
    expect(ts).not.toMatch(/\benum\s+\w+\s*\{/)
    expect(ts).toMatch(/["']red["']\s*\|\s*["']green["']\s*\|\s*["']blue["']/)
  })

  it('omits the banner so the caller controls the file header', async () => {
    const { bundle } = bundleSchemas({
      schemas: [
        {
          $id: 'urn:schema:foo.Empty:1.0.0',
          title: 'EmptyV1_0_0',
          type: 'object',
        },
      ],
      commandUrns: ['urn:schema:foo.Empty:1.0.0'],
      representationUrns: [],
    })
    const ts = await compiler.compile(bundle)
    expect(ts).not.toMatch(/DO NOT MODIFY/i)
  })
})
