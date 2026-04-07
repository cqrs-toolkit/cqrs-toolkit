/**
 * App protocol origins for the Electron renderer.
 *
 * The app:// protocol uses hostnames to route requests:
 * - app://client/*    → renderer bundle (static files with SPA fallback)
 * - app://server/* → proxied to the CQRS server (path forwarded as-is)
 *
 * The utility process (worker) talks to the server directly at
 * http://localhost:3002 — these origins are only for renderer context.
 */

/** Origin for the renderer bundle (static assets, SPA routing). */
export const APP_ORIGIN = 'app://client'

/** Origin for proxied server requests (path forwarded as-is to the real server). */
export const SERVER_ORIGIN = 'app://server'
