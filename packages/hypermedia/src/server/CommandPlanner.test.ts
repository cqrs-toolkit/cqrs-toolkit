import { bootstrapTestAjv, prettyErrorResult } from '@cqrs-toolkit/schema/mocks'
import assert from 'node:assert'
import { beforeAll, describe, expect, it } from 'vitest'
import {
  hydrationDef,
  multiVersionDef,
  RENAME_SCHEMA,
  singleVersionDef,
} from '../HydraDoc.fixtures.js'
import { HydraDoc } from '../HydraDoc.js'
import { CommandDispatchExtractor, CommandPlanner } from './CommandPlanner.js'
import { mockReply, post } from './server.fixtures.js'

const IDENTITY_EXTRACTOR: CommandDispatchExtractor = {
  getValidationSchema(cap) {
    assert(cap.schema, `identity extractor: capability ${cap.id} must have a schema`)
    return cap.schema
  },
}

describe('CommandPlanner', () => {
  beforeAll(() => {
    bootstrapTestAjv()
  })
  describe('constructor', () => {
    it('asserts when a capability is missing stableId', () => {
      expect(
        () =>
          new CommandPlanner(
            new HydraDoc.CommandsDef<never>({
              surfaces: HydraDoc.standardCommandSurfaces({
                idStem: '#test',
                collectionHref: '/api/test/items',
                idProperty: 'test:itemId',
              }),
              commands: [
                {
                  id: 'urn:command:test.Foo:1.0.0',
                  stableId: '',
                  dispatch: 'command',
                  commandType: 'foo',
                  schema: RENAME_SCHEMA,
                },
              ],
            }),
            IDENTITY_EXTRACTOR,
          ),
      ).toThrow('missing stableId')
    })

    it('asserts when latest version is missing schema', () => {
      expect(
        () =>
          new CommandPlanner(
            new HydraDoc.CommandsDef<never>({
              surfaces: HydraDoc.standardCommandSurfaces({
                idStem: '#test',
                collectionHref: '/api/test/items',
                idProperty: 'test:itemId',
              }),
              commands: [
                {
                  id: 'urn:command:test.Foo:1.0.0',
                  stableId: 'test.Foo',
                  dispatch: 'command',
                  commandType: 'foo',
                  // no schema
                },
              ],
            }),
            IDENTITY_EXTRACTOR,
          ),
      ).toThrow('must have a schema')
    })

    it('asserts when non-latest version is missing adapt', () => {
      expect(
        () =>
          new CommandPlanner(
            new HydraDoc.CommandsDef<never>({
              surfaces: HydraDoc.standardCommandSurfaces({
                idStem: '#test',
                collectionHref: '/api/test/items',
                idProperty: 'test:itemId',
              }),
              commands: [
                {
                  id: 'urn:command:test.Foo:1.0.0',
                  stableId: 'test.Foo',
                  dispatch: 'command',
                  commandType: 'foo',
                  // missing adapt
                },
                {
                  id: 'urn:command:test.Foo:2.0.0',
                  stableId: 'test.Foo',
                  dispatch: 'command',
                  commandType: 'foo',
                  schema: RENAME_SCHEMA,
                },
              ],
            }),
            IDENTITY_EXTRACTOR,
          ),
      ).toThrow('must have an adapt function')
    })

    it('asserts on duplicate versions within a stableId', () => {
      expect(
        () =>
          new CommandPlanner(
            new HydraDoc.CommandsDef<never>({
              surfaces: HydraDoc.standardCommandSurfaces({
                idStem: '#test',
                collectionHref: '/api/test/items',
                idProperty: 'test:itemId',
              }),
              commands: [
                {
                  id: 'urn:command:test.Foo:1.0.0',
                  stableId: 'test.Foo',
                  dispatch: 'command',
                  commandType: 'foo',
                  schema: RENAME_SCHEMA,
                },
                {
                  id: 'urn:command:test.Bar:1.0.0',
                  stableId: 'test.Foo',
                  dispatch: 'command',
                  commandType: 'bar',
                  schema: RENAME_SCHEMA,
                  adapt: (data: unknown) => data,
                },
              ],
            }),
            IDENTITY_EXTRACTOR,
          ),
      ).toThrow('duplicate version')
    })

    it('constructs successfully with valid single-version def', () => {
      expect(() => new CommandPlanner(singleVersionDef(), IDENTITY_EXTRACTOR)).not.toThrow()
    })

    it('constructs successfully with valid multi-version def', () => {
      expect(() => new CommandPlanner(multiVersionDef(), IDENTITY_EXTRACTOR)).not.toThrow()
    })
  })

  describe('validate — single version', () => {
    it('validates successfully when no profile header is present (uses latest)', () => {
      const planner = new CommandPlanner(singleVersionDef(), IDENTITY_EXTRACTOR)
      const mock = mockReply()

      const result = planner.parse<{ name: string }>(
        post(),
        mock.reply,
        { name: 'test' },
        'test.RenameItem',
      )

      expect(result.ok, prettyErrorResult(result)).toBe(true)
      if (!result.ok) return
      expect(result.value.kind).toBe('validated')
      if (result.value.kind !== 'validated') return
      expect(result.value.value).toEqual({ name: 'test' })
      expect(result.value.urn).toBe('urn:command:test.RenameItem:1.0.0')
    })

    it('validates successfully when matching Content-Profile is present', () => {
      const planner = new CommandPlanner(singleVersionDef(), IDENTITY_EXTRACTOR)
      const mock = mockReply()

      const result = planner.parse<{ name: string }>(
        post({ 'content-profile': 'urn:command:test.RenameItem:1.0.0' }),
        mock.reply,
        { name: 'test' },
        'test.RenameItem',
      )

      expect(result.ok, prettyErrorResult(result)).toBe(true)
      if (!result.ok) return
      expect(result.value.kind).toBe('validated')
    })

    it('returns SchemaException on validation failure', () => {
      const planner = new CommandPlanner(singleVersionDef(), IDENTITY_EXTRACTOR)
      const mock = mockReply()

      const result = planner.parse<{ name: string }>(
        post(),
        mock.reply,
        { name: 123 },
        'test.RenameItem',
      )

      expect(result.ok).toBe(false)
      if (result.ok) return
      expect(result.error.name).toBe('SchemaException')
    })

    it('returns SchemaException on missing required field', () => {
      const planner = new CommandPlanner(singleVersionDef(), IDENTITY_EXTRACTOR)
      const mock = mockReply()

      const result = planner.parse<{ name: string }>(post(), mock.reply, {}, 'test.RenameItem')

      expect(result.ok).toBe(false)
      if (result.ok) return
      const details = result.error.details
      if (!details) return
      expect(details.length).toBeGreaterThan(0)
      expect(details[0]?.path).toBe('name')
    })

    it('returns { kind: "replied" } on 406 (unsupported profile)', () => {
      const planner = new CommandPlanner(singleVersionDef(), IDENTITY_EXTRACTOR)
      const mock = mockReply()

      const result = planner.parse<{ name: string }>(
        post({ 'content-profile': 'urn:command:test.RenameItem:99.0.0' }),
        mock.reply,
        { name: 'test' },
        'test.RenameItem',
      )

      expect(result.ok, prettyErrorResult(result)).toBe(true)
      if (!result.ok) return
      expect(result.value.kind).toBe('replied')
      expect(mock.getStatus()).toBe(406)
    })
  })

  describe('validate — multi-version with adapters', () => {
    it('uses latest version when no profile header is present', () => {
      const planner = new CommandPlanner(multiVersionDef(), IDENTITY_EXTRACTOR)
      const mock = mockReply()

      const result = planner.parse<{ name: string; reason?: string }>(
        post(),
        mock.reply,
        { name: 'test' },
        'test.RenameItem',
      )

      expect(result.ok, prettyErrorResult(result)).toBe(true)
      if (!result.ok) return
      expect(result.value.kind).toBe('validated')
      if (result.value.kind !== 'validated') return
      expect(result.value.value).toEqual({ name: 'test' })
      expect(result.value.urn).toBe('urn:command:test.RenameItem:2.0.0')
    })

    it('cascades adapter when old version is requested', () => {
      const planner = new CommandPlanner(multiVersionDef(), IDENTITY_EXTRACTOR)
      const mock = mockReply()

      const result = planner.parse<{ name: string; reason?: string }>(
        post({ 'content-profile': 'urn:command:test.RenameItem:1.0.0' }),
        mock.reply,
        { name: 'old-data' },
        'test.RenameItem',
      )

      expect(result.ok, prettyErrorResult(result)).toBe(true)
      if (!result.ok) return
      expect(result.value.kind).toBe('validated')
      if (result.value.kind !== 'validated') return
      // Adapter should have added reason field
      expect(result.value.value).toEqual({ name: 'old-data', reason: 'migrated from v1' })
      // URN reflects the version the client sent
      expect(result.value.urn).toBe('urn:command:test.RenameItem:1.0.0')
    })

    it('skips adapter when latest version is requested directly', () => {
      const planner = new CommandPlanner(multiVersionDef(), IDENTITY_EXTRACTOR)
      const mock = mockReply()

      const result = planner.parse<{ name: string; reason?: string }>(
        post({ 'content-profile': 'urn:command:test.RenameItem:2.0.0' }),
        mock.reply,
        { name: 'new-data' },
        'test.RenameItem',
      )

      expect(result.ok, prettyErrorResult(result)).toBe(true)
      if (!result.ok) return
      expect(result.value.kind).toBe('validated')
      if (result.value.kind !== 'validated') return
      // No adapter ran, reason is absent
      expect(result.value.value).toEqual({ name: 'new-data' })
    })
  })

  describe('validate — hydration', () => {
    it('runs hydrator on validated data', () => {
      const planner = new CommandPlanner(hydrationDef(), IDENTITY_EXTRACTOR)
      const mock = mockReply()

      const result = planner.parse<{
        name: string
        revision: bigint
        metadata: { timestamp: Date }
      }>(
        post(),
        mock.reply,
        { name: 'test', revision: '42', metadata: { timestamp: '2024-01-15T00:00:00Z' } },
        'test.UpdateItem',
      )

      expect(result.ok, prettyErrorResult(result)).toBe(true)
      if (!result.ok) return
      expect(result.value.kind).toBe('validated')
      if (result.value.kind !== 'validated') return
      // Automatic int64 hydration via schema format
      expect(result.value.value.revision).toBe(42n)
      expect(result.value.value.name).toBe('test')
      // Manual hydrate callback
      expect(result.value.value.metadata.timestamp).toBeInstanceOf(Date)
    })
  })

  describe('applyHeaders', () => {
    it('sets Content-Profile, Link, and Vary headers', () => {
      const planner = new CommandPlanner(singleVersionDef(), IDENTITY_EXTRACTOR)
      const mock = mockReply()

      planner.applyHeaders(mock.reply, 'urn:command:test.RenameItem:1.0.0')

      expect(mock.getHeaders()['content-profile']).toBe('urn:command:test.RenameItem:1.0.0')
      expect(mock.getHeaders()['link']).toBe('<urn:command:test.RenameItem:1.0.0>; rel="profile"')
      expect(mock.getHeaders()['vary']).toBe('Content-Type, Content-Profile')
    })
  })

  describe('validateCommandDispatch', () => {
    it('returns validated result with stableId and data for known dispatch', () => {
      const planner = new CommandPlanner(singleVersionDef(), IDENTITY_EXTRACTOR)
      const mock = mockReply()

      const result = planner.parseCommandDispatch<{ stableId: string; data: { name: string } }>(
        post(),
        mock.reply,
        { name: 'test' },
        'rename',
      )

      expect(result.ok, prettyErrorResult(result)).toBe(true)
      if (!result.ok) return
      expect(result.value.kind).toBe('validated')
      if (result.value.kind !== 'validated') return
      expect(result.value.stableId).toBe('test.RenameItem')
      expect(result.value.data).toEqual({ name: 'test' })
    })

    it('returns SchemaException for unknown dispatch string', () => {
      const planner = new CommandPlanner(singleVersionDef(), IDENTITY_EXTRACTOR)
      const mock = mockReply()

      const result = planner.parseCommandDispatch<{ stableId: string; data: unknown }>(
        post(),
        mock.reply,
        { name: 'test' },
        'nonexistent',
      )

      expect(result.ok).toBe(false)
      if (result.ok) return
      expect(result.error.name).toBe('SchemaException')
      expect(result.error.details?.[0]?.path).toBe('command.type')
      expect(result.error.details?.[0]?.message).toContain('unknown command type')
    })

    it('returns SchemaException on validation failure', () => {
      const planner = new CommandPlanner(singleVersionDef(), IDENTITY_EXTRACTOR)
      const mock = mockReply()

      const result = planner.parseCommandDispatch<{ stableId: string; data: { name: string } }>(
        post(),
        mock.reply,
        { name: 123 },
        'rename',
      )

      expect(result.ok).toBe(false)
      if (result.ok) return
      expect(result.error.name).toBe('SchemaException')
    })

    it('runs hydrator on validated data', () => {
      const planner = new CommandPlanner(hydrationDef(), IDENTITY_EXTRACTOR)
      const mock = mockReply()

      const result = planner.parseCommandDispatch<{
        stableId: string
        data: { name: string; revision: bigint; metadata: { timestamp: Date } }
      }>(
        post(),
        mock.reply,
        { name: 'test', revision: '42', metadata: { timestamp: '2024-01-15T00:00:00Z' } },
        'update',
      )

      expect(result.ok, prettyErrorResult(result)).toBe(true)
      if (!result.ok) return
      expect(result.value.kind).toBe('validated')
      if (result.value.kind !== 'validated') return
      expect(result.value.stableId).toBe('test.UpdateItem')
      // Automatic int64 hydration via schema format
      expect(result.value.data.revision).toBe(42n)
      // Manual hydrate callback
      expect(result.value.data.metadata.timestamp).toBeInstanceOf(Date)
    })
  })
})
