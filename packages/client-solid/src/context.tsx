import { type CqrsClient, type EnqueueCommand } from '@cqrs-toolkit/client'
import type { Link } from '@meticoeus/ddd-es'
import { createContext, type JSX, useContext } from 'solid-js'

const CqrsContext = createContext<CqrsClient<Link, EnqueueCommand>>()

interface CqrsProviderProps<TLink extends Link, TCommand extends EnqueueCommand> {
  client: CqrsClient<TLink, TCommand>
  children: JSX.Element
}

export function CqrsProvider<TLink extends Link, TCommand extends EnqueueCommand>(
  props: CqrsProviderProps<TLink, TCommand>,
) {
  return <CqrsContext.Provider value={props.client}>{props.children}</CqrsContext.Provider>
}

export function useClient<
  TLink extends Link,
  TCommand extends EnqueueCommand = EnqueueCommand,
>(): CqrsClient<TLink, TCommand> {
  const client = useContext(CqrsContext)
  if (!client) {
    throw new Error('useClient must be used within a CqrsProvider')
  }
  return client as CqrsClient<TLink, TCommand>
}
