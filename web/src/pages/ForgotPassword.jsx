import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { forgotPassword, resetPassword } from '../lib/api.js'

function ForgotPassword() {
  const navigate = useNavigate()
  const [identifier, setIdentifier] = useState('')
  const [token, setToken] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [isRequesting, setIsRequesting] = useState(false)
  const [isResetting, setIsResetting] = useState(false)
  const [errorText, setErrorText] = useState('')
  const [successText, setSuccessText] = useState('')

  const onRequestToken = async (event) => {
    event.preventDefault()
    try {
      setErrorText('')
      setSuccessText('')
      setIsRequesting(true)
      const data = await forgotPassword({ userId: identifier })
      setToken(data?.resetToken || '')
      setSuccessText(data?.message || 'If account exists, reset token generated.')
    } catch (error) {
      setErrorText(error.message || 'Failed to request reset token')
    } finally {
      setIsRequesting(false)
    }
  }

  const onReset = async (event) => {
    event.preventDefault()
    if (newPassword !== confirmPassword) {
      setErrorText('Password mismatch')
      return
    }
    try {
      setErrorText('')
      setSuccessText('')
      setIsResetting(true)
      await resetPassword({ token, newPassword })
      setSuccessText('Password updated. Redirecting to login...')
      setTimeout(() => navigate('/login'), 700)
    } catch (error) {
      setErrorText(error.message || 'Failed to reset password')
    } finally {
      setIsResetting(false)
    }
  }

  return (
    <section className="auth">
      <div className="auth-panel">
        <h2>Forgot password</h2>
        <p>Request reset token and set a new password.</p>
        <form className="form" onSubmit={onRequestToken}>
          <label>
            User ID or Email
            <input
              type="text"
              placeholder="kiran11 or user@email.com"
              value={identifier}
              onChange={(event) => setIdentifier(event.target.value)}
            />
          </label>
          <button type="submit" className="ghost small" disabled={isRequesting}>
            {isRequesting ? 'Requesting...' : 'Request reset token'}
          </button>
        </form>

        <form className="form" onSubmit={onReset}>
          <label>
            Reset token
            <input
              type="text"
              placeholder="Paste reset token"
              value={token}
              onChange={(event) => setToken(event.target.value)}
            />
          </label>
          <label>
            New password
            <input
              type="password"
              placeholder="New password"
              value={newPassword}
              onChange={(event) => setNewPassword(event.target.value)}
            />
          </label>
          <label>
            Confirm password
            <input
              type="password"
              placeholder="Confirm password"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
            />
          </label>
          {!!errorText && <p className="error-text">{errorText}</p>}
          {!!successText && <p className="success-text">{successText}</p>}
          <button type="submit" className="cta wide" disabled={isResetting}>
            {isResetting ? 'Updating...' : 'Update password'}
          </button>
        </form>
        <div className="form-footer">
          <span>Back to login</span>
          <Link to="/login" className="link-button">
            Login
          </Link>
        </div>
      </div>
      <div className="auth-aside">
        <h3>Mock reset flow</h3>
        <p>
          In this setup, reset token is returned directly from API to speed up QA and
          development.
        </p>
      </div>
    </section>
  )
}

export default ForgotPassword
