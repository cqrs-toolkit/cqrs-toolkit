import { createConsoleLogger, logProvider } from '@meticoeus/ddd-es'
import 'fake-indexeddb/auto'

logProvider.setLogger(
  createConsoleLogger({
    level: (process.env['LOG_LEVEL'] as 'debug' | 'info' | 'warn' | 'error' | 'silent') ?? 'warn',
  }),
)
