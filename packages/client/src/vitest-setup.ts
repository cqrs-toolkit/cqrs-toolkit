import { logProvider } from '@meticoeus/ddd-es'
import 'fake-indexeddb/auto'
import { testEventBusLogger } from './testing/testLogger.js'

logProvider.setLogger(testEventBusLogger)
