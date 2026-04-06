import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { clearStoredAuth, getStoredUser, setStoredUser } from '../lib/auth.js'
import { fetchAccountStatus } from '../lib/api.js'

function Pending() {
  const navigate = useNavigate()
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [message, setMessage] = useState('')

  const onRefreshStatus = async () => {
    const current = getStoredUser()
    const userId = current?.userId || current?.gameName || current?.email || ''
    if (!userId) {
      setMessage('No logged-in user found. Please login again.')
      navigate('/login')
      return
    }

    try {
      setIsRefreshing(true)
      setMessage('')
      const latest = await fetchAccountStatus({ userId })
      setStoredUser({
        ...current,
        ...latest,
      })
      const status = (latest?.status || '').toString().toLowerCase()
      if (status && status !== 'pending') {
        clearStoredAuth()
        navigate('/login')
        return
      }
      setMessage('Still pending. Please check again shortly.')
    } catch (error) {
      setMessage(error?.message || 'Failed to refresh status')
    } finally {
      setIsRefreshing(false)
    }
  }

  return (
    <section className="pending">
      <div className="pending-card">
        <h2>Approval pending</h2>
        <p>
          Your request is with the master admin. You will be able to join tournaments once
          approved.
        </p>
        <div className="pending-meta">
          <div>
            <span>Status</span>
            <strong>Awaiting review</strong>
          </div>
          <div>
            <span>Next check</span>
            <strong>Every 10 minutes</strong>
          </div>
        </div>
        <button
          type="button"
          className="ghost wide"
          onClick={onRefreshStatus}
          disabled={isRefreshing}
        >
          {isRefreshing ? 'Refreshing...' : 'Refresh status'}
        </button>
        {!!message && <p className="error-text">{message}</p>}
      </div>
    </section>
  )
}

export default Pending
