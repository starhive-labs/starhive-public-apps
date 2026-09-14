import { StrictMode, Suspense } from 'react'
import { createRoot } from 'react-dom/client'

import { App } from './App'

const root = document.getElementById('root')
if (!root) throw new Error('Missing #root')

createRoot(root).render(
  <StrictMode>
    <Suspense fallback={<div style={{ padding: 16, fontFamily: 'sans-serif' }}>Connecting…</div>}>
      <App />
    </Suspense>
  </StrictMode>,
)
