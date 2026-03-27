import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, NavLink, Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom'
import './App.css'
import Home from './pages/Home.jsx'
import Dashboard from './pages/Dashboard.jsx'
import Login from './pages/Login.jsx'
import Register from './pages/Register.jsx'
import ForgotPassword from './pages/ForgotPassword.jsx'
import Pending from './pages/Pending.jsx'
import TeamSelection from './pages/TeamSelection.jsx'
import FantasyHub from './pages/FantasyHub.jsx'
import AuctionHub from './pages/AuctionHub.jsx'
import Tournaments from './pages/Tournaments.jsx'
import TournamentContests from './pages/TournamentContests.jsx'
import ContestDetail from './pages/ContestDetail.jsx'
import Leaderboard from './pages/Leaderboard.jsx'
import NotFound from './pages/NotFound.jsx'
import MyTeam from './pages/MyTeam.jsx'
import TournamentUserPage from './pages/TournamentUserPage.jsx'
import AllPages from './pages/AllPages.jsx'
import AllApis from './pages/AllApis.jsx'
import Profile from './pages/Profile.jsx'
import UserProfileAdmin from './pages/UserProfileAdmin.jsx'
import DraftsHub from './pages/DraftsHub.jsx'
import PickemHub from './pages/PickemHub.jsx'
import ChangePassword from './pages/ChangePassword.jsx'
import CricketerStats from './pages/CricketerStats.jsx'
import { logout, prefetchAppData, refreshSession, subscribeApiActivity } from './lib/api.js'
import { clearStoredAuth, getStoredUser } from './lib/auth.js'
import GlobalApiLoader from './components/ui/GlobalApiLoader.jsx'
import CricketRouteLoader from './components/ui/CricketRouteLoader.jsx'

function App() {
  const location = useLocation()
  const navigate = useNavigate()
  const [isMobileHeader, setIsMobileHeader] = useState(() => {
    if (typeof window === 'undefined') return false
    return window.innerWidth <= 900
  })
  const [currentUser, setCurrentUser] = useState(() => {
    return getStoredUser()
  })
  const showAuthLinks = location.pathname === '/'
  const searchParams = new URLSearchParams(location.search)
  const viewMode = (searchParams.get('view') || '').toString().trim().toLowerCase()
  const isAuctionView = viewMode === 'auction'
  const isLanding = location.pathname === '/'
  const isAuthPage = ['/login', '/register', '/forgot-password', '/pending'].includes(
    location.pathname,
  )
  const showTabs = !!currentUser && !isLanding && !isAuthPage
  const isTeamPage =
    location.pathname === '/fantasy/select' || location.pathname === '/team/select'
  const isFantasyHubPage =
    location.pathname === '/fantasy' || location.pathname === '/team'
  const isAuctionHubPage = location.pathname === '/auction'
  const isContestDetailPage =
    /^\/tournaments\/[^/]+\/contests\/[^/]+$/.test(location.pathname)
  const isLeaderboardPage =
    location.pathname === '/leaderboard' ||
    /^\/tournaments\/[^/]+(\/contests\/[^/]+)?\/leaderboard$/.test(location.pathname)
  const isCricketerStatsPage =
    location.pathname === '/cricketer-stats' ||
    /^\/tournaments\/[^/]+\/cricketer-stats$/.test(location.pathname)
  const isCatalogPage = ['/all-pages', '/all-apis'].includes(location.pathname)
  const isLowerContentPage =
    [
      '/login',
      '/register',
      '/forgot-password',
      '/pending',
      '/home',
      '/dashboard',
      '/fantasy',
      '/auction',
      '/team',
      '/drafts',
      '/pickem',
      '/tournaments',
      '/my-team',
      '/profile',
      '/users',
      '/change-password',
      '/all-pages',
      '/all-apis',
      '/cricketer-stats',
      '/admin/scoring',
      '/admin/score-upload',
      '/admin/dashboard',
      '/leaderboard',
    ].includes(location.pathname) ||
    location.pathname.startsWith('/tournaments/') ||
    location.pathname.startsWith('/users/')
  const [theme, setTheme] = useState(() => {
    if (typeof window === 'undefined') return 'light'
    return window.localStorage.getItem('myxi-theme') || 'light'
  })
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [userMenuOpen, setUserMenuOpen] = useState(false)
  const [isApiLoading, setIsApiLoading] = useState(false)
  const [sessionWarningSeconds, setSessionWarningSeconds] = useState(null)
  const [isRefreshingSession, setIsRefreshingSession] = useState(false)
  const prefetchKeyRef = useRef('')
  const userMenuRef = useRef(null)
  const brandHref = currentUser ? '/home' : '/'
  const requireAuth = (element) =>
    currentUser ? element : <Navigate to="/login" replace />
  const isHomeFantasyRoute = ['/home', '/fantasy', '/auction', '/team'].includes(
    location.pathname,
  )
  const isFantasyNavActive =
    (!isAuctionView &&
      (location.pathname === '/fantasy' ||
        location.pathname === '/team' ||
        location.pathname === '/fantasy/select' ||
        location.pathname === '/team/select' ||
        location.pathname === '/tournaments' ||
        location.pathname.startsWith('/tournaments/') ||
        location.pathname === '/leaderboard' ||
        location.pathname === '/cricketer-stats')) ||
    false
  const isAuctionNavActive = location.pathname === '/auction' || isAuctionView
  const showCricketRouteLoader = isApiLoading && isHomeFantasyRoute

  useEffect(() => {
    window.localStorage.setItem('myxi-theme', theme)
    document.body.classList.toggle('dark-theme', theme === 'dark')
  }, [theme])

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      setMobileMenuOpen(false)
      setUserMenuOpen(false)
      setCurrentUser(getStoredUser())
    })
    return () => window.cancelAnimationFrame(frame)
  }, [location.pathname])

  const onLogout = useCallback(async () => {
    try {
      await logout()
    } catch {
      // best effort
    }
    clearStoredAuth()
    setCurrentUser(null)
    setSessionWarningSeconds(null)
    setUserMenuOpen(false)
    setMobileMenuOpen(false)
    navigate('/login', { replace: true })
  }, [navigate])

  const onContinueSession = useCallback(async () => {
    try {
      setIsRefreshingSession(true)
      await refreshSession()
      setCurrentUser(getStoredUser())
      setSessionWarningSeconds(null)
    } catch {
      await onLogout()
    } finally {
      setIsRefreshingSession(false)
    }
  }, [onLogout])

  useEffect(() => {
    if (!userMenuOpen) return undefined
    const onDocDown = (event) => {
      if (userMenuRef.current && !userMenuRef.current.contains(event.target)) {
        setUserMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', onDocDown)
    return () => document.removeEventListener('mousedown', onDocDown)
  }, [userMenuOpen])

  useEffect(() => {
    if (typeof window === 'undefined') return undefined
    const onResize = () => setIsMobileHeader(window.innerWidth <= 900)
    onResize()
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  useEffect(() => {
    return subscribeApiActivity((pendingCount) => {
      setIsApiLoading(pendingCount > 0)
    })
  }, [])

  useEffect(() => {
    if (!currentUser?.tokenExpiresAt) {
      setSessionWarningSeconds(null)
      return undefined
    }
    const tick = () => {
      const expiry = Number(currentUser.tokenExpiresAt || 0)
      if (!Number.isFinite(expiry) || expiry <= 0) {
        setSessionWarningSeconds(null)
        return
      }
      const remainingMs = expiry - Date.now()
      if (remainingMs <= 0) {
        setSessionWarningSeconds(0)
        void onLogout()
        return
      }
      const remainingSeconds = Math.ceil(remainingMs / 1000)
      if (remainingSeconds <= 30) {
        setSessionWarningSeconds(remainingSeconds)
      } else {
        setSessionWarningSeconds(null)
      }
    }
    tick()
    const timer = window.setInterval(tick, 1000)
    return () => window.clearInterval(timer)
  }, [currentUser?.tokenExpiresAt, onLogout])

  useEffect(() => {
    if (!currentUser) {
      prefetchKeyRef.current = ''
      return
    }
    const userId = currentUser.userId || currentUser.gameName || currentUser.email || ''
    const role = currentUser.role || 'user'
    const key = `${userId}:${role}`
    if (prefetchKeyRef.current === key) return
    prefetchKeyRef.current = key
    void prefetchAppData({ userId, role })
  }, [currentUser])

  return (
    <div
      className={`app ${isLanding ? 'landing' : ''} ${isAuthPage ? 'app-auth' : ''} ${userMenuOpen ? 'menu-open' : ''} ${isTeamPage ? 'app-team' : ''} ${isFantasyHubPage || isAuctionHubPage ? 'is-fantasy-hub' : ''} ${isContestDetailPage ? 'is-contest-detail' : ''} ${isLeaderboardPage ? 'is-leaderboard-page' : ''} ${isCricketerStatsPage ? 'is-cricketer-stats-page' : ''} ${isCatalogPage ? 'is-catalog' : ''} ${isLowerContentPage ? 'app-lower-content' : ''} ${theme === 'dark' ? 'theme-dark' : 'theme-light'}`.trim()}
    >
      <div className="page-header-shell">
        <header className={`topbar compact ${isLanding ? 'landing' : ''}`.trim()}>
          <Link to={brandHref} className="brand compact-brand">
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
          {showTabs && (
            <nav className="nav-tabs">
              <NavLink
                to="/home"
                className={({ isActive }) => `tab ${isActive ? 'active' : ''}`}
              >
                Home
              </NavLink>
              <NavLink
                to="/fantasy"
                className={({ isActive }) =>
                  `tab ${isActive || isFantasyNavActive ? 'active' : ''}`
                }
              >
                Fantasy
              </NavLink>
              <NavLink
                to="/auction"
                className={({ isActive }) =>
                  `tab ${isActive || isAuctionNavActive ? 'active' : ''}`
                }
              >
                Auction
              </NavLink>
            </nav>
          )}
          <div className="nav-actions">
            {!isLanding && (
              <button
                type="button"
                className="ghost small mobile-nav-trigger"
                onClick={() => {
                  setUserMenuOpen(false)
                  setMobileMenuOpen(true)
                }}
                aria-label="Open navigation menu"
              >
                ≡
              </button>
            )}
            {showAuthLinks && (
              <>
                <Link to="/login" className="ghost small">
                  Login
                </Link>
                <Link to="/register" className="primary-link small">
                  Get Started
                </Link>
              </>
            )}
            {!!currentUser && !isLanding && !isAuthPage && !isMobileHeader && (
              <div className="user-menu" ref={userMenuRef}>
                <button
                  type="button"
                  className="icon-button logout user-menu-trigger"
                  aria-label="Open user menu"
                  onClick={() => setUserMenuOpen((prev) => !prev)}
                >
                  <span className="logout-icon">◉</span>
                  <span className="logout-text">{currentUser.name || 'User'}</span>
                </button>
                <div
                  className={`user-menu-dropdown ${userMenuOpen ? 'open' : ''}`.trim()}
                >
                  <Link to="/profile" className="user-menu-item">
                    Profile
                  </Link>
                  <Link to="/change-password" className="user-menu-item">
                    Change password
                  </Link>
                  <label className="user-theme-toggle" htmlFor="theme-toggle">
                    <span>Dark mode</span>
                    <input
                      id="theme-toggle"
                      type="checkbox"
                      checked={theme === 'dark'}
                      onChange={() =>
                        setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'))
                      }
                    />
                    <span className="toggle-pill" />
                  </label>
                  <button type="button" className="user-menu-item" onClick={onLogout}>
                    Logout
                  </button>
                </div>
              </div>
            )}
          </div>
        </header>
      </div>
      <div
        className={`mobile-nav-drawer ${mobileMenuOpen ? 'open' : ''}`.trim()}
        onClick={(event) => {
          if (event.target === event.currentTarget) setMobileMenuOpen(false)
        }}
      >
        <div className="mobile-nav-panel">
          <div className="mobile-nav-header">
            <strong>Navigate</strong>
            <button
              type="button"
              className="ghost small"
              onClick={() => setMobileMenuOpen(false)}
            >
              Close
            </button>
          </div>
          <div className="mobile-nav-links">
            <NavLink to="/home" className="leaderboard-link">
              Home
            </NavLink>
            <NavLink to="/fantasy" className="leaderboard-link">
              Fantasy
            </NavLink>
            <NavLink to="/auction" className="leaderboard-link">
              Auction
            </NavLink>
            <NavLink to="/cricketer-stats" className="leaderboard-link">
              Cricketer stats
            </NavLink>
            <NavLink to="/profile" className="leaderboard-link">
              Profile
            </NavLink>
            <NavLink to="/change-password" className="leaderboard-link">
              Change password
            </NavLink>
            <label
              className="user-theme-toggle mobile-user-theme-toggle"
              htmlFor="mobile-theme-toggle"
            >
              <span>Dark mode</span>
              <input
                id="mobile-theme-toggle"
                type="checkbox"
                checked={theme === 'dark'}
                onChange={() => setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'))}
              />
              <span className="toggle-pill" />
            </label>
            <button
              type="button"
              className="user-menu-item mobile-logout-btn"
              onClick={onLogout}
            >
              Logout
            </button>
          </div>
        </div>
      </div>
      <GlobalApiLoader loading={isApiLoading && !showCricketRouteLoader} />
      <CricketRouteLoader loading={showCricketRouteLoader} />
      {sessionWarningSeconds != null && (
        <div className="session-warning-backdrop">
          <section className="session-warning-card">
            <h3>Session expiring soon</h3>
            <p>
              Your session will expire in <strong>{sessionWarningSeconds}</strong> seconds.
            </p>
            <div className="session-warning-actions">
              <button
                type="button"
                className="cta"
                onClick={onContinueSession}
                disabled={isRefreshingSession}
              >
                {isRefreshingSession ? 'Refreshing...' : 'Continue'}
              </button>
              <button type="button" className="ghost" onClick={() => void onLogout()}>
                Logout
              </button>
            </div>
          </section>
        </div>
      )}
      <main
        className={`main ${isTeamPage ? 'main-team' : ''} ${isLowerContentPage ? 'main-lower-content' : ''}`.trim()}
      >
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/home" element={requireAuth(<Dashboard />)} />
          <Route path="/dashboard" element={requireAuth(<Navigate to="/home" replace />)} />
          <Route path="/login" element={currentUser ? <Navigate to="/home" replace /> : <Login />} />
          <Route path="/register" element={currentUser ? <Navigate to="/home" replace /> : <Register />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/pending" element={<Pending />} />
          <Route path="/tournaments" element={requireAuth(<Tournaments />)} />
          <Route
            path="/tournaments/:tournamentId"
            element={requireAuth(<TournamentContests />)}
          />
          <Route
            path="/tournaments/:tournamentId/contests"
            element={requireAuth(<TournamentContests />)}
          />
          <Route
            path="/tournaments/:tournamentId/contests/:contestId"
            element={requireAuth(<ContestDetail />)}
          />
          <Route
            path="/tournaments/:tournamentId/contests/:contestId/leaderboard"
            element={requireAuth(<Leaderboard />)}
          />
          <Route
            path="/tournaments/:tournamentId/leaderboard"
            element={requireAuth(<Leaderboard />)}
          />
          <Route path="/fantasy" element={requireAuth(<FantasyHub />)} />
          <Route path="/auction" element={requireAuth(<AuctionHub />)} />
          <Route path="/fantasy/select" element={requireAuth(<TeamSelection />)} />
          <Route path="/team" element={requireAuth(<Navigate to="/fantasy" replace />)} />
          <Route
            path="/team/select"
            element={requireAuth(<Navigate to="/fantasy/select" replace />)}
          />
          <Route path="/drafts" element={requireAuth(<DraftsHub />)} />
          <Route path="/pickem" element={requireAuth(<PickemHub />)} />
          <Route path="/my-team" element={requireAuth(<MyTeam />)} />
          <Route path="/cricketer-stats" element={requireAuth(<CricketerStats />)} />
          <Route
            path="/tournaments/:tournamentId/cricketer-stats"
            element={requireAuth(<CricketerStats />)}
          />
          <Route path="/profile" element={requireAuth(<Profile />)} />
          <Route path="/users/:userId" element={requireAuth(<UserProfileAdmin />)} />
          <Route path="/change-password" element={requireAuth(<ChangePassword />)} />
          <Route path="/all-pages" element={requireAuth(<AllPages />)} />
          <Route path="/all-apis" element={requireAuth(<AllApis />)} />
          <Route
            path="/admin/dashboard"
            element={requireAuth(<Dashboard defaultPanel="admin" />)}
          />
          <Route
            path="/master/dashboard"
            element={requireAuth(<Navigate to="/home" replace />)}
          />
          <Route
            path="/admin/scoring"
            element={requireAuth(<Dashboard defaultPanel="points" />)}
          />
          <Route
            path="/admin/score-upload"
            element={requireAuth(<Dashboard defaultPanel="upload" />)}
          />
          <Route path="/leaderboard" element={requireAuth(<Leaderboard />)} />
          <Route
            path="/tournaments/:tournamentId/contests/:contestId/users/:userId"
            element={requireAuth(<TournamentUserPage />)}
          />
          <Route
            path="/tournaments/:tournamentId/users/:userId"
            element={requireAuth(<TournamentUserPage />)}
          />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </main>
    </div>
  )
}

export default App
