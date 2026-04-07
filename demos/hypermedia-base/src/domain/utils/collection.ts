import { createCollection } from '@cqrs-toolkit/hypermedia-client'
import type { ServiceLink } from '@meticoeus/ddd-es'

export const appCreateCollection = createCollection<ServiceLink>
