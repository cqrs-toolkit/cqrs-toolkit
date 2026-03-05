import { type CqrsClient } from '@cqrs-toolkit/client'
import { createContext, type JSX, useContext } from 'solid-js'

const CqrsContext = createContext<CqrsClient>()

interface CqrsProviderProps {
  client: CqrsClient
  children: JSX.Element
}

export function CqrsProvider(props: CqrsProviderProps) {
  return <CqrsContext.Provider value={props.client}>{props.children}</CqrsContext.Provider>
}

export function useClient(): CqrsClient {
  const client = useContext(CqrsContext)
  if (!client) {
    throw new Error('useClient must be used within a CqrsProvider')
  }
  return client
}
