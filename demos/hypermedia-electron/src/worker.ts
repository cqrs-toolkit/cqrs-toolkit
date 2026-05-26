import { startElectronWorker } from '@cqrs-toolkit/client-electron/worker'
import { createCqrsConfig } from '@cqrs-toolkit/hypermedia-base/bootstrap/cqrs-config'

const SERVER_URL = 'http://localhost:3002'

console.log('[worker] starting electron worker...')
// Opt in to BINARY-fallback ordering on columns declaring `locale_en`:
// better-sqlite3 can't register the comparator, but the shared
// hypermedia-base config needs to boot here too. SQL sort on
// notebook.sort_name / note.sort_name reverts to code-point order in this
// variant only; the web variant keeps locale-aware ordering through the
// WASM SQLite path.
startElectronWorker(createCqrsConfig(SERVER_URL), { unsupportedCollations: 'degrade' })
console.log('[worker] startElectronWorker called, listening for init message')
