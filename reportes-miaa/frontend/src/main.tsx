import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
// Tipografía institucional (ver index.css). Requiere: npm install @fontsource-variable/figtree
import '@fontsource-variable/figtree'
import './index.css'
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
