import { Ok, type ServiceLink } from '@meticoeus/ddd-es'
import { describe, expect, it } from 'vitest'
import { cookieAuthStrategy } from '../core/auth.js'
import type { AnyViewRegistration, ViewRegistration } from '../core/views/types.js'
import { ClientAggregate, type IClientAggregates } from './aggregates.js'
import { type EnqueueCommand } from './commands.js'
import { type CqrsConfig, resolveConfig } from './config.js'
import type { CommandHandlerRegistration } from './domain.js'

const TodoAggregate = new ClientAggregate<ServiceLink>({
  service: 'todos',
  type: 'Todo',
  getStreamId: (id) => `todos.Todo-${String(id)}`,
})

const aggregates: IClientAggregates<ServiceLink> = {
  aggregates: [TodoAggregate],
  parseStreamId: () => Ok({ service: 'todos', type: 'Todo', id: 'x' } as ServiceLink),
}

function baseConfig(): CqrsConfig<ServiceLink, EnqueueCommand> {
  return {
    aggregates,
    auth: cookieAuthStrategy,
    network: { baseUrl: 'http://localhost' },
    storage: {
      migrations: [{ version: 1, message: 'init', steps: [] }],
    },
  }
}

function makeView(referencedIdPath: string): AnyViewRegistration<ServiceLink> {
  const view: ViewRegistration<ServiceLink, { id: string }, { id: string }> = {
    name: 'todos-with-notes',
    primarySource: 'todos',
    joinSources: [{ collection: 'notes', referencedIdPath }],
    cacheKeys: () => [],
    memory: () => [],
    sql: { query: () => ({ sql: 'SELECT 1', bindings: [] }) },
  }
  return view
}

describe('resolveConfig — registration path validation', () => {
  it('accepts a config with no registration paths', () => {
    expect(() => resolveConfig(baseConfig())).not.toThrow()
  })

  it('throws when a view joinSource referencedIdPath has mismatched bracket quotes', () => {
    const config = baseConfig()
    config.views = [makeView(`$._embedded['pms.Asset"].id`)]
    expect(() => resolveConfig(config)).toThrow(
      /View 'todos-with-notes' joinSource 'notes' referencedIdPath: Unterminated bracket member/,
    )
  })

  it('accepts a view joinSource referencedIdPath with double-quoted bracket members', () => {
    const config = baseConfig()
    config.views = [makeView('$._embedded["pms.Asset"].id')]
    expect(() => resolveConfig(config)).not.toThrow()
  })

  it('throws when a view joinSource referencingIdPath is syntactically invalid', () => {
    const config = baseConfig()
    const view: ViewRegistration<ServiceLink, { id: string }, { id: string }> = {
      name: 'todos-with-notes',
      primarySource: 'todos',
      joinSources: [
        {
          collection: 'notes',
          referencedIdPath: '$._embedded["note"].id',
          referencingIdPath: '$.association[',
        },
      ],
      cacheKeys: () => [],
      memory: () => [],
      sql: { query: () => ({ sql: 'SELECT 1', bindings: [] }) },
    }
    config.views = [view]
    expect(() => resolveConfig(config)).toThrow(
      /View 'todos-with-notes' joinSource 'notes' referencingIdPath:/,
    )
  })

  it('throws when a collection idReference path is syntactically invalid', () => {
    const config = baseConfig()
    config.collections = [
      {
        name: 'todos',
        aggregate: TodoAggregate,
        idReferences: [{ aggregate: TodoAggregate, path: '$.bad[' }],
        cacheKeysFromTopics: () => [],
        matchesStream: () => false,
      },
    ]
    expect(() => resolveConfig(config)).toThrow(/Collection 'todos' idReference path:/)
  })

  it('throws when a collection revisionPath is syntactically invalid', () => {
    const config = baseConfig()
    config.collections = [
      {
        name: 'todos',
        aggregate: TodoAggregate,
        revisionPath: '$._rev[',
        cacheKeysFromTopics: () => [],
        matchesStream: () => false,
      },
    ]
    expect(() => resolveConfig(config)).toThrow(/Collection 'todos' revisionPath:/)
  })

  it('throws when a command handler commandIdReference path is invalid', () => {
    const config = baseConfig()
    const handler: CommandHandlerRegistration<ServiceLink, EnqueueCommand> = {
      commandType: 'todos.CreateTodo',
      aggregate: TodoAggregate,
      commandIdReferences: [{ aggregate: TodoAggregate, path: `$.data['id"]` }],
    } as unknown as CommandHandlerRegistration<ServiceLink, EnqueueCommand>
    config.commandHandlers = [handler]
    expect(() => resolveConfig(config)).toThrow(
      /Command 'todos.CreateTodo' commandIdReference path:/,
    )
  })

  it('throws when a managed-collection migration column has an invalid path', () => {
    const config = baseConfig()
    config.storage = {
      migrations: [
        {
          version: 1,
          message: 'init',
          steps: [
            {
              type: 'managed',
              name: 'todos',
              columns: [{ name: 'title', type: 'TEXT', path: '$.bad[' }],
            },
          ],
        },
      ],
    }
    expect(() => resolveConfig(config)).toThrow(
      /Migration v1 collection 'todos' column 'title' path:/,
    )
  })
})
