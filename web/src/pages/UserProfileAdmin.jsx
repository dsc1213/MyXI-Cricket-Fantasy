import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import Button from '../components/ui/Button.jsx'
import { fetchAdminUsers, updateAdminUser } from '../lib/api.js'
import { getStoredUser } from '../lib/auth.js'

function UserProfileAdmin() {
  const currentUser = getStoredUser()
  const { userId } = useParams()
  const [isLoading, setIsLoading] = useState(true)
  const [errorText, setErrorText] = useState('')
  const [notice, setNotice] = useState('')
  const [profile, setProfile] = useState(null)
  const [draft, setDraft] = useState({
    name: '',
    gameName: '',
    phone: '',
    location: '',
    email: '',
    status: 'active',
    role: 'user',
  })

  useEffect(() => {
    let active = true
    const load = async () => {
      try {
        setIsLoading(true)
        setErrorText('')
        const users = await fetchAdminUsers()
        if (!active) return
        const found = (users || []).find((row) => String(row.id) === String(userId))
        if (!found) {
          setErrorText('User not found')
          return
        }
        setProfile(found)
        setDraft({
          name: found.name || '',
          gameName: found.gameName || '',
          phone: found.phone || '',
          location: found.location || '',
          email: found.email || '',
          status: found.status || 'active',
          role: found.role || 'user',
        })
      } catch (error) {
        if (!active) return
        setErrorText(error.message || 'Failed to load user profile')
      } finally {
        if (active) setIsLoading(false)
      }
    }
    load()
    return () => {
      active = false
    }
  }, [userId])

  const joinedText = useMemo(() => {
    if (!profile?.joinedAt) return '-'
    return new Date(profile.joinedAt).toLocaleString()
  }, [profile?.joinedAt])

  const onSave = async () => {
    try {
      setErrorText('')
      setNotice('')
      const data = await updateAdminUser({
        id: userId,
        payload: {
          ...draft,
          actorUserId: currentUser?.gameName || currentUser?.email || currentUser?.id || '',
        },
      })
      setProfile(data)
      setNotice('Profile updated')
    } catch (error) {
      setErrorText(error.message || 'Failed to save profile')
    }
  }

  return (
    <section className="auth user-profile-admin-page">
      <div className="auth-panel user-profile-admin-panel">
        <div className="flow-breadcrumb">
          <Link to="/home">Home</Link>
          <span>/</span>
          <strong>User Profile</strong>
        </div>
        <h2>User profile</h2>
        <p>Admin can overwrite user details and role.</p>
        {isLoading && <p className="team-note">Loading user...</p>}
        {!!errorText && <p className="error-text">{errorText}</p>}
        {!!notice && <p className="success-text">{notice}</p>}
        {!isLoading && profile && (
          <form className="form" onSubmit={(event) => event.preventDefault()}>
            <label>
              Full name
              <input
                type="text"
                value={draft.name}
                onChange={(event) => setDraft((prev) => ({ ...prev, name: event.target.value }))}
              />
            </label>
            <label>
              Display name
              <input
                type="text"
                value={draft.gameName}
                onChange={(event) =>
                  setDraft((prev) => ({ ...prev, gameName: event.target.value }))
                }
              />
            </label>
            <label>
              Location
              <input
                type="text"
                value={draft.location}
                onChange={(event) =>
                  setDraft((prev) => ({ ...prev, location: event.target.value }))
                }
              />
            </label>
            <label>
              Phone
              <input
                type="tel"
                value={draft.phone}
                onChange={(event) => setDraft((prev) => ({ ...prev, phone: event.target.value }))}
              />
            </label>
            <label>
              Email
              <input
                type="email"
                value={draft.email}
                onChange={(event) => setDraft((prev) => ({ ...prev, email: event.target.value }))}
              />
            </label>
            <label>
              Status
              <select
                value={draft.status}
                onChange={(event) => setDraft((prev) => ({ ...prev, status: event.target.value }))}
              >
                <option value="active">Active</option>
                <option value="pending">Pending</option>
                <option value="rejected">Rejected</option>
              </select>
            </label>
            <label>
              Role
              <select
                value={draft.role}
                onChange={(event) => setDraft((prev) => ({ ...prev, role: event.target.value }))}
              >
                <option value="user">Player (default)</option>
                <option value="contest_manager">Score manager</option>
                <option value="admin">Admin</option>
                <option value="master_admin">Master admin</option>
              </select>
            </label>
            <Button variant="primary" size="small" onClick={onSave}>
              Save
            </Button>
          </form>
        )}
      </div>
      <div className="auth-aside user-profile-admin-aside">
        <h3>User info</h3>
        <p>{`User ID: ${profile?.id || '-'}`}</p>
        <p>{`Joined: ${joinedText}`}</p>
        <p>{`Current role: ${profile?.role || '-'}`}</p>
      </div>
    </section>
  )
}

export default UserProfileAdmin
