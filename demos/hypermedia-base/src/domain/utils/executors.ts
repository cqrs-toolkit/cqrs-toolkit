import type { CommandHandlerRegistration, IAnticipatedEvent } from '@cqrs-toolkit/client'
import { ServiceLink } from '@meticoeus/ddd-es'
import type { JSONSchema7 } from 'json-schema'
import { AppCommand } from '../../cqrs/commands.js'

export type AppCommandHandlerRegistration<T extends IAnticipatedEvent = IAnticipatedEvent> =
  CommandHandlerRegistration<ServiceLink, AppCommand, JSONSchema7, T>
