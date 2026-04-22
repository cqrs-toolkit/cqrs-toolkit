import type { ServiceLink } from '@meticoeus/ddd-es'
import { describe, expect, it } from 'vitest'
import type { AggregateConfig, IdReference } from '../../types/aggregates.js'
import { ClientAggregate } from '../../types/aggregates.js'
import { createEntityRef } from '../../types/entities.js'
import type { RewriteIdEntry } from './rewrite-command.js'
import { rewriteCommandWithIdMap } from './rewrite-command.js'

const noteAggregate: AggregateConfig<ServiceLink> = new ClientAggregate<ServiceLink>({
  service: 'notes' as ServiceLink['service'],
  type: 'Note' as ServiceLink['type'],
  getStreamId: (id) => `Note-${id}`,
})

const notebookAggregate: AggregateConfig<ServiceLink> = new ClientAggregate<ServiceLink>({
  service: 'notes' as ServiceLink['service'],
  type: 'Notebook' as ServiceLink['type'],
  getStreamId: (id) => `Notebook-${id}`,
})

const fileAggregate: AggregateConfig<ServiceLink> = new ClientAggregate<ServiceLink>({
  service: 'files' as ServiceLink['service'],
  type: 'FileObject' as ServiceLink['type'],
  getStreamId: (id) => `FileObject-${id}`,
})

const ref1 = createEntityRef('tmp-1', 'cmd-1', 'temporary')
const ref2 = createEntityRef('tmp-2', 'cmd-2', 'temporary')

describe('rewriteCommandWithIdMap', () => {
  describe('DirectIdReference', () => {
    it('rewrites a scalar data path', () => {
      const refs: IdReference<ServiceLink>[] = [
        { aggregate: notebookAggregate, path: '$.data.notebookId' },
      ]
      const entries: RewriteIdEntry<ServiceLink>[] = [
        { clientId: 'tmp-1', serverId: 'server-1', aggregate: notebookAggregate },
      ]
      const result = rewriteCommandWithIdMap(
        { data: { notebookId: 'tmp-1', title: 'hello' } },
        undefined,
        entries,
        refs,
      )
      expect(result.changed).toBe(true)
      expect(result.data).toEqual({ notebookId: 'server-1', title: 'hello' })
    })

    it('rewrites a path in command.path', () => {
      const refs: IdReference<ServiceLink>[] = [
        { aggregate: notebookAggregate, path: '$.path.notebookId' },
      ]
      const entries: RewriteIdEntry<ServiceLink>[] = [
        { clientId: 'tmp-1', serverId: 'server-1', aggregate: notebookAggregate },
      ]
      const result = rewriteCommandWithIdMap(
        { data: { title: 'hello' }, path: { notebookId: 'tmp-1' } },
        undefined,
        entries,
        refs,
      )
      expect(result.changed).toBe(true)
      expect(result.path).toEqual({ notebookId: 'server-1' })
      expect(result.data).toEqual({ title: 'hello' })
    })

    it('rewrites wildcard array paths', () => {
      const refs: IdReference<ServiceLink>[] = [
        { aggregate: fileAggregate, path: '$.data.attachments[*].fileId' },
      ]
      const entries: RewriteIdEntry<ServiceLink>[] = [
        { clientId: 'tmp-1', serverId: 'server-1', aggregate: fileAggregate },
      ]
      const result = rewriteCommandWithIdMap(
        { data: { attachments: [{ fileId: 'tmp-1' }, { fileId: 'other' }] } },
        undefined,
        entries,
        refs,
      )
      expect(result.changed).toBe(true)
      expect(result.data).toEqual({
        attachments: [{ fileId: 'server-1' }, { fileId: 'other' }],
      })
    })

    it('skips when aggregate does not match', () => {
      const refs: IdReference<ServiceLink>[] = [
        { aggregate: noteAggregate, path: '$.data.notebookId' },
      ]
      const entries: RewriteIdEntry<ServiceLink>[] = [
        { clientId: 'tmp-1', serverId: 'server-1', aggregate: notebookAggregate },
      ]
      const result = rewriteCommandWithIdMap(
        { data: { notebookId: 'tmp-1' } },
        undefined,
        entries,
        refs,
      )
      expect(result.changed).toBe(false)
      expect(result.data).toEqual({ notebookId: 'tmp-1' })
    })

    it('handles EntityRef values via entityIdToString', () => {
      const refs: IdReference<ServiceLink>[] = [
        { aggregate: notebookAggregate, path: '$.data.notebookId' },
      ]
      const entries: RewriteIdEntry<ServiceLink>[] = [
        { clientId: 'tmp-1', serverId: 'server-1', aggregate: notebookAggregate },
      ]
      const result = rewriteCommandWithIdMap(
        { data: { notebookId: ref1 } },
        undefined,
        entries,
        refs,
      )
      expect(result.changed).toBe(true)
      expect(result.data).toEqual({ notebookId: 'server-1' })
    })
  })

  describe('LinkIdReference', () => {
    it('rewrites a Link field preserving service and type', () => {
      const refs: IdReference<ServiceLink>[] = [
        { aggregates: [notebookAggregate], path: '$.data.owner' },
      ]
      const entries: RewriteIdEntry<ServiceLink>[] = [
        { clientId: 'tmp-1', serverId: 'server-1', aggregate: notebookAggregate },
      ]
      const result = rewriteCommandWithIdMap(
        { data: { owner: { service: 'notes', type: 'Notebook', id: 'tmp-1' } } },
        undefined,
        entries,
        refs,
      )
      expect(result.changed).toBe(true)
      expect(result.data).toEqual({
        owner: { service: 'notes', type: 'Notebook', id: 'server-1' },
      })
    })

    it('skips when runtime Link type is a sibling, not the resolved aggregate', () => {
      const refs: IdReference<ServiceLink>[] = [
        { aggregates: [notebookAggregate, noteAggregate], path: '$.data.ref' },
      ]
      const entries: RewriteIdEntry<ServiceLink>[] = [
        { clientId: 'tmp-1', serverId: 'server-1', aggregate: notebookAggregate },
      ]
      const result = rewriteCommandWithIdMap(
        { data: { ref: { service: 'notes', type: 'Note', id: 'tmp-1' } } },
        undefined,
        entries,
        refs,
      )
      expect(result.changed).toBe(false)
    })

    it('rewrites when runtime Link type matches among union', () => {
      const refs: IdReference<ServiceLink>[] = [
        { aggregates: [notebookAggregate, noteAggregate], path: '$.data.ref' },
      ]
      const entries: RewriteIdEntry<ServiceLink>[] = [
        { clientId: 'tmp-1', serverId: 'server-1', aggregate: noteAggregate },
      ]
      const result = rewriteCommandWithIdMap(
        { data: { ref: { service: 'notes', type: 'Note', id: 'tmp-1' } } },
        undefined,
        entries,
        refs,
      )
      expect(result.changed).toBe(true)
      expect(result.data).toEqual({
        ref: { service: 'notes', type: 'Note', id: 'server-1' },
      })
    })

    it('rewrites Link with EntityRef id', () => {
      const refs: IdReference<ServiceLink>[] = [
        { aggregates: [notebookAggregate], path: '$.data.parent' },
      ]
      const entries: RewriteIdEntry<ServiceLink>[] = [
        { clientId: 'tmp-1', serverId: 'server-1', aggregate: notebookAggregate },
      ]
      const result = rewriteCommandWithIdMap(
        { data: { parent: { service: 'notes', type: 'Notebook', id: ref1 } } },
        undefined,
        entries,
        refs,
      )
      expect(result.changed).toBe(true)
      expect(result.data).toEqual({
        parent: { service: 'notes', type: 'Notebook', id: 'server-1' },
      })
    })

    it('validates ServiceLink service field', () => {
      const refs: IdReference<ServiceLink>[] = [
        { aggregates: [notebookAggregate], path: '$.data.ref' },
      ]
      const entries: RewriteIdEntry<ServiceLink>[] = [
        { clientId: 'tmp-1', serverId: 'server-1', aggregate: notebookAggregate },
      ]
      const result = rewriteCommandWithIdMap(
        { data: { ref: { service: 'WRONG', type: 'Notebook', id: 'tmp-1' } } },
        undefined,
        entries,
        refs,
      )
      expect(result.changed).toBe(false)
    })
  })

  describe('multiple references', () => {
    it('iterates multiple idReferences independently', () => {
      const refs: IdReference<ServiceLink>[] = [
        { aggregate: notebookAggregate, path: '$.data.notebookId' },
        { aggregate: noteAggregate, path: '$.data.noteId' },
      ]
      const entries: RewriteIdEntry<ServiceLink>[] = [
        { clientId: 'tmp-1', serverId: 'server-1', aggregate: notebookAggregate },
        { clientId: 'tmp-2', serverId: 'server-2', aggregate: noteAggregate },
      ]
      const result = rewriteCommandWithIdMap(
        { data: { notebookId: 'tmp-1', noteId: 'tmp-2' } },
        undefined,
        entries,
        refs,
      )
      expect(result.changed).toBe(true)
      expect(result.data).toEqual({ notebookId: 'server-1', noteId: 'server-2' })
    })
  })

  describe('commandIdPaths pruning', () => {
    it('prunes resolved entries from commandIdPaths', () => {
      const refs: IdReference<ServiceLink>[] = [
        { aggregate: notebookAggregate, path: '$.data.notebookId' },
      ]
      const entries: RewriteIdEntry<ServiceLink>[] = [
        { clientId: 'tmp-1', serverId: 'server-1', aggregate: notebookAggregate },
      ]
      const paths = {
        '$.data.notebookId': ref1,
        '$.data.other': ref2,
      }
      const result = rewriteCommandWithIdMap(
        { data: { notebookId: 'tmp-1', other: ref2 } },
        paths,
        entries,
        refs,
      )
      expect(result.commandIdPaths).toEqual({ '$.data.other': ref2 })
    })

    it('returns undefined when all entries are pruned', () => {
      const refs: IdReference<ServiceLink>[] = [
        { aggregate: notebookAggregate, path: '$.data.notebookId' },
      ]
      const entries: RewriteIdEntry<ServiceLink>[] = [
        { clientId: 'tmp-1', serverId: 'server-1', aggregate: notebookAggregate },
      ]
      const paths = { '$.data.notebookId': ref1 }
      const result = rewriteCommandWithIdMap(
        { data: { notebookId: 'tmp-1' } },
        paths,
        entries,
        refs,
      )
      expect(result.commandIdPaths).toBeUndefined()
    })

    it('does not prune when command was not changed', () => {
      const refs: IdReference<ServiceLink>[] = [{ aggregate: noteAggregate, path: '$.data.noteId' }]
      const entries: RewriteIdEntry<ServiceLink>[] = [
        { clientId: 'tmp-1', serverId: 'server-1', aggregate: notebookAggregate },
      ]
      const paths = { '$.data.notebookId': ref1 }
      const result = rewriteCommandWithIdMap({ data: { noteId: 'no-match' } }, paths, entries, refs)
      expect(result.changed).toBe(false)
      expect(result.commandIdPaths).toBe(paths)
    })
  })

  describe('edge cases', () => {
    it('returns unchanged when entries is empty', () => {
      const refs: IdReference<ServiceLink>[] = [
        { aggregate: notebookAggregate, path: '$.data.notebookId' },
      ]
      const result = rewriteCommandWithIdMap({ data: { notebookId: 'tmp-1' } }, undefined, [], refs)
      expect(result.changed).toBe(false)
    })

    it('returns unchanged when idReferences is empty', () => {
      const entries: RewriteIdEntry<ServiceLink>[] = [
        { clientId: 'tmp-1', serverId: 'server-1', aggregate: notebookAggregate },
      ]
      const result = rewriteCommandWithIdMap(
        { data: { notebookId: 'tmp-1' } },
        undefined,
        entries,
        [],
      )
      expect(result.changed).toBe(false)
    })

    it('handles missing path field', () => {
      const refs: IdReference<ServiceLink>[] = [{ aggregate: notebookAggregate, path: '$.path.id' }]
      const entries: RewriteIdEntry<ServiceLink>[] = [
        { clientId: 'tmp-1', serverId: 'server-1', aggregate: notebookAggregate },
      ]
      const result = rewriteCommandWithIdMap({ data: {} }, undefined, entries, refs)
      expect(result.changed).toBe(false)
    })
  })
})
