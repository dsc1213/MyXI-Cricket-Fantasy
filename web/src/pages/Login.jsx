import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useNavigate } from 'react-router-dom'
import { login, API_BASE } from '../lib/api.js'
import ApiStatusDot from '../components/ui/ApiStatusDot.jsx'
import Button from '../components/ui/Button.jsx'
import { setStoredUser } from '../lib/auth.js'
import useApiHealthStatus from '../hooks/useApiHealthStatus.js'

function Login() {
  const navigate = useNavigate()
  const [userId, setUserId] = useState('')
  const [password, setPassword] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errorText, setErrorText] = useState('')

  const { apiStatus, setApiStatus, apiDotRef, checkingApi, checkApi } =
    useApiHealthStatus({
      autoRetry: false,
      checkDurationMs: 800,
      initialCheck: true,
    })
  const showApiStatusSection = apiStatus !== 'ok'

  const onSubmit = async (event) => {
    event.preventDefault()
    try {
      setIsSubmitting(true)
      setErrorText('')
      const data = await login({ userId, password })
      setStoredUser(data)
      navigate('/home', { replace: true })
    } catch (error) {
      if ((error.message || '').toLowerCase().includes('not approved')) {
        setStoredUser({
          userId,
          gameName: userId,
          email: userId.includes('@') ? userId : '',
          status: 'pending',
          role: 'user',
        })
        navigate('/pending')
        return
      }
      setErrorText(error.message || 'Login failed')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <section className="auth">
      {showApiStatusSection && (
        <div
          className="login-api-status-row"
          style={{
            position: 'absolute',
            right: 24,
            top: 18,
            zIndex: 10,
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}
        >
          <ApiStatusDot
            ref={apiDotRef}
            apiBase={API_BASE}
            interval={0}
            onStatus={setApiStatus}
          />
          <span style={{ fontSize: 13, color: '#888' }}>
            {apiStatus === 'fail' ? 'API unavailable' : 'Checking API...'}
          </span>
          <Button
            variant="secondary"
            size="small"
            className="api-status-refresh-btn"
            onClick={() => checkApi(false)}
            disabled={checkingApi}
            aria-label="Refresh API status"
          >
            Refresh
          </Button>
        </div>
      )}
      <div className="auth-panel">
        <h2>Welcome back</h2>
        <p>Login to manage your teams and tournaments.</p>
        <form className="form" onSubmit={onSubmit}>
          <label>
            User ID or Email
            <input
              type="text"
              placeholder="kiran11 or user@email.com"
              value={userId}
              onChange={(event) => setUserId(event.target.value)}
            />
          </label>
          <label>
            Password
            <input
              type="password"
              placeholder="********"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
          </label>
          {!!errorText && <p className="error-text">{errorText}</p>}
          <button type="submit" className="cta wide" disabled={isSubmitting}>
            {isSubmitting ? 'Signing in...' : 'Sign in'}
          </button>
        </form>
        <div className="form-footer">
          <span>Waiting for approval?</span>
          <Link to="/forgot-password" className="link-button">
            Forgot password
          </Link>
        </div>
      </div>
      <div className="auth-aside">
        <h3>Welcome back</h3>
        <p>
          Sign in to manage your teams, join tournaments, and view live score updates.
        </p>
      </div>
    </section>
  )
}

export default Login
