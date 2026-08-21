import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
// .btn/.btn-* is used as a global utility (Dashboard, Login, Assets, Modal all
// hand-write the class names), but it lived only in Button.jsx's import, which
// is reachable from lazy routes only. Landing straight on /dashboard or /login
// left those buttons with the browser's default chrome until some Button-using
// route happened to load. Importing it here puts it in the entry CSS.
import './components/ui/Button.css'
import App from './App.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
