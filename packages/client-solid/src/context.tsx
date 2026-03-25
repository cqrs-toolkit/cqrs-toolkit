import { type CqrsClient, type EnqueueCommand } from '@cqrs-toolkit/client'
import type { Link } from '@meticoeus/ddd-es'
import { createContext, type JSX, useContext } from 'solid-js'

const CqrsContext = createContext<CqrsClient<Link>>()

interface CqrsProviderProps<TLink extends Link> {
  client: CqrsClient<TLink>
  children: JSX.Element
}

export function CqrsProvider<TLink extends Link>(props: CqrsProviderProps<TLink>) {
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
