import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import './index.css'
import App from './App.jsx'
import { ScoreManagerCacheProvider } from './contexts/ScoreManagerCacheContext.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ScoreManagerCacheProvider>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </ScoreManagerCacheProvider>
  </StrictMode>,
)
