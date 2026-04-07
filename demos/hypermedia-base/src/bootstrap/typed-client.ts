import { useClient as useLibraryClient } from '@cqrs-toolkit/client-solid'
import { ServiceLink } from '@meticoeus/ddd-es'
import type { AppCommand } from '../.cqrs/commands.js'

export const useClient = () => useLibraryClient<ServiceLink, AppCommand>()
