import { Link, Route, Routes } from 'react-router-dom'
import './App.css'
import Home from './pages/Home.jsx'
import Login from './pages/Login.jsx'
import Register from './pages/Register.jsx'
import Pending from './pages/Pending.jsx'
import TeamSelection from './pages/TeamSelection.jsx'

function App() {
  return (
    <div className="app">
      <header className="topbar">
        <Link to="/" className="brand">
          <div className="brand-mark" aria-label="MyXI logo">
            <div className="logo-simple">
              <span className="logo-my">MY</span>
              <span className="logo-xi">XI</span>
            </div>
          </div>
          <div className="brand-text">
            <span>Fantasy</span>
            <strong>Cricket</strong>
          </div>
        </Link>
        <nav className="nav-links">
          <Link to="/login">Login</Link>
          <Link to="/register" className="primary-link">
            Get Started
          </Link>
        </nav>
      </header>
      <main className="main">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/pending" element={<Pending />} />
          <Route path="/team" element={<TeamSelection />} />
        </Routes>
      </main>
      <footer className="footer">
        <span>Scores update every minute</span>
      </footer>
    </div>
  )
}

export default App
