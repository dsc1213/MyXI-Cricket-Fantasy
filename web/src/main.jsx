import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import './index.css'
import App from './App.jsx'
import { AppQueryCacheProvider } from './contexts/AppQueryCacheContext.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <AppQueryCacheProvider>
        <App />
      </AppQueryCacheProvider>
    </BrowserRouter>
  </StrictMode>,
)
