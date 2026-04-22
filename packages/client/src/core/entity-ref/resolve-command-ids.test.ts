import type { ServiceLink } from '@meticoeus/ddd-es'
import { describe, expect, it } from 'vitest'
import type { CommandIdMappingRecord } from '../../storage/IStorage.js'
import type { AggregateConfig, IdReference } from '../../types/aggregates.js'
import { ClientAggregate } from '../../types/aggregates.js'
import { createEntityRef } from '../../types/entities.js'
import { MockCommandIdMappingStore } from '../command-id-mapping-store/ICommandIdMappingStore.mock.js'
import { resolveCommandIds } from './resolve-command-ids.js'

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

const tmpRef = createEntityRef('tmp-1', 'cmd-1', 'temporary')
const unresolvedRef = createEntityRef('tmp-2', 'cmd-2', 'temporary')

function storeFrom(map: Record<string, string>): MockCommandIdMappingStore {
  const records: CommandIdMappingRecord[] = Object.entries(map).map(([clientId, serverId]) => ({
    clientId,
    serverId,
    createdAt: 0,
  }))
  return new MockCommandIdMappingStore(records)
}

describe('resolveCommandIds', () => {
  describe('DirectIdReference', () => {
    it('rewrites a data-side path when the client id resolves', () => {
      const refs: IdReference<ServiceLink>[] = [
        { aggregate: notebookAggregate, path: '$.data.notebookId' },
      ]
      const result = resolveCommandIds(
        { data: { notebookId: 'tmp-1', title: 'hello' } },
        refs,
        storeFrom({ 'tmp-1': 'server-1' }),
      )
      expect(result.changed).toBe(true)
      expect(result.data).toEqual({ notebookId: 'server-1', title: 'hello' })
      expect(result.commandIdPaths).toBeUndefined()
    })

    it('rewrites a path-side path when the client id resolves', () => {
      const refs: IdReference<ServiceLink>[] = [{ aggregate: noteAggregate, path: '$.path.id' }]
      const result = resolveCommandIds(
        { data: { title: 'hello' }, path: { id: 'tmp-1' } },
        refs,
        storeFrom({ 'tmp-1': 'server-1' }),
      )
      expect(result.changed).toBe(true)
      expect(result.path).toEqual({ id: 'server-1' })
      expect(result.data).toEqual({ title: 'hello' })
      expect(result.commandIdPaths).toBeUndefined()
    })

    it('unwraps EntityRef at the declared path when resolved', () => {
      const refs: IdReference<ServiceLink>[] = [
        { aggregate: notebookAggregate, path: '$.data.notebookId' },
      ]
      const result = resolveCommandIds(
        { data: { notebookId: tmpRef, title: 'hello' } },
        refs,
        storeFrom({ 'tmp-1': 'server-1' }),
      )
      expect(result.changed).toBe(true)
      expect(result.data).toEqual({ notebookId: 'server-1', title: 'hello' })
      expect(result.commandIdPaths).toBeUndefined()
    })

    it('records unresolved EntityRef in commandIdPaths', () => {
      const refs: IdReference<ServiceLink>[] = [
        { aggregate: notebookAggregate, path: '$.data.notebookId' },
      ]
      const result = resolveCommandIds(
        { data: { notebookId: unresolvedRef, title: 'hello' } },
        refs,
        storeFrom({}),
      )
      expect(result.changed).toBe(false)
      expect(result.data).toEqual({ notebookId: unresolvedRef, title: 'hello' })
      expect(result.commandIdPaths).toEqual({ '$.data.notebookId': unresolvedRef })
    })

    it('leaves a plain server-id string unchanged when no mapping exists', () => {
      const refs: IdReference<ServiceLink>[] = [{ aggregate: noteAggregate, path: '$.data.id' }]
      const result = resolveCommandIds(
        { data: { id: 'server-1', title: 'hello' } },
        refs,
        storeFrom({}),
      )
      expect(result.changed).toBe(false)
      expect(result.data).toEqual({ id: 'server-1', title: 'hello' })
      expect(result.commandIdPaths).toBeUndefined()
    })

    it('mixes resolved and unresolved references in a single pass', () => {
      const refs: IdReference<ServiceLink>[] = [
        { aggregate: notebookAggregate, path: '$.data.notebookId' },
        { aggregate: noteAggregate, path: '$.data.parentNoteId' },
      ]
      const result = resolveCommandIds(
        { data: { notebookId: tmpRef, parentNoteId: unresolvedRef, title: 'x' } },
        refs,
        storeFrom({ 'tmp-1': 'server-1' }),
      )
      expect(result.changed).toBe(true)
      expect(result.data).toEqual({
        notebookId: 'server-1',
        parentNoteId: unresolvedRef,
        title: 'x',
      })
      expect(result.commandIdPaths).toEqual({ '$.data.parentNoteId': unresolvedRef })
    })

    it('walks wildcard array paths', () => {
      const fileAggregate: AggregateConfig<ServiceLink> = new ClientAggregate<ServiceLink>({
        service: 'files' as ServiceLink['service'],
        type: 'FileObject' as ServiceLink['type'],
        getStreamId: (id) => `FileObject-${id}`,
      })
      const refs: IdReference<ServiceLink>[] = [
        { aggregate: fileAggregate, path: '$.data.attachments[*].fileId' },
      ]
      const result = resolveCommandIds(
        { data: { attachments: [{ fileId: 'tmp-1' }, { fileId: unresolvedRef }] } },
        refs,
        storeFrom({ 'tmp-1': 'server-1' }),
      )
      expect(result.changed).toBe(true)
      expect(result.data).toEqual({
        attachments: [{ fileId: 'server-1' }, { fileId: unresolvedRef }],
      })
      expect(result.commandIdPaths).toEqual({ '$.data.attachments[1].fileId': unresolvedRef })
    })

    it('treats resolver returning the same id as no-op', () => {
      // Defensive: if the mapping store ever returns the clientId unchanged
      // (should not happen in practice), we leave the value alone.
      const refs: IdReference<ServiceLink>[] = [{ aggregate: noteAggregate, path: '$.data.id' }]
      const result = resolveCommandIds(
        { data: { id: 'stable-id' } },
        refs,
        storeFrom({ 'stable-id': 'stable-id' }),
      )
      expect(result.changed).toBe(false)
      expect(result.data).toEqual({ id: 'stable-id' })
    })
  })

  describe('LinkIdReference', () => {
    it('rewrites the .id of a Link while preserving the wrapper', () => {
      const refs: IdReference<ServiceLink>[] = [
        { aggregates: [notebookAggregate], path: '$.data.parent' },
      ]
      const result = resolveCommandIds(
        {
          data: {
            parent: { service: 'notes', type: 'Notebook', id: 'tmp-1' },
            title: 'x',
          },
        },
        refs,
        storeFrom({ 'tmp-1': 'server-1' }),
      )
      expect(result.changed).toBe(true)
      expect(result.data).toEqual({
        parent: { service: 'notes', type: 'Notebook', id: 'server-1' },
        title: 'x',
      })
    })

    it('skips Links whose aggregate does not match any declared aggregate', () => {
      const refs: IdReference<ServiceLink>[] = [
        { aggregates: [notebookAggregate], path: '$.data.parent' },
      ]
      const result = resolveCommandIds(
        {
          data: {
            parent: { service: 'notes', type: 'Note', id: 'tmp-1' },
          },
        },
        refs,
        storeFrom({ 'tmp-1': 'server-1' }),
      )
      expect(result.changed).toBe(false)
      expect(result.data).toEqual({
        parent: { service: 'notes', type: 'Note', id: 'tmp-1' },
      })
    })
  })

  describe('no-op cases', () => {
    it('returns unchanged for empty idReferences', () => {
      const result = resolveCommandIds(
        { data: { anything: 'x' } },
        [],
        storeFrom({ 'tmp-1': 'server-1' }),
      )
      expect(result.changed).toBe(false)
      expect(result.data).toEqual({ anything: 'x' })
      expect(result.commandIdPaths).toBeUndefined()
    })

    it('returns unchanged when no declared path is populated', () => {
      const refs: IdReference<ServiceLink>[] = [
        { aggregate: notebookAggregate, path: '$.data.notebookId' },
      ]
      const result = resolveCommandIds({ data: { title: 'x' } }, refs, storeFrom({}))
      expect(result.changed).toBe(false)
      expect(result.data).toEqual({ title: 'x' })
      expect(result.commandIdPaths).toBeUndefined()
    })
  })
})
