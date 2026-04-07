import { startElectronWorker } from '@cqrs-toolkit/client-electron/worker'
import { createCqrsConfig } from '@cqrs-toolkit/hypermedia-base/bootstrap/cqrs-config'

const SERVER_URL = 'http://localhost:3002'

console.log('[worker] starting electron worker...')
startElectronWorker(createCqrsConfig(SERVER_URL))
console.log('[worker] startElectronWorker called, listening for init message')
