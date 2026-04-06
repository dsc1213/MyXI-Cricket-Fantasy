import { useState } from 'react'
import { updateUserProfile } from '../lib/api.js'
import { getStoredUser, setStoredUser } from '../lib/auth.js'

function Profile() {
  const stored = getStoredUser()
  const [form, setForm] = useState({
    name: stored?.name || '',
    gameName: stored?.userId || stored?.gameName || '',
    role: stored?.role || 'user',
    email: stored?.email || '',
    phone: stored?.phone || '',
    location: stored?.location || '',
  })
  const [isSaving, setIsSaving] = useState(false)
  const [errorText, setErrorText] = useState('')
  const [successText, setSuccessText] = useState('')

  const update = (key, value) => setForm((prev) => ({ ...prev, [key]: value }))
  const onSave = async (event) => {
    event.preventDefault()
    if (!stored?.id) {
      setErrorText('Login required')
      return
    }
    try {
      setIsSaving(true)
      setErrorText('')
      setSuccessText('')
      const updated = await updateUserProfile({
        id: stored.id,
        payload: {
          actorUserId: stored.id,
          actorRole: stored.role,
          name: form.name,
          gameName: form.gameName,
          email: form.email,
          phone: form.phone,
          location: form.location,
        },
      })
      setStoredUser({
        ...stored,
        ...updated,
      })
      setForm((prev) => ({
        ...prev,
        role: updated?.role || stored?.role || prev.role,
      }))
      setSuccessText('Profile updated')
    } catch (error) {
      setErrorText(error.message || 'Failed to update profile')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <section className="auth">
      <div className="auth-panel">
        <h2>Player profile</h2>
        <p>Update your name, display name, and player details.</p>
        <form className="form" onSubmit={onSave}>
          <label>
            Full name
            <input
              type="text"
              value={form.name}
              onChange={(event) => update('name', event.target.value)}
            />
          </label>
          <label>
            Display name
            <input
              type="text"
              value={form.gameName}
              onChange={(event) => update('gameName', event.target.value)}
            />
          </label>
          <label>
            Role
            <input type="text" value={form.role} disabled />
          </label>
          <label>
            Email
            <input
              type="email"
              value={form.email}
              onChange={(event) => update('email', event.target.value)}
            />
          </label>
          <label>
            Phone
            <input
              type="tel"
              value={form.phone}
              onChange={(event) => update('phone', event.target.value)}
            />
          </label>
          <label>
            Location
            <input
              type="text"
              value={form.location}
              onChange={(event) => update('location', event.target.value)}
            />
          </label>
          {!!errorText && <p className="error-text">{errorText}</p>}
          {!!successText && <p className="success-text">{successText}</p>}
          <button type="submit" className="cta wide" disabled={isSaving}>
            {isSaving ? 'Saving...' : 'Save profile'}
          </button>
        </form>
      </div>
      <div className="auth-aside">
        <h3>Profile tips</h3>
        <p>Display name is used in contest leaderboards and player pages.</p>
      </div>
    </section>
  )
}

export default Profile
