import { describe, expect, it, vi } from 'vitest'
import type { AnySpec, OneMap, ResourceDescriptor } from '../include/core.js'
import { EmbedPlanner } from './EmbedPlanner.js'
import {
  BadGatewayException,
  GatewayTimeoutException,
  InternalErrorException,
  TooManyIncludesException,
} from './exceptions.js'

describe('EmbedPlanner', () => {
  describe('constructor', () => {
    it('exposes includes list from spec classNames', () => {
      const { specs } = makeSpecs()
      const planner = new EmbedPlanner(specs)
      expect(planner.includes).toEqual(['test:Item', 'test:Tag', 'test:Category'])
    })

    it('schema returns buildIncludeSchema result', () => {
      const { specs } = makeSpecs()
      const planner = new EmbedPlanner(specs)
      expect(planner.schema).toEqual({
        type: 'string',
        enum: ['test:Item', 'test:Tag', 'test:Category'],
        errorMessage: {
          enum: 'Allowed values are: [test:Item, test:Tag, test:Category].',
        },
      })
    })
  })

  describe('resolve', () => {
    it('returns Ok with empty output when no include tokens requested', async () => {
      const { specs, itemResolve } = makeSpecs()
      const planner = new EmbedPlanner(specs)
      const result = await planner.resolve(undefined, {}, undefined, undefined)
      expect(result.ok).toBe(true)
      expect(itemResolve).not.toHaveBeenCalled()
    })

    it('resolves a single root token', async () => {
      const { specs, itemResolve } = makeSpecs()
      const map: OneMap = new Map([['k1', resourceDescriptor('item-1')]])
      itemResolve.mockResolvedValue(map)

      const planner = new EmbedPlanner(specs)
      const result = await planner.resolve(
        { include: 'test:Item' },
        { 'test:Item': { keys: ['k1'] } },
        undefined,
        undefined,
      )

      expect(result.ok).toBe(true)
      if (!result.ok) return
      const output = result.value as Record<string, any>
      expect(output['test:Item'].cardinality).toBe('one')
      expect(output['test:Item'].map).toBe(map)
    })

    it('resolves multiple tokens', async () => {
      const { specs, itemResolve, categoryResolve } = makeSpecs()
      itemResolve.mockResolvedValue(new Map())
      categoryResolve.mockResolvedValue(new Map())

      const planner = new EmbedPlanner(specs)
      const result = await planner.resolve(
        { include: ['test:Item', 'test:Category'] },
        { 'test:Item': { keys: ['k1'] }, 'test:Category': { keys: ['k1'] } },
        undefined,
        undefined,
      )

      expect(result.ok).toBe(true)
      expect(itemResolve).toHaveBeenCalled()
      expect(categoryResolve).toHaveBeenCalled()
    })

    it('returns Err(TooManyIncludesException) when requested exceeds maxIncludes', async () => {
      const { specs } = makeSpecs()
      const planner = new EmbedPlanner(specs, { maxIncludes: 1 })
      const result = await planner.resolve(
        { include: ['test:Item', 'test:Category'] },
        {},
        undefined,
        undefined,
      )

      expect(result.ok).toBe(false)
      if (result.ok) return
      expect(result.error).toBeInstanceOf(TooManyIncludesException)
    })

    it('silently ignores unknown tokens', async () => {
      const { specs, itemResolve } = makeSpecs()
      itemResolve.mockResolvedValue(new Map())

      const planner = new EmbedPlanner(specs)
      const result = await planner.resolve(
        { include: ['test:Item', 'unknown:Foo'] },
        { 'test:Item': { keys: ['k1'] } },
        undefined,
        undefined,
      )

      expect(result.ok).toBe(true)
    })

    it('deduplicates repeated include tokens', async () => {
      const { specs, itemResolve } = makeSpecs()
      itemResolve.mockResolvedValue(new Map())

      const planner = new EmbedPlanner(specs)
      await planner.resolve(
        { include: ['test:Item', 'test:Item'] },
        { 'test:Item': { keys: ['k1'] } },
        undefined,
        undefined,
      )

      expect(itemResolve).toHaveBeenCalledTimes(1)
    })

    it('auto-includes parent when child is requested and parent is not skipped', async () => {
      const { specs, itemResolve, tagResolve } = makeSpecs()
      const parentMap: OneMap = new Map([['k1', resourceDescriptor('item-1')]])
      itemResolve.mockResolvedValue(parentMap)
      tagResolve.mockResolvedValue(new Map())

      const planner = new EmbedPlanner(specs, { maxIncludes: 1 })
      const result = await planner.resolve(
        { include: 'test:Tag' },
        { 'test:Item': { keys: ['k1'] } },
        undefined,
        undefined,
      )

      // Parent auto-added doesn't count against maxIncludes (only 1 requested: test:Tag)
      expect(result.ok).toBe(true)
      expect(itemResolve).toHaveBeenCalled()
      expect(tagResolve).toHaveBeenCalled()
    })

    it('does not auto-include parent when parent is in skip set', async () => {
      const { specs, itemResolve, tagResolve } = makeSpecs()
      tagResolve.mockResolvedValue(new Map())

      const planner = new EmbedPlanner(specs)
      const result = await planner.resolve({ include: 'test:Tag' }, {}, undefined, undefined, {
        skip: ['test:Item'],
        parentKeys: { 'test:Item': ['k1'] },
      })

      expect(result.ok).toBe(true)
      expect(itemResolve).not.toHaveBeenCalled()
    })

    it('marks skipped tokens with skipped: true', async () => {
      const { specs, itemResolve } = makeSpecs()
      const planner = new EmbedPlanner(specs)
      const result = await planner.resolve({ include: 'test:Item' }, {}, undefined, undefined, {
        skip: ['test:Item'],
      })

      expect(result.ok).toBe(true)
      if (!result.ok) return
      const output = result.value as Record<string, any>
      expect(output['test:Item'].cardinality).toBe('one')
      expect(output['test:Item'].skipped).toBe(true)
      expect(itemResolve).not.toHaveBeenCalled()
    })

    it('uses parentKeys from options for child with skipped parent', async () => {
      const { specs, tagResolve, itemResolve } = makeSpecs()
      tagResolve.mockResolvedValue(new Map())

      const planner = new EmbedPlanner(specs)
      await planner.resolve({ include: 'test:Tag' }, {}, undefined, undefined, {
        skip: ['test:Item'],
        parentKeys: { 'test:Item': ['id-1', 'id-2'] },
      })

      expect(itemResolve).not.toHaveBeenCalled()
      expect(tagResolve).toHaveBeenCalledWith(
        expect.objectContaining({ keys: ['id-1', 'id-2'] }),
        undefined,
        undefined,
      )
    })

    it('derives child keys from resolved parent map (phase 2)', async () => {
      const { specs, itemResolve, tagResolve } = makeSpecs()
      const parentMap: OneMap = new Map([
        ['k1', resourceDescriptor('parent-id-1')],
        ['k2', resourceDescriptor('parent-id-2')],
      ])
      itemResolve.mockResolvedValue(parentMap)
      tagResolve.mockResolvedValue(new Map())

      const planner = new EmbedPlanner(specs)
      await planner.resolve(
        { include: ['test:Item', 'test:Tag'] },
        { 'test:Item': { keys: ['k1', 'k2'] } },
        undefined,
        undefined,
      )

      expect(tagResolve).toHaveBeenCalledWith(
        expect.objectContaining({ keys: ['parent-id-1', 'parent-id-2'] }),
        undefined,
        undefined,
      )
    })

    it('does not call resolver when keys are empty', async () => {
      const { specs, itemResolve } = makeSpecs()
      const planner = new EmbedPlanner(specs)
      const result = await planner.resolve({ include: 'test:Item' }, {}, undefined, undefined)

      expect(result.ok).toBe(true)
      if (!result.ok) return
      const output = result.value as Record<string, any>
      expect(output['test:Item'].map).toBeUndefined()
      expect(itemResolve).not.toHaveBeenCalled()
    })

    it('uses explicit params keys over derived keys', async () => {
      const { specs, itemResolve, tagResolve } = makeSpecs()
      const parentMap: OneMap = new Map([['k1', resourceDescriptor('parent-id-1')]])
      itemResolve.mockResolvedValue(parentMap)
      tagResolve.mockResolvedValue(new Map())

      const planner = new EmbedPlanner(specs)
      await planner.resolve(
        { include: ['test:Item', 'test:Tag'] },
        {
          'test:Item': { keys: ['k1'] },
          'test:Tag': { keys: ['explicit-key'] },
        },
        undefined,
        undefined,
      )

      expect(tagResolve).toHaveBeenCalledWith(
        expect.objectContaining({ keys: ['explicit-key'] }),
        undefined,
        undefined,
      )
    })

    it('returns Err with InternalErrorException when resolver throws', async () => {
      const { specs, itemResolve } = makeSpecs()
      itemResolve.mockRejectedValue(new Error('db down'))

      const planner = new EmbedPlanner(specs)
      const result = await planner.resolve(
        { include: 'test:Item' },
        { 'test:Item': { keys: ['k1'] } },
        undefined,
        undefined,
      )

      expect(result.ok).toBe(false)
      if (result.ok) return
      expect(result.error).toBeInstanceOf(InternalErrorException)
    })

    it('returns Err(GatewayTimeoutException) when resolver throws ETIMEDOUT', async () => {
      const { specs, itemResolve } = makeSpecs()
      const err = Object.assign(new Error('timeout'), { code: 'ETIMEDOUT' })
      itemResolve.mockRejectedValue(err)

      const planner = new EmbedPlanner(specs)
      const result = await planner.resolve(
        { include: 'test:Item' },
        { 'test:Item': { keys: ['k1'] } },
        undefined,
        undefined,
      )

      expect(result.ok).toBe(false)
      if (result.ok) return
      expect(result.error).toBeInstanceOf(GatewayTimeoutException)
    })

    it('returns Err(BadGatewayException) when resolver throws ECONNREFUSED', async () => {
      const { specs, itemResolve } = makeSpecs()
      const err = Object.assign(new Error('refused'), { code: 'ECONNREFUSED' })
      itemResolve.mockRejectedValue(err)

      const planner = new EmbedPlanner(specs)
      const result = await planner.resolve(
        { include: 'test:Item' },
        { 'test:Item': { keys: ['k1'] } },
        undefined,
        undefined,
      )

      expect(result.ok).toBe(false)
      if (result.ok) return
      expect(result.error).toBeInstanceOf(BadGatewayException)
    })

    it('sets correct cardinality on output entries', async () => {
      const { specs, itemResolve, tagResolve } = makeSpecs()
      itemResolve.mockResolvedValue(new Map())
      tagResolve.mockResolvedValue(new Map())

      const planner = new EmbedPlanner(specs)
      const result = await planner.resolve(
        { include: ['test:Item', 'test:Tag'] },
        { 'test:Item': { keys: ['k1'] } },
        undefined,
        undefined,
      )

      expect(result.ok).toBe(true)
      if (!result.ok) return
      const output = result.value as Record<string, any>
      expect(output['test:Item'].cardinality).toBe('one')
      expect(output['test:Tag'].cardinality).toBe('many')
    })
  })
})

function resourceDescriptor(id: string): ResourceDescriptor {
  return { class: 'test:Item', properties: { id } }
}

function makeSpecs() {
  const itemResolve = vi.fn()
  const tagResolve = vi.fn()
  const categoryResolve = vi.fn()

  const itemSpec: AnySpec<unknown, unknown> = {
    className: 'test:Item',
    cardinality: 'one',
    resolve: itemResolve,
  }

  const tagSpec: AnySpec<unknown, unknown> = {
    className: 'test:Tag',
    cardinality: 'many',
    resolve: tagResolve,
    parent: { className: 'test:Item' },
  }

  const categorySpec: AnySpec<unknown, unknown> = {
    className: 'test:Category',
    cardinality: 'one',
    resolve: categoryResolve,
  }

  return {
    specs: [itemSpec, tagSpec, categorySpec] as const,
    itemResolve,
    tagResolve,
    categoryResolve,
  }
}
