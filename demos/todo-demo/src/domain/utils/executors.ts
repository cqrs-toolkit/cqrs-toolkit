import type {
  CommandHandlerRegistration,
  EnqueueCommand,
  IAnticipatedEvent,
} from '@cqrs-toolkit/client'
import { ServiceLink } from '@meticoeus/ddd-es'
import type { JSONSchema7 } from 'json-schema'

export type AppCommandHandlerRegistration<T extends IAnticipatedEvent = IAnticipatedEvent> =
  CommandHandlerRegistration<ServiceLink, EnqueueCommand, JSONSchema7, T>
