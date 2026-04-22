import { generateId } from '#utils'
import { ServiceLink } from '@meticoeus/ddd-es'
import { IAnticipatedEvent } from '../core/command-lifecycle/AnticipatedEventShape.js'
import { createDomainExecutor, domainSuccess } from '../types/domain.js'
import type { EnqueueCommand } from '../types/index.js'
import { FolderAggregate, ItemAggregate, NoteAggregate } from './aggregates.js'

export type CreateItem = EnqueueCommand<{ name: string }> & { type: 'CreateItem' }
export type UpdateItem = EnqueueCommand<{ id: string; title: string }> & { type: 'UpdateItem' }
export type DeleteItem = EnqueueCommand<{ id: string }> & { type: 'DeleteItem' }
export type ItemCommand = CreateItem | UpdateItem | DeleteItem

export const itemDomainExecutor = createDomainExecutor<
  ServiceLink,
  ItemCommand,
  unknown,
  IAnticipatedEvent
>([
  {
    commandType: 'CreateItem',
    aggregate: ItemAggregate,
    commandIdReferences: [],
    creates: { eventType: 'ItemCreated', idStrategy: 'temporary' },
    handler(command, _state, context) {
      const id = context.phase === 'updating' ? context.entityId : generateId()
      return domainSuccess([
        {
          type: 'ItemCreated',
          data: { id, name: command.data.name },
          streamId: `nb.Item-${id}`,
        },
      ])
    },
  },
  {
    commandType: 'UpdateItem',
    aggregate: ItemAggregate,
    commandIdReferences: [{ aggregate: ItemAggregate, path: '$.data.id' }],
    handler(command, _context) {
      return domainSuccess([
        {
          type: 'ItemUpdated',
          data: { id: command.data.id, title: command.data.title },
          streamId: `nb.Item-${command.data.id}`,
        },
      ])
    },
  },
  {
    commandType: 'DeleteItem',
    aggregate: ItemAggregate,
    commandIdReferences: [{ aggregate: ItemAggregate, path: '$.data.id' }],
    handler(command, _context) {
      return domainSuccess([
        {
          type: 'ItemDeleted',
          data: { id: command.data.id },
          streamId: `nb.Item-${command.data.id}`,
        },
      ])
    },
  },
])

export type CreateFolder = EnqueueCommand<{ name: string }> & { type: 'CreateFolder' }
export type CreateNote = EnqueueCommand<{ parentId: string; title: string }> & {
  type: 'CreateNote'
}
export type UpdateNote = EnqueueCommand<{ id: string; title: string }> & { type: 'UpdateNote' }
export type MoveNote = EnqueueCommand<{ id: string; fromFolderId: string; toFolderId: string }> & {
  type: 'MoveNote'
}
export type CrossAggregateCommand = CreateFolder | CreateNote | UpdateNote | MoveNote

export const crossAggregateDomainExecutor = createDomainExecutor<
  ServiceLink,
  CrossAggregateCommand,
  unknown,
  IAnticipatedEvent
>([
  {
    commandType: 'CreateFolder',
    aggregate: FolderAggregate,
    commandIdReferences: [],
    creates: { eventType: 'FolderCreated', idStrategy: 'temporary' },
    handler(command, _state, context) {
      const id = context.phase === 'updating' ? context.entityId : generateId()
      return domainSuccess([
        {
          type: 'FolderCreated',
          data: { id, name: command.data.name },
          streamId: `nb.Folder-${id}`,
        },
      ])
    },
  },
  {
    commandType: 'CreateNote',
    aggregate: NoteAggregate,
    commandIdReferences: [{ aggregate: FolderAggregate, path: '$.data.parentId' }],
    creates: { eventType: 'NoteCreated', idStrategy: 'temporary' },
    handler(command, _state, context) {
      const id = context.phase === 'updating' ? context.entityId : generateId()
      return domainSuccess([
        {
          type: 'NoteCreated',
          data: { id, parentId: command.data.parentId, title: command.data.title },
          streamId: `nb.Note-${id}`,
        },
      ])
    },
  },
  {
    commandType: 'UpdateNote',
    aggregate: NoteAggregate,
    commandIdReferences: [{ aggregate: NoteAggregate, path: '$.data.id' }],
    handler(command, _context) {
      return domainSuccess([
        {
          type: 'NoteTitleUpdated',
          data: { id: command.data.id, title: command.data.title },
          streamId: `nb.Note-${command.data.id}`,
        },
      ])
    },
  },
  {
    commandType: 'MoveNote',
    aggregate: NoteAggregate,
    commandIdReferences: [
      { aggregate: NoteAggregate, path: '$.data.id' },
      { aggregate: FolderAggregate, path: '$.data.fromFolderId' },
      { aggregate: FolderAggregate, path: '$.data.toFolderId' },
    ],
    handler(command, _context) {
      return domainSuccess([
        {
          type: 'NoteMoved',
          data: {
            id: command.data.id,
            fromFolderId: command.data.fromFolderId,
            toFolderId: command.data.toFolderId,
          },
          streamId: `nb.Note-${command.data.id}`,
        },
      ])
    },
  },
])
