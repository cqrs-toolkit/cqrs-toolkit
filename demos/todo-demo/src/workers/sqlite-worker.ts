import { startSqliteWorker } from '@cqrs-toolkit/client'
import { cqrsConfig } from '../bootstrap/cqrs-config.js'

startSqliteWorker({ collations: cqrsConfig.collations })
