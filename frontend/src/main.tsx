import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { registerSW } from 'virtual:pwa-register'
import './index.css'
import App from './App.tsx'
import { attachServiceWorkerUpdates } from './lib/swUpdates'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

registerSW({
  onRegisteredSW(_swUrl: string, registration?: ServiceWorkerRegistration) {
    attachServiceWorkerUpdates(registration)
  },
  onOfflineReady() {
    console.log('App ready to work offline')
  },
})
