import { render } from 'solid-js/web'
import { App } from './App.js'
import { settings } from './storage/preferences.js'
import './styles/panel.css'

void (async () => {
  // Hydrate persisted settings before the panel mounts so reads inside the
  // component tree are synchronous (and any one-time migration runs first).
  await settings.init()
  const root = document.getElementById('root')
  if (root) {
    root.textContent = ''
    render(() => <App />, root)
  }
})()
