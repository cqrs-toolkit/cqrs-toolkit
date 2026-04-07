import type { LibraryEvent } from '@cqrs-toolkit/client'
import type { ServiceLink } from '@meticoeus/ddd-es'

declare global {
  interface Window {
    __CQRS_EVENTS__: LibraryEvent<ServiceLink>[]
  }
}
