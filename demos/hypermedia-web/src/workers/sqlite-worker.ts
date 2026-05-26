import { startSqliteWorker } from '@cqrs-toolkit/client'
import { createCqrsConfig } from '@cqrs-toolkit/hypermedia-base/bootstrap/cqrs-config'

startSqliteWorker({ collations: createCqrsConfig(location.origin).collations })
