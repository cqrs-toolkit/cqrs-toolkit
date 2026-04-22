import { testEventBusLogger } from '@cqrs-toolkit/client/testing'
import { logProvider } from '@meticoeus/ddd-es'
import 'fake-indexeddb/auto'

logProvider.setLogger(testEventBusLogger)
