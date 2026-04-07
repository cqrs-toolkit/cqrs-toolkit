import type { Result } from '@meticoeus/ddd-es'
import assert from 'node:assert'
import { describe, expect, it } from 'vitest'
import type { DiscoveredCommand, DiscoveredRepresentation } from './apidoc-discovery.js'
import {
  type ParseValidationException,
  type UpdateOp,
  overrideClientSection,
  updateConfigCommands,
  updateConfigRepresentations,
} from './init-writer.js'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Shorthand: when all = latest (single version per stableId). */
function updateCommands(source: string, latest: DiscoveredCommand[]) {
  return updateConfigCommands(source, latest, latest)
}

function cmd(stableId: string, version: string): DiscoveredCommand {
  return {
    urn: `urn:command:${stableId}:${version}`,
    stableId,
    version,
  }
}

/** Wrap a commands array fixture in a full valid config file. */
function config(commandsBlock: string): string {
  return `import { defineConfig } from '@cqrs-toolkit/hypermedia-cli/config'

export default defineConfig({
  client: {
    server: 'http://localhost:3002',
    apidocPath: '/api/meta/apidoc',

    ${commandsBlock},

    representations: [],
  },
})
`
}

/** Same as config() but without representations (for missing-property tests). */
function configNoReps(body: string): string {
  return `import { defineConfig } from '@cqrs-toolkit/hypermedia-cli/config'

export default defineConfig({
  client: {
    server: 'http://localhost:3002',
    apidocPath: '/api/meta/apidoc',
${body}  },
})
`
}

function unwrap(result: Result<UpdateOp, ParseValidationException>): UpdateOp {
  assert(result.ok, 'Expected Ok result')
  return result.value
}

function unwrapUpdated(
  result: Result<UpdateOp, ParseValidationException>,
): Extract<UpdateOp, { kind: 'updated' }> {
  const op = unwrap(result)
  expect(op.kind).toBe('updated')
  return op as Extract<UpdateOp, { kind: 'updated' }>
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('updateConfigCommands', () => {
  // =========================================================================
  // Comma style variants
  // =========================================================================

  describe('comma style variants', () => {
    it('trailing comma, middle element removed', () => {
      const source = config(`commands: [
    'urn:command:demo.A:1.0.0',
    'urn:command:demo.B:1.0.0',
    'urn:command:demo.C:1.0.0',
  ]`)
      const result = updateCommands(source, [cmd('demo.A', '1.0.0'), cmd('demo.C', '1.0.0')])
      const op = unwrapUpdated(result)
      expect(op.removed).toEqual(['urn:command:demo.B:1.0.0'])
      expect(op.updatedSource).toContain("'urn:command:demo.A:1.0.0'")
      expect(op.updatedSource).toContain("'urn:command:demo.C:1.0.0'")
      expect(op.updatedSource).not.toContain('demo.B')
      // No blank line where B was
      expect(op.updatedSource).not.toMatch(/\n\s*\n\s*\n/)
    })

    it('trailing comma, last element removed', () => {
      const source = config(`commands: [
    'urn:command:demo.A:1.0.0',
    'urn:command:demo.B:1.0.0',
  ]`)
      const result = updateCommands(source, [cmd('demo.A', '1.0.0')])
      const op = unwrapUpdated(result)
      expect(op.removed).toEqual(['urn:command:demo.B:1.0.0'])
      expect(op.updatedSource).toContain("'urn:command:demo.A:1.0.0'")
      expect(op.updatedSource).not.toContain('demo.B')
    })

    it('no trailing comma on last element, last element removed', () => {
      const source = config(`commands: [
    'urn:command:demo.A:1.0.0',
    'urn:command:demo.B:1.0.0'
  ]`)
      const result = updateCommands(source, [cmd('demo.A', '1.0.0')])
      const op = unwrapUpdated(result)
      expect(op.removed).toEqual(['urn:command:demo.B:1.0.0'])
      expect(op.updatedSource).toContain("'urn:command:demo.A:1.0.0'")
      expect(op.updatedSource).not.toContain('demo.B')
    })

    it('leading-comma style, middle element removed', () => {
      const source = config(`commands: [
    'urn:command:demo.A:1.0.0'
  , 'urn:command:demo.B:1.0.0'
  , 'urn:command:demo.C:1.0.0'
  ]`)
      const result = updateCommands(source, [cmd('demo.A', '1.0.0'), cmd('demo.C', '1.0.0')])
      const op = unwrapUpdated(result)
      expect(op.removed).toEqual(['urn:command:demo.B:1.0.0'])
      expect(op.updatedSource).toContain("'urn:command:demo.A:1.0.0'")
      expect(op.updatedSource).toContain("'urn:command:demo.C:1.0.0'")
      expect(op.updatedSource).not.toContain('demo.B')
    })

    it('leading-comma style, first element removed', () => {
      const source = config(`commands: [
    'urn:command:demo.A:1.0.0'
  , 'urn:command:demo.B:1.0.0'
  , 'urn:command:demo.C:1.0.0'
  ]`)
      const result = updateCommands(source, [cmd('demo.B', '1.0.0'), cmd('demo.C', '1.0.0')])
      const op = unwrapUpdated(result)
      expect(op.removed).toEqual(['urn:command:demo.A:1.0.0'])
      expect(op.updatedSource).toContain("'urn:command:demo.B:1.0.0'")
      expect(op.updatedSource).toContain("'urn:command:demo.C:1.0.0'")
      expect(op.updatedSource).not.toContain('demo.A')
    })
  })

  // =========================================================================
  // Array structure variants
  // =========================================================================

  describe('array structure variants', () => {
    it('empty array, new commands discovered', () => {
      const source = config('commands: []')
      const result = updateCommands(source, [cmd('demo.A', '1.0.0'), cmd('demo.B', '1.0.0')])
      const op = unwrapUpdated(result)
      expect(op.added).toEqual(['urn:command:demo.A:1.0.0', 'urn:command:demo.B:1.0.0'])
      expect(op.updatedSource).toContain("'urn:command:demo.A:1.0.0'")
      expect(op.updatedSource).toContain("'urn:command:demo.B:1.0.0'")
    })

    it('single-line array, element removed leaving empty', () => {
      const source = config("commands: ['urn:command:demo.A:1.0.0']")
      const result = updateCommands(source, [])
      const op = unwrapUpdated(result)
      expect(op.removed).toEqual(['urn:command:demo.A:1.0.0'])
      expect(op.updatedSource).not.toContain('demo.A')
      // Must still have a commands property with an array
      expect(op.updatedSource).toMatch(/commands:\s*\[/)
    })

    it('single-line array, element updated in place', () => {
      const source = config("commands: ['urn:command:demo.A:1.0.0']")
      const all = [cmd('demo.A', '1.0.0'), cmd('demo.A', '1.1.0')]
      const latest = [cmd('demo.A', '1.1.0')]
      const result = updateConfigCommands(source, all, latest)
      const op = unwrapUpdated(result)
      expect(op.updated).toEqual([
        { from: 'urn:command:demo.A:1.0.0', to: 'urn:command:demo.A:1.1.0' },
      ])
      expect(op.updatedSource).toContain("'urn:command:demo.A:1.1.0'")
      expect(op.updatedSource).not.toContain('1.0.0')
      // Surrounding characters untouched — still on one line
      expect(op.updatedSource).toMatch(/commands: \['urn:command:demo\.A:1\.1\.0'\]/)
    })

    it('single-element array, insert after existing', () => {
      const source = config("commands: ['urn:command:demo.A:1.0.0']")
      const result = updateCommands(source, [cmd('demo.A', '1.0.0'), cmd('demo.B', '1.0.0')])
      const op = unwrapUpdated(result)
      expect(op.added).toEqual(['urn:command:demo.B:1.0.0'])
      expect(op.updatedSource).toContain("'urn:command:demo.A:1.0.0'")
      expect(op.updatedSource).toContain("'urn:command:demo.B:1.0.0'")
      const aIdx = op.updatedSource.indexOf('demo.A')
      const bIdx = op.updatedSource.indexOf('demo.B')
      expect(aIdx).toBeLessThan(bIdx)
    })

    it('single-element array, insert before existing', () => {
      const source = config("commands: ['urn:command:demo.B:1.0.0']")
      const result = updateCommands(source, [cmd('demo.A', '1.0.0'), cmd('demo.B', '1.0.0')])
      const op = unwrapUpdated(result)
      expect(op.added).toEqual(['urn:command:demo.A:1.0.0'])
      expect(op.updatedSource).toContain("'urn:command:demo.A:1.0.0'")
      expect(op.updatedSource).toContain("'urn:command:demo.B:1.0.0'")
      const aIdx = op.updatedSource.indexOf('demo.A')
      const bIdx = op.updatedSource.indexOf('demo.B')
      expect(aIdx).toBeLessThan(bIdx)
    })

    it('entry and ] on same line, new entries inserted', () => {
      const source = config(`commands: [
    'urn:command:demo.A:1.0.0',  ]`)
      const result = updateCommands(source, [
        cmd('demo.A', '1.0.0'),
        cmd('demo.B', '1.0.0'),
        cmd('demo.C', '1.0.0'),
      ])
      const op = unwrapUpdated(result)
      expect(op.added).toEqual(['urn:command:demo.B:1.0.0', 'urn:command:demo.C:1.0.0'])
      expect(op.updatedSource).toContain("'urn:command:demo.A:1.0.0'")
      expect(op.updatedSource).toContain("'urn:command:demo.B:1.0.0'")
      expect(op.updatedSource).toContain("'urn:command:demo.C:1.0.0'")
    })
  })

  // =========================================================================
  // Object entry variants
  // =========================================================================

  describe('object entry variants', () => {
    it('object entry, URN updated in place', () => {
      const source = config(`commands: [
    { urn: 'urn:command:demo.A:1.0.0', extractEnvelope: myExtractor },
  ]`)
      const all = [cmd('demo.A', '1.0.0'), cmd('demo.A', '1.1.0')]
      const latest = [cmd('demo.A', '1.1.0')]
      const result = updateConfigCommands(source, all, latest)
      const op = unwrapUpdated(result)
      expect(op.updated).toEqual([
        { from: 'urn:command:demo.A:1.0.0', to: 'urn:command:demo.A:1.1.0' },
      ])
      expect(op.updatedSource).toContain("'urn:command:demo.A:1.1.0'")
      expect(op.updatedSource).toContain('extractEnvelope: myExtractor')
    })

    it('object entry, removed', () => {
      const source = config(`commands: [
    'urn:command:demo.A:1.0.0',
    { urn: 'urn:command:demo.B:1.0.0', extractEnvelope: myExtractor },
    'urn:command:demo.C:1.0.0',
  ]`)
      const result = updateCommands(source, [cmd('demo.A', '1.0.0'), cmd('demo.C', '1.0.0')])
      const op = unwrapUpdated(result)
      expect(op.removed).toEqual(['urn:command:demo.B:1.0.0'])
      expect(op.updatedSource).toContain("'urn:command:demo.A:1.0.0'")
      expect(op.updatedSource).toContain("'urn:command:demo.C:1.0.0'")
      expect(op.updatedSource).not.toContain('demo.B')
      expect(op.updatedSource).not.toContain('extractEnvelope')
    })

    it('mixed string and object entries, multiple operations', () => {
      const source = config(`commands: [
    'urn:command:demo.A:1.0.0',
    { urn: 'urn:command:demo.B:1.0.0', extractEnvelope: myExtractor },
    'urn:command:demo.C:1.0.0',
  ]`)
      const all = [
        cmd('demo.A', '1.0.0'),
        cmd('demo.A', '1.1.0'),
        cmd('demo.B', '1.0.0'),
        cmd('demo.C', '1.0.0'),
        cmd('demo.D', '1.0.0'),
      ]
      const latest = [cmd('demo.A', '1.1.0'), cmd('demo.C', '1.0.0'), cmd('demo.D', '1.0.0')]
      const result = updateConfigCommands(source, all, latest)
      const op = unwrapUpdated(result)
      expect(op.updated).toEqual([
        { from: 'urn:command:demo.A:1.0.0', to: 'urn:command:demo.A:1.1.0' },
      ])
      expect(op.removed).toEqual(['urn:command:demo.B:1.0.0'])
      expect(op.added).toEqual(['urn:command:demo.D:1.0.0'])
      expect(op.updatedSource).toContain("'urn:command:demo.A:1.1.0'")
      expect(op.updatedSource).not.toContain('demo.B')
      expect(op.updatedSource).not.toContain('extractEnvelope')
      expect(op.updatedSource).toContain("'urn:command:demo.C:1.0.0'")
      expect(op.updatedSource).toContain("'urn:command:demo.D:1.0.0'")
    })
  })

  // =========================================================================
  // Insertion order
  // =========================================================================

  describe('insertion order', () => {
    it('new entry belongs between two existing entries', () => {
      const source = config(`commands: [
    'urn:command:demo.A:1.0.0',
    'urn:command:demo.C:1.0.0',
  ]`)
      const result = updateCommands(source, [
        cmd('demo.A', '1.0.0'),
        cmd('demo.B', '1.0.0'),
        cmd('demo.C', '1.0.0'),
      ])
      const op = unwrapUpdated(result)
      expect(op.added).toEqual(['urn:command:demo.B:1.0.0'])
      const aIdx = op.updatedSource.indexOf('demo.A')
      const bIdx = op.updatedSource.indexOf('demo.B')
      const cIdx = op.updatedSource.indexOf('demo.C')
      expect(aIdx).toBeLessThan(bIdx)
      expect(bIdx).toBeLessThan(cIdx)
    })

    it('new entry belongs before all existing entries', () => {
      const source = config(`commands: [
    'urn:command:demo.B:1.0.0',
    'urn:command:demo.C:1.0.0',
  ]`)
      const result = updateCommands(source, [
        cmd('demo.A', '1.0.0'),
        cmd('demo.B', '1.0.0'),
        cmd('demo.C', '1.0.0'),
      ])
      const op = unwrapUpdated(result)
      expect(op.added).toEqual(['urn:command:demo.A:1.0.0'])
      const aIdx = op.updatedSource.indexOf('demo.A')
      const bIdx = op.updatedSource.indexOf('demo.B')
      expect(aIdx).toBeLessThan(bIdx)
    })

    it('new entry belongs after all existing entries', () => {
      const source = config(`commands: [
    'urn:command:demo.A:1.0.0',
    'urn:command:demo.B:1.0.0',
  ]`)
      const result = updateCommands(source, [
        cmd('demo.A', '1.0.0'),
        cmd('demo.B', '1.0.0'),
        cmd('demo.C', '1.0.0'),
      ])
      const op = unwrapUpdated(result)
      expect(op.added).toEqual(['urn:command:demo.C:1.0.0'])
      const bIdx = op.updatedSource.indexOf('demo.B')
      const cIdx = op.updatedSource.indexOf('demo.C')
      expect(bIdx).toBeLessThan(cIdx)
    })

    it('multiple new entries, all interleaved', () => {
      const source = config(`commands: [
    'urn:command:demo.A:1.0.0',
    'urn:command:demo.C:1.0.0',
    'urn:command:demo.E:1.0.0',
  ]`)
      const result = updateCommands(source, [
        cmd('demo.A', '1.0.0'),
        cmd('demo.B', '1.0.0'),
        cmd('demo.C', '1.0.0'),
        cmd('demo.D', '1.0.0'),
        cmd('demo.E', '1.0.0'),
      ])
      const op = unwrapUpdated(result)
      expect(op.added).toEqual(['urn:command:demo.B:1.0.0', 'urn:command:demo.D:1.0.0'])
      const aIdx = op.updatedSource.indexOf('demo.A')
      const bIdx = op.updatedSource.indexOf('demo.B')
      const cIdx = op.updatedSource.indexOf('demo.C')
      const dIdx = op.updatedSource.indexOf('demo.D')
      const eIdx = op.updatedSource.indexOf('demo.E')
      expect(aIdx).toBeLessThan(bIdx)
      expect(bIdx).toBeLessThan(cIdx)
      expect(cIdx).toBeLessThan(dIdx)
      expect(dIdx).toBeLessThan(eIdx)
    })
  })

  // =========================================================================
  // Missing commands property
  // =========================================================================

  describe('missing commands property', () => {
    it('representations present, commands absent', () => {
      const source = `import { defineConfig } from '@cqrs-toolkit/hypermedia-cli/config'

export default defineConfig({
  client: {
    server: 'http://localhost:3002',
    apidocPath: '/api/meta/apidoc',

    representations: ['#demo-todo-v1_0_0'],
  },
})
`
      const result = updateCommands(source, [cmd('demo.A', '1.0.0'), cmd('demo.B', '1.0.0')])
      const op = unwrapUpdated(result)
      expect(op.added).toHaveLength(2)
      const commandsIdx = op.updatedSource.indexOf('commands:')
      const repsIdx = op.updatedSource.indexOf('representations:')
      expect(commandsIdx).toBeGreaterThan(-1)
      expect(commandsIdx).toBeLessThan(repsIdx)
    })

    it('neither commands nor representations present', () => {
      const source = configNoReps(`  server: 'http://localhost:3002',
  apidocPath: '/api/meta/apidoc',
`)
      const result = updateCommands(source, [cmd('demo.A', '1.0.0')])
      const op = unwrapUpdated(result)
      expect(op.added).toEqual(['urn:command:demo.A:1.0.0'])
      expect(op.updatedSource).toContain('commands:')
      expect(op.updatedSource).toContain("'urn:command:demo.A:1.0.0'")
    })
  })

  // =========================================================================
  // User annotations preserved
  // =========================================================================

  describe('user annotations preserved', () => {
    it('comment above an entry that is updated', () => {
      const source = config(`commands: [
    // primary create command
    'urn:command:demo.A:1.0.0',
    'urn:command:demo.B:1.0.0',
  ]`)
      const all = [cmd('demo.A', '1.0.0'), cmd('demo.A', '1.1.0'), cmd('demo.B', '1.0.0')]
      const latest = [cmd('demo.A', '1.1.0'), cmd('demo.B', '1.0.0')]
      const result = updateConfigCommands(source, all, latest)
      const op = unwrapUpdated(result)
      expect(op.updatedSource).toContain('// primary create command')
      expect(op.updatedSource).toContain("'urn:command:demo.A:1.1.0'")
    })

    it('comment above an entry that is removed', () => {
      const source = config(`commands: [
    'urn:command:demo.A:1.0.0',
    // legacy command, kept for now
    'urn:command:demo.B:1.0.0',
    'urn:command:demo.C:1.0.0',
  ]`)
      const result = updateCommands(source, [cmd('demo.A', '1.0.0'), cmd('demo.C', '1.0.0')])
      const op = unwrapUpdated(result)
      expect(op.updatedSource).not.toContain('demo.B')
      // Comment is left in place — it's the user's annotation, not our concern
      expect(op.updatedSource).toContain('// legacy command, kept for now')
      expect(op.updatedSource).toContain("'urn:command:demo.A:1.0.0'")
      expect(op.updatedSource).toContain("'urn:command:demo.C:1.0.0'")
    })
  })

  // =========================================================================
  // Bail cases
  // =========================================================================

  describe('bail cases', () => {
    it('array contains a variable reference (spread)', () => {
      const source = config(`commands: [
    'urn:command:demo.A:1.0.0',
    ...extraCommands,
  ]`)
      const result = updateCommands(source, [cmd('demo.A', '1.0.0')])
      expect(unwrap(result).kind).toBe('bail')
    })

    it('array contains a computed expression', () => {
      const source = config(`commands: [
    'urn:command:demo.A:1.0.0',
    getCommand('demo.B'),
  ]`)
      const result = updateCommands(source, [cmd('demo.A', '1.0.0')])
      expect(unwrap(result).kind).toBe('bail')
    })

    it('commands value is not an array', () => {
      const source = config('commands: getCommands()')
      const result = updateCommands(source, [cmd('demo.A', '1.0.0')])
      expect(unwrap(result).kind).toBe('bail')
    })
  })

  // =========================================================================
  // No-op case
  // =========================================================================

  describe('no-op', () => {
    it('returns no-change when config already matches', () => {
      const source = config(`commands: [
    'urn:command:demo.A:1.0.0',
    'urn:command:demo.B:1.0.0',
    'urn:command:demo.C:1.0.0',
  ]`)
      const result = updateCommands(source, [
        cmd('demo.A', '1.0.0'),
        cmd('demo.B', '1.0.0'),
        cmd('demo.C', '1.0.0'),
      ])
      expect(unwrap(result).kind).toBe('no-change')
    })
  })

  // =========================================================================
  // String literal content safety
  // =========================================================================

  describe('string literal content safety', () => {
    it('URN containing a comma does not confuse comma-finding logic', () => {
      const source = config(`commands: [
    'urn:command:demo.A,B:1.0.0',
    'urn:command:demo.C:1.0.0',
  ]`)
      // Remove A,B — the comma inside the string must not confuse the token stream
      const result = updateCommands(source, [cmd('demo.C', '1.0.0')])
      const op = unwrapUpdated(result)
      expect(op.removed).toEqual(['urn:command:demo.A,B:1.0.0'])
      expect(op.updatedSource).not.toContain('demo.A,B')
      expect(op.updatedSource).toContain("'urn:command:demo.C:1.0.0'")
    })
  })
})

// ===========================================================================
// updateConfigRepresentations
// ===========================================================================

function rep(className: string, id: string, version: string): DiscoveredRepresentation {
  return { id, className, version }
}

/** Wrap a representations array fixture in a full valid config file. */
function repConfig(representationsBlock: string): string {
  return `import { defineConfig } from '@cqrs-toolkit/hypermedia-cli/config'

export default defineConfig({
  client: {
    server: 'http://localhost:3002',
    apidocPath: '/api/meta/apidoc',

    commands: [],

    ${representationsBlock},
  },
})
`
}

function repConfigNoCommands(body: string): string {
  return `import { defineConfig } from '@cqrs-toolkit/hypermedia-cli/config'

export default defineConfig({
  client: {
    server: 'http://localhost:3002',
    apidocPath: '/api/meta/apidoc',
${body}  },
})
`
}

describe('updateConfigRepresentations', () => {
  const ALL_REPS: DiscoveredRepresentation[] = [
    rep('demo:Todo', '#demo-todo-v1_0_0', '1.0.0'),
    rep('demo:Note', '#demo-note-v1_0_0', '1.0.0'),
    rep('demo:Notebook', '#demo-notebook-v1_0_0', '1.0.0'),
  ]
  // latestRepresentations is the same as ALL_REPS when there's one version per class
  const LATEST_REPS = ALL_REPS

  describe('no-change', () => {
    it('returns no-change when all representations are present', () => {
      const source = repConfig(`representations: [
    '#demo-todo-v1_0_0',
    '#demo-note-v1_0_0',
    '#demo-notebook-v1_0_0',
  ]`)
      const result = updateConfigRepresentations(source, ALL_REPS, LATEST_REPS)
      expect(unwrap(result).kind).toBe('no-change')
    })
  })

  describe('additions', () => {
    it('adds new representations', () => {
      const source = repConfig(`representations: [
    '#demo-todo-v1_0_0',
  ]`)
      const result = updateConfigRepresentations(source, ALL_REPS, LATEST_REPS)
      const op = unwrapUpdated(result)
      expect(op.added).toEqual(['#demo-note-v1_0_0', '#demo-notebook-v1_0_0'])
      expect(op.updatedSource).toContain("'#demo-todo-v1_0_0'")
      expect(op.updatedSource).toContain("'#demo-note-v1_0_0'")
      expect(op.updatedSource).toContain("'#demo-notebook-v1_0_0'")
    })

    it('entry and ] on same line, new entries inserted', () => {
      const source = repConfig(`representations: [
    '#demo-todo-v1_0_0',  ]`)
      const result = updateConfigRepresentations(source, ALL_REPS, LATEST_REPS)
      const op = unwrapUpdated(result)
      expect(op.added).toEqual(['#demo-note-v1_0_0', '#demo-notebook-v1_0_0'])
      expect(op.updatedSource).toContain("'#demo-todo-v1_0_0'")
      expect(op.updatedSource).toContain("'#demo-note-v1_0_0'")
      expect(op.updatedSource).toContain("'#demo-notebook-v1_0_0'")
    })

    it('single-element array, insert after existing', () => {
      const all = [rep('demo:Todo', '#todo-v1', '1.0.0'), rep('demo:Note', '#note-v1', '1.0.0')]
      const latest = all
      const source = repConfig("representations: ['#todo-v1']")
      const result = updateConfigRepresentations(source, all, latest)
      const op = unwrapUpdated(result)
      expect(op.added).toEqual(['#note-v1'])
      expect(op.updatedSource).toContain("'#todo-v1'")
      expect(op.updatedSource).toContain("'#note-v1'")
      const todoIdx = op.updatedSource.indexOf('#todo-v1')
      const noteIdx = op.updatedSource.indexOf('#note-v1')
      expect(todoIdx).toBeLessThan(noteIdx)
    })

    it('no trailing comma, multiple entries inserted after same predecessor', () => {
      const source = repConfig(`representations: [
    '#demo-todo-v1_0_0'
  ]`)
      const result = updateConfigRepresentations(source, ALL_REPS, LATEST_REPS)
      const op = unwrapUpdated(result)
      expect(op.added).toEqual(['#demo-note-v1_0_0', '#demo-notebook-v1_0_0'])
      // Must not produce double commas
      expect(op.updatedSource).not.toContain(',,')
      expect(op.updatedSource).toContain("'#demo-todo-v1_0_0'")
      expect(op.updatedSource).toContain("'#demo-note-v1_0_0'")
      expect(op.updatedSource).toContain("'#demo-notebook-v1_0_0'")
    })

    it('single-element array, insert before existing', () => {
      const all = [rep('demo:Todo', '#todo-v1', '1.0.0'), rep('demo:Note', '#note-v1', '1.0.0')]
      const latest = all
      const source = repConfig("representations: ['#note-v1']")
      const result = updateConfigRepresentations(source, all, latest)
      const op = unwrapUpdated(result)
      expect(op.added).toEqual(['#todo-v1'])
      expect(op.updatedSource).toContain("'#todo-v1'")
      expect(op.updatedSource).toContain("'#note-v1'")
      const todoIdx = op.updatedSource.indexOf('#todo-v1')
      const noteIdx = op.updatedSource.indexOf('#note-v1')
      expect(todoIdx).toBeLessThan(noteIdx)
    })
  })

  describe('removals', () => {
    it('removes representations no longer in apidoc', () => {
      const source = repConfig(`representations: [
    '#demo-todo-v1_0_0',
    '#demo-old-v1_0_0',
    '#demo-note-v1_0_0',
    '#demo-notebook-v1_0_0',
  ]`)
      const result = updateConfigRepresentations(source, ALL_REPS, LATEST_REPS)
      const op = unwrapUpdated(result)
      expect(op.removed).toEqual(['#demo-old-v1_0_0'])
      expect(op.updatedSource).not.toContain('demo-old')
    })
  })

  describe('version updates', () => {
    it('updates representation id when a newer version exists for the same class', () => {
      // Config has v1, apidoc has v1 and v2, latest is v2
      const allReps: DiscoveredRepresentation[] = [
        rep('demo:Todo', '#demo-todo-v1_0_0', '1.0.0'),
        rep('demo:Todo', '#demo-todo-v2_0_0', '2.0.0'),
        rep('demo:Note', '#demo-note-v1_0_0', '1.0.0'),
      ]
      const latestReps: DiscoveredRepresentation[] = [
        rep('demo:Todo', '#demo-todo-v2_0_0', '2.0.0'),
        rep('demo:Note', '#demo-note-v1_0_0', '1.0.0'),
      ]
      const source = repConfig(`representations: [
    '#demo-todo-v1_0_0',
    '#demo-note-v1_0_0',
  ]`)
      const result = updateConfigRepresentations(source, allReps, latestReps)
      const op = unwrapUpdated(result)
      expect(op.updated).toEqual([{ from: '#demo-todo-v1_0_0', to: '#demo-todo-v2_0_0' }])
      expect(op.updatedSource).toContain("'#demo-todo-v2_0_0'")
      expect(op.updatedSource).not.toContain('#demo-todo-v1_0_0')
      expect(op.updatedSource).toContain("'#demo-note-v1_0_0'")
    })
  })

  describe('combined operations', () => {
    it('handles add + remove + update in one pass', () => {
      const allReps: DiscoveredRepresentation[] = [
        rep('demo:Todo', '#demo-todo-v1_0_0', '1.0.0'),
        rep('demo:Todo', '#demo-todo-v2_0_0', '2.0.0'),
        rep('demo:Note', '#demo-note-v1_0_0', '1.0.0'),
        rep('demo:Notebook', '#demo-notebook-v1_0_0', '1.0.0'),
      ]
      const latestReps: DiscoveredRepresentation[] = [
        rep('demo:Todo', '#demo-todo-v2_0_0', '2.0.0'),
        rep('demo:Note', '#demo-note-v1_0_0', '1.0.0'),
        rep('demo:Notebook', '#demo-notebook-v1_0_0', '1.0.0'),
      ]
      const source = repConfig(`representations: [
    '#demo-todo-v1_0_0',
    '#demo-old-v1_0_0',
    '#demo-note-v1_0_0',
  ]`)
      const result = updateConfigRepresentations(source, allReps, latestReps)
      const op = unwrapUpdated(result)
      expect(op.updated).toEqual([{ from: '#demo-todo-v1_0_0', to: '#demo-todo-v2_0_0' }])
      expect(op.removed).toEqual(['#demo-old-v1_0_0'])
      expect(op.added).toEqual(['#demo-notebook-v1_0_0'])
      expect(op.updatedSource).toContain("'#demo-todo-v2_0_0'")
      expect(op.updatedSource).not.toContain('demo-old')
      expect(op.updatedSource).toContain("'#demo-notebook-v1_0_0'")
    })
  })

  describe('empty array', () => {
    it('populates an empty representations array', () => {
      const source = repConfig('representations: []')
      const result = updateConfigRepresentations(source, ALL_REPS, LATEST_REPS)
      const op = unwrapUpdated(result)
      expect(op.added).toHaveLength(3)
      expect(op.updatedSource).toContain('#demo-todo-v1_0_0')
      expect(op.updatedSource).toContain('#demo-note-v1_0_0')
      expect(op.updatedSource).toContain('#demo-notebook-v1_0_0')
    })
  })

  describe('missing property', () => {
    it('inserts representations after commands', () => {
      const source = `import { defineConfig } from '@cqrs-toolkit/hypermedia-cli/config'

export default defineConfig({
  client: {
    server: 'http://localhost:3002',
    apidocPath: '/api/meta/apidoc',

    commands: [
      'urn:command:demo.CreateTodo:1.0.0',
    ],
  },
})
`
      const result = updateConfigRepresentations(source, ALL_REPS, LATEST_REPS)
      const op = unwrapUpdated(result)
      expect(op.added).toHaveLength(3)
      const commandsIdx = op.updatedSource.indexOf('commands:')
      const repsIdx = op.updatedSource.indexOf('representations:')
      expect(repsIdx).toBeGreaterThan(commandsIdx)
    })

    it('inserts representations before closing } when commands is absent', () => {
      const source = repConfigNoCommands(`  server: 'http://localhost:3002',
  apidocPath: '/api/meta/apidoc',
`)
      const result = updateConfigRepresentations(source, ALL_REPS, LATEST_REPS)
      const op = unwrapUpdated(result)
      expect(op.added).toHaveLength(3)
      expect(op.updatedSource).toContain('representations:')
    })
  })

  describe('bail cases', () => {
    it('bails on non-string entry', () => {
      const source = repConfig(`representations: [
    '#demo-todo-v1_0_0',
    getRepresentation('demo:Note'),
  ]`)
      const result = updateConfigRepresentations(source, ALL_REPS, LATEST_REPS)
      expect(unwrap(result).kind).toBe('bail')
    })

    it('bails when value is not an array', () => {
      const source = repConfig('representations: getRepresentations()')
      const result = updateConfigRepresentations(source, ALL_REPS, LATEST_REPS)
      expect(unwrap(result).kind).toBe('bail')
    })
  })
})

// ---------------------------------------------------------------------------
// overrideClientSection
// ---------------------------------------------------------------------------

describe('overrideClientSection', () => {
  const COMMANDS = [cmd('demo.A', '1.0.0'), cmd('demo.B', '1.0.0')]
  const REPS = [rep('demo:Todo', '#demo-todo-v1_0_0', '1.0.0')]
  const OPTS: import('./init-writer.js').InitWriterOptions = {
    server: 'http://localhost:3002',
    apidocPath: '/api/meta/apidoc',
    commands: COMMANDS,
    representations: REPS,
  }

  it('overrides client section in a file with server section — server preserved', () => {
    const source = `import { defineConfig } from '@cqrs-toolkit/hypermedia-cli/config'

export default defineConfig({
  server: {
    classes: [],
    prefixes: ['nb'],
    docs: { outputDir: 'static/meta' },
    build: { outputDir: 'dist/static/meta' },
  },
  client: {
    server: 'http://old-server',
    apidocPath: '/old/path',
    commands: [],
    representations: [],
  },
})
`
    const result = overrideClientSection(source, OPTS)
    assert(result.ok, 'Expected Ok result')
    expect(result.value).toContain("server: 'http://localhost:3002'")
    expect(result.value).toContain("apidocPath: '/api/meta/apidoc'")
    expect(result.value).toContain("'urn:command:demo.A:1.0.0'")
    expect(result.value).toContain("'urn:command:demo.B:1.0.0'")
    expect(result.value).toContain("'#demo-todo-v1_0_0'")
    // Server section preserved
    expect(result.value).toContain("prefixes: ['nb']")
    expect(result.value).toContain("docs: { outputDir: 'static/meta' }")
  })

  it('overrides client section in a client-only file', () => {
    const source = `import { defineConfig } from '@cqrs-toolkit/hypermedia-cli/config'

export default defineConfig({
  client: {
    server: 'http://old-server',
    apidocPath: '/old/path',
    commands: ['urn:command:old:1.0.0'],
    representations: [],
  },
})
`
    const result = overrideClientSection(source, OPTS)
    assert(result.ok, 'Expected Ok result')
    expect(result.value).toContain("'urn:command:demo.A:1.0.0'")
    expect(result.value).not.toContain('urn:command:old:1.0.0')
  })

  it('inserts client section when only server exists', () => {
    const source = `import { defineConfig } from '@cqrs-toolkit/hypermedia-cli/config'

export default defineConfig({
  server: {
    classes: [],
    prefixes: [],
    docs: { outputDir: 'static/meta' },
    build: { outputDir: 'dist/static/meta' },
  },
})
`
    const result = overrideClientSection(source, OPTS)
    assert(result.ok, 'Expected Ok result')
    expect(result.value).toContain('client:')
    expect(result.value).toContain("'urn:command:demo.A:1.0.0'")
    // Server section preserved
    expect(result.value).toContain('server:')
    expect(result.value).toContain('prefixes: []')
  })

  it('returns error for source without defineConfig', () => {
    const source = `export default { client: {} }`
    const result = overrideClientSection(source, OPTS)
    expect(result.ok).toBe(false)
  })
})
