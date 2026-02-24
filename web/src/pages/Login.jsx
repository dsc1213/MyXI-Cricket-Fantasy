import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useNavigate } from 'react-router-dom'
import { login } from '../lib/api.js'
import { setStoredUser } from '../lib/auth.js'

function Login() {
  const navigate = useNavigate()
  const [userId, setUserId] = useState('kiran11')
  const [password, setPassword] = useState('demo123')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errorText, setErrorText] = useState('')

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
