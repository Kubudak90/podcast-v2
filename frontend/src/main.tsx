import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { registerSW } from 'virtual:pwa-register'
import './index.css'
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

// Register service worker for PWA support
registerSW({
  onRegisteredSW(_swUrl: string, registration?: ServiceWorkerRegistration) {
    if (registration) {
      // Check for updates every hour
      setInterval(() => {
        registration.update()
      }, 60 * 60 * 1000)
    }
  },
  onOfflineReady() {
    console.log('App ready to work offline')
  },
})
