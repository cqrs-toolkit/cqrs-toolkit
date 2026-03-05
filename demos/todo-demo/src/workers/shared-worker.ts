import { startSharedWorker } from '@cqrs-toolkit/client'
import { cqrsConfig } from '../bootstrap/cqrs-config'

startSharedWorker(cqrsConfig)
