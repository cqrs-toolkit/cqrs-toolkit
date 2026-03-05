import { startDedicatedWorker } from '@cqrs-toolkit/client'
import { cqrsConfig } from '../bootstrap/cqrs-config'

startDedicatedWorker(cqrsConfig)
