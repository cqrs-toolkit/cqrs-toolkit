import { startDedicatedWorker } from '@cqrs-toolkit/client'
import { createCqrsConfig } from '@cqrs-toolkit/hypermedia-base/bootstrap/cqrs-config'

// For token-based auth, override with a worker-compatible implementation:
// startDedicatedWorker({ ...cqrsConfig, auth: workerAuthStrategy })
// The worker auth strategy would request tokens from the main thread via postMessage.
startDedicatedWorker(createCqrsConfig(location.origin))
