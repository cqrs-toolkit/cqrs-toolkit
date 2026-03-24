import { useClient as useLibraryClient } from '@cqrs-toolkit/client-solid'
import type { AppCommand } from '../.cqrs/commands.js'

export const useClient = () => useLibraryClient<AppCommand>()
