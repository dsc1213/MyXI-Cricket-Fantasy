import { useState } from 'react'
import { changePassword } from '../lib/api.js'
import { getStoredUser } from '../lib/auth.js'

function ChangePassword() {
  const stored = getStoredUser()
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [errorText, setErrorText] = useState('')
  const [successText, setSuccessText] = useState('')

  const onSubmit = async (event) => {
    event.preventDefault()
    if (!currentPassword || !newPassword || !confirmPassword) {
      setErrorText('All fields are required')
      return
    }
    if (newPassword !== confirmPassword) {
      setErrorText('New password and confirm password must match')
      return
    }
    try {
      setIsSaving(true)
      setErrorText('')
      setSuccessText('')
      await changePassword({
        actorUserId: stored?.id,
        actorRole: stored?.role,
        currentPassword,
        newPassword,
      })
      setSuccessText('Password updated')
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
    } catch (error) {
      setErrorText(error.message || 'Failed to update password')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <section className="auth">
      <div className="auth-panel">
        <h2>Change password</h2>
        <p>Update your password for better account security.</p>
        <form className="form" onSubmit={onSubmit}>
          <label>
            Current password
            <input
              type="password"
              placeholder="Current password"
              value={currentPassword}
              onChange={(event) => setCurrentPassword(event.target.value)}
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
            Confirm new password
            <input
              type="password"
              placeholder="Confirm new password"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
            />
          </label>
          {!!errorText && <p className="error-text">{errorText}</p>}
          {!!successText && <p className="success-text">{successText}</p>}
          <button type="submit" className="cta wide" disabled={isSaving}>
            {isSaving ? 'Updating...' : 'Update password'}
          </button>
        </form>
      </div>
      <div className="auth-aside">
        <h3>Password guide</h3>
        <p>Use at least 10 characters with a mix of letters, numbers, and symbols.</p>
      </div>
    </section>
  )
}

export default ChangePassword
