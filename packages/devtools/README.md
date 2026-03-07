# @cqrs-toolkit/devtools

Chrome DevTools extension for debugging `@cqrs-toolkit/client` applications.
Adds a **CQRS Toolkit** panel to Chrome DevTools that shows live command state, WebSocket events, gap detection, and more.

## Development Setup

### Building

```bash
# From the repo root — build all packages including devtools
npm run build

# Or build just the extension
npm run build --workspace=packages/devtools

# Watch mode (rebuilds on file changes)
npm run dev --workspace=packages/devtools
```

The build outputs a ready-to-load extension to `packages/devtools/dist/`.

### Installing in Chrome

1. Build the extension (see above).
2. Open `chrome://extensions` in Chrome.
3. Enable **Developer mode** (toggle in the top-right corner).
4. Click **Load unpacked**.
5. Select the `packages/devtools/dist/` directory.
6. The extension is now active.
   Open DevTools on any page running a `@cqrs-toolkit/client` app and look for the **CQRS Toolkit** tab.

### Updating After a Rebuild

Chrome does not automatically pick up changes to an unpacked extension.
After rebuilding, you need to tell Chrome to reload it:

1. Rebuild (`npm run build --workspace=packages/devtools`).
2. Open `chrome://extensions`.
3. Find **CQRS Toolkit DevTools** and click the reload icon (circular arrow).
4. If you have DevTools open on a page, **close and reopen DevTools** (or close and reopen the inspected tab) for the new code to take effect.
   The DevTools panel, content scripts, and background service worker are all loaded at panel/tab open time, so a page refresh alone is not sufficient.

> **Tip:** If you are using `npm run dev` (watch mode), you still need to reload the extension and reopen DevTools after each rebuild.
> Chrome caches extension resources aggressively — the reload step on `chrome://extensions` is what invalidates that cache.

### Extension Architecture

The extension is a Chrome Manifest V3 extension with four execution contexts:

| Context        | Entry point              | World          | Purpose                                                                                            |
| -------------- | ------------------------ | -------------- | -------------------------------------------------------------------------------------------------- |
| Hook           | `hook.js`                | MAIN           | Injected into the page. Discovers the `__CQRS_DEVTOOLS__` debug API and forwards sanitized events. |
| Content script | `content-script.js`      | ISOLATED       | Bridges `window.postMessage` from the hook to `chrome.runtime` ports.                              |
| Background     | `background.js`          | Service worker | Buffers events per tab, manages port connections between content scripts and panels.               |
| Panel          | `panel.js` + `panel.css` | DevTools panel | SolidJS UI that renders the CQRS Toolkit tab inside Chrome DevTools.                               |
