/**
 * IPC channel names and constants for Electron port transfer.
 *
 * These channel names are used internally by the library for communication
 * between the main process and renderer. If your preload script whitelists
 * IPC channels, add {@link PORT_TRANSFER_CHANNEL} to the allowlist.
 */

/** IPC channel used for main→renderer MessagePort transfer. */
export const PORT_TRANSFER_CHANNEL = '@cqrs-toolkit/port-transfer'

/** Default timeout (ms) waiting for the port from the main process. */
export const PORT_TRANSFER_TIMEOUT = 10000
