import { MotionConfig } from 'motion/react'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
// Registers the service worker as the page loads.
import './device'
import App from './App.tsx'
import { ErrorBoundary } from './components/ErrorBoundary'
import { startReporting } from './log'

startReporting()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      {/* Anyone who has asked their system for less motion gets fades, not movement. */}
      <MotionConfig reducedMotion="user">
        <App />
      </MotionConfig>
    </ErrorBoundary>
  </StrictMode>,
)
