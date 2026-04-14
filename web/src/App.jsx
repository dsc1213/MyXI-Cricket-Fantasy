import { useCallback, useEffect, useRef, useState } from 'react'
import {
  Link,
  NavLink,
  Navigate,
  Route,
  Routes,
  useLocation,
  useNavigate,
} from 'react-router-dom'
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
import {
  clearAppDataCache,
  logout,
  prefetchAppData,
  refreshSession,
  subscribeApiActivity,
} from './lib/api.js'
import { clearStoredAuth, getStoredUser } from './lib/auth.js'
import GlobalApiLoader from './components/ui/GlobalApiLoader.jsx'
import ApiStatusDot from './components/ui/ApiStatusDot.jsx'
import ApiFailureTile from './components/ui/ApiFailureTile.jsx'
import { API_BASE } from './lib/api.js'
import CricketRouteLoader from './components/ui/CricketRouteLoader.jsx'
import useApiHealthStatus from './hooks/useApiHealthStatus.js'

function App() {
  const {
    setApiStatus,
    apiDotRef,
    showApiError,
    checkingApi,
    reconnectAttempt,
    maxRetries,
    checkApi,
  } = useApiHealthStatus({
    autoRetry: true,
    retryIntervalMs: 30000,
    maxRetries: 10,
    checkDurationMs: 800,
    initialCheck: true,
  })

  const location = useLocation()
  const navigate = useNavigate()
  const [isMobileHeader, setIsMobileHeader] = useState(() => {
    if (typeof window === 'undefined') return false
    return window.innerWidth <= 900
  })
  const [currentUser, setCurrentUser] = useState(() => {
    return getStoredUser()
  })
  const [isRestoringSession, setIsRestoringSession] = useState(() =>
    Boolean(getStoredUser()),
  )
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
  const isContestDetailPage = /^\/tournaments\/[^/]+\/contests\/[^/]+$/.test(
    location.pathname,
  )
  const isLeaderboardPage =
    location.pathname === '/leaderboard' ||
    /^\/tournaments\/[^/]+(\/contests\/[^/]+)?\/leaderboard$/.test(location.pathname)
  const isCricketerStatsPage =
    location.pathname === '/cricketer-stats' ||
    /^\/tournaments\/[^/]+\/cricketer-stats$/.test(location.pathname)
  const isCatalogPage = ['/all-pages', '/all-apis'].includes(location.pathname)
  const isDashboardPage = [
    '/home',
    '/dashboard',
    '/admin/dashboard',
    '/master/dashboard',
  ].includes(location.pathname)
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
  const [isRefreshingAppData, setIsRefreshingAppData] = useState(false)
  const [sessionWarningSeconds, setSessionWarningSeconds] = useState(null)
  const [isRefreshingSession, setIsRefreshingSession] = useState(false)
  const prefetchKeyRef = useRef('')
  const userMenuRef = useRef(null)
  const brandHref = currentUser ? '/home' : '/'
  const requireAuth = (element) =>
    isRestoringSession ? null : currentUser ? element : <Navigate to="/login" replace />
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
  const showApiOnlyError = showApiError && !isAuthPage && !isLanding
  const normalizedRole = (currentUser?.role || '').toString().trim().toLowerCase()
  const isAdminRole = ['admin', 'master_admin'].includes(normalizedRole)
  const isMasterRole = normalizedRole === 'master_admin'
  const mobileAdminLinks = [
    { to: '/home?panel=tournamentManager', label: 'Admin • Tournament Manager' },
    { to: '/home?panel=contestManager', label: 'Admin • Contest Manager' },
    { to: '/home?panel=squads', label: 'Admin • Squad Manager' },
    { to: '/home?panel=playingXiManager', label: 'Admin • Playing XI Manager' },
    { to: '/home?panel=scoreManager', label: 'Admin • Score Manager' },
    { to: '/home?panel=audit', label: 'Admin • Audit Logs' },
  ]
  const mobileMasterLinks = [
    { to: '/home?panel=userManager', label: 'Master • User Manager' },
    { to: '/all-pages', label: 'Master • All Pages' },
    { to: '/all-apis', label: 'Master • All APIs' },
  ]

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

  useEffect(() => {
    let active = true

    const restoreSession = async () => {
      const storedUser = getStoredUser()
      if (!storedUser) {
        if (!active) return
        setCurrentUser(null)
        setIsRestoringSession(false)
        return
      }

      const expiry = Number(storedUser.tokenExpiresAt || 0)
      const hasFreshExpiry = Number.isFinite(expiry) && expiry > Date.now()
      if (hasFreshExpiry) {
        if (!active) return
        setCurrentUser(storedUser)
        setIsRestoringSession(false)
        return
      }

      try {
        setIsRefreshingSession(true)
        await refreshSession()
        if (!active) return
        setCurrentUser(getStoredUser())
      } catch {
        if (!active) return
        setCurrentUser(storedUser)
      } finally {
        if (active) {
          setIsRefreshingSession(false)
          setIsRestoringSession(false)
        }
      }
    }

    restoreSession()
    return () => {
      active = false
    }
  }, [])

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

  const onRefreshAppData = useCallback(async () => {
    if (isRefreshingAppData) return
    setIsRefreshingAppData(true)
    setUserMenuOpen(false)
    setMobileMenuOpen(false)
    clearAppDataCache()
    try {
      await checkApi()
    } catch {
      // Reloading after cache clear is still the safest recovery path.
    } finally {
      if (typeof window !== 'undefined') {
        window.location.reload()
      }
    }
  }, [checkApi, isRefreshingAppData])

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
    if (isRestoringSession) {
      setSessionWarningSeconds(null)
      return undefined
    }
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
  }, [currentUser?.tokenExpiresAt, isRestoringSession, onLogout])

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
      className={`app ${isLanding ? 'landing' : ''} ${isAuthPage ? 'app-auth' : ''} ${userMenuOpen ? 'menu-open' : ''} ${isTeamPage ? 'app-team' : ''} ${isFantasyHubPage || isAuctionHubPage ? 'is-fantasy-hub' : ''} ${isContestDetailPage ? 'is-contest-detail' : ''} ${isLeaderboardPage ? 'is-leaderboard-page' : ''} ${isCricketerStatsPage ? 'is-cricketer-stats-page' : ''} ${isCatalogPage ? 'is-catalog' : ''} ${isDashboardPage ? 'is-dashboard-page' : ''} ${isLowerContentPage ? 'app-lower-content' : ''} ${theme === 'dark' ? 'theme-dark' : 'theme-light'}`.trim()}
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
                to="/home?panel=joined"
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
            {!!currentUser && !isLanding && !isAuthPage && (
              <button
                type="button"
                className="ghost small topbar-refresh-trigger"
                onClick={onRefreshAppData}
                disabled={isRefreshingAppData}
                aria-label="Refresh app data"
                title="Refresh app data"
              >
                {isRefreshingAppData ? 'Refreshing...' : 'Refresh'}
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
            <div className="topbar-api-status">
              <ApiStatusDot
                ref={apiDotRef}
                apiBase={API_BASE}
                interval={0}
                onStatus={setApiStatus}
              />
              <span className="topbar-api-status-label">API</span>
            </div>
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
            <div className="mobile-nav-section">
              <div className="mobile-nav-section-links">
                <NavLink
                  to="/home?panel=joined"
                  className="leaderboard-link"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  Home
                </NavLink>
                <NavLink
                  to="/fantasy"
                  className="leaderboard-link"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  Fantasy
                </NavLink>
                <NavLink
                  to="/auction"
                  className="leaderboard-link"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  Auction
                </NavLink>
                <NavLink
                  to="/cricketer-stats"
                  className="leaderboard-link"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  Cricketer stats
                </NavLink>
                <NavLink
                  to="/profile"
                  className="leaderboard-link"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  Profile
                </NavLink>
                <NavLink
                  to="//home?panel=players"
                  className="leaderboard-link"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  Player Manager
                </NavLink>
                <NavLink
                  to="/change-password"
                  className="leaderboard-link"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  Change password
                </NavLink>
              </div>
            </div>
            {isAdminRole && (
              <div className="mobile-nav-section mobile-nav-section-admin">
                <p className="mobile-nav-section-title">Admin</p>
                <div className="mobile-nav-section-links">
                  {mobileAdminLinks.map((item) => (
                    <NavLink
                      key={item.to}
                      to={item.to}
                      className="leaderboard-link"
                      onClick={() => setMobileMenuOpen(false)}
                    >
                      {item.label}
                    </NavLink>
                  ))}
                </div>
              </div>
            )}
            {isMasterRole && (
              <div className="mobile-nav-section mobile-nav-section-master">
                <p className="mobile-nav-section-title">Master</p>
                <div className="mobile-nav-section-links">
                  {mobileMasterLinks.map((item) => (
                    <NavLink
                      key={item.to}
                      to={item.to}
                      className="leaderboard-link"
                      onClick={() => setMobileMenuOpen(false)}
                    >
                      {item.label}
                    </NavLink>
                  ))}
                </div>
              </div>
            )}
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
              Your session will expire in <strong>{sessionWarningSeconds}</strong>{' '}
              seconds.
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
        {showApiError && !isAuthPage && !isLanding && (
          <div className="app-api-failure-wrap">
            <ApiFailureTile
              title="API unavailable"
              message={
                checkingApi
                  ? `Checking API health... (Attempt ${Math.min(reconnectAttempt + 1, maxRetries)}/${maxRetries})`
                  : reconnectAttempt > 0
                    ? `Reconnect attempt ${Math.min(reconnectAttempt + 1, maxRetries)}/${maxRetries}.`
                    : 'Waiting for API to connect. Please retry.'
              }
              onRetry={() => checkApi(false)}
            />
          </div>
        )}
        {!showApiOnlyError && (
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/home" element={requireAuth(<Dashboard />)} />
            <Route
              path="/dashboard"
              element={requireAuth(<Navigate to="/home" replace />)}
            />
            <Route
              path="/login"
              element={currentUser ? <Navigate to="/home" replace /> : <Login />}
            />
            <Route
              path="/register"
              element={currentUser ? <Navigate to="/home" replace /> : <Register />}
            />
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
            <Route
              path="/team"
              element={requireAuth(<Navigate to="/fantasy" replace />)}
            />
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
        )}
      </main>
    </div>
  )
}

export default App
