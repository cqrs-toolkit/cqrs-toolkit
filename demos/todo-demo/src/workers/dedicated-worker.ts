import { startDedicatedWorker } from '@cqrs-toolkit/client'
import { cqrsConfig } from '../bootstrap/cqrs-config'

// For token-based auth, override with a worker-compatible implementation:
// startDedicatedWorker({ ...cqrsConfig, auth: workerAuthStrategy })
// The worker auth strategy would request tokens from the main thread via postMessage.
startDedicatedWorker(cqrsConfig)
