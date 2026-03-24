import { startSharedWorker } from '@cqrs-toolkit/client'
import { cqrsConfig } from '../bootstrap/cqrs-config.js'

// For token-based auth, override with a worker-compatible implementation:
// startSharedWorker({ ...cqrsConfig, auth: workerAuthStrategy })
// The worker auth strategy would request tokens from the main thread via postMessage.
startSharedWorker(cqrsConfig)
