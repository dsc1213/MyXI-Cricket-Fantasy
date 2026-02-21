import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { fetchUserPicks } from '../lib/api.js'

function TournamentUserPage() {
  const { tournamentId, contestId, userId } = useParams()
  const [picks, setPicks] = useState([])
  const [tournamentName, setTournamentName] = useState(tournamentId)
  const [errorText, setErrorText] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const userName = userId ? userId.replace(/-/g, ' ') : 'User'

  useEffect(() => {
    let active = true

    const load = async () => {
      try {
        setIsLoading(true)
        setErrorText('')
        const data = await fetchUserPicks({ userId, tournamentId, contestId })
        if (!active) return
        setPicks(data?.picks || [])
        setTournamentName(data?.tournamentName || tournamentId)
      } catch (error) {
        if (!active) return
        setErrorText(error.message || 'Failed to load user picks')
      } finally {
        if (active) {
          setIsLoading(false)
        }
      }
    }

    load()
    return () => {
      active = false
    }
  }, [userId, tournamentId, contestId])

  return (
    <section className="team">
      <div className="admin-header">
        <div>
          <p className="eyebrow">Player View</p>
          <h2>{userName}</h2>
          <p className="lead">
            {tournamentName || tournamentId}
            {contestId ? ` • ${contestId}` : ''}
            {' • Saved XI'}
          </p>
          {isLoading && <p className="team-note">Loading...</p>}
          {!!errorText && <p className="error-text">{errorText}</p>}
        </div>
        <Link
          className="ghost small"
          to={
            contestId
              ? `/tournaments/${tournamentId}/contests/${contestId}/leaderboard`
              : '/leaderboard'
          }
        >
          Back to leaderboard
        </Link>
      </div>

      <div className="team-grid">
        <article className="team-card">
          <h3>Selected XI</h3>
          <div className="player-list">
            {picks.map((name) => (
              <div className="player-row" key={name}>
                <strong>{name}</strong>
              </div>
            ))}
          </div>
        </article>
      </div>
    </section>
  )
}

export default TournamentUserPage
