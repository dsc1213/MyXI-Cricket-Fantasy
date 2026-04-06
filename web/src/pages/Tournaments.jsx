import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { fetchContests, fetchTournaments } from '../lib/api.js'

const tournamentPalette = [
  '#0f7a67',
  '#2f66e9',
  '#b45309',
  '#7c3aed',
  '#be123c',
  '#0e7490',
]

function Tournaments() {
  const [isLoading, setIsLoading] = useState(true)
  const [errorText, setErrorText] = useState('')
  const [tournamentRows, setTournamentRows] = useState([])

  useEffect(() => {
    let active = true

    const load = async () => {
      try {
        setIsLoading(true)
        setErrorText('')
        const [tournaments, fantasyContests] = await Promise.all([
          fetchTournaments(),
          fetchContests({ game: 'Fantasy' }),
        ])
        if (!active) return
        const rows = tournaments.map((item) => ({
          ...item,
          contests: fantasyContests.filter((contest) => contest.tournamentId === item.id)
            .length,
        }))
        setTournamentRows(rows)
      } catch (error) {
        if (!active) return
        setErrorText(error.message || 'Failed to load tournaments')
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
  }, [])

  const getBadgeText = (name) => {
    const words = (name || '').split(' ').filter(Boolean)
    if (words.length === 1) return words[0].slice(0, 2).toUpperCase()
    return `${words[0][0] || ''}${words[1][0] || ''}`.toUpperCase()
  }

  return (
    <section className="team">
      <div className="section-head-compact">
        <h2>Tournaments</h2>
        {isLoading && <p className="team-note">Loading...</p>}
        {!!errorText && <p className="error-text">{errorText}</p>}
      </div>
      <div className="team-grid">
        {tournamentRows.map((tournament, index) => (
          <article
            className="team-card tournament-card"
            key={tournament.id}
            style={{
              '--tournament-color': tournamentPalette[index % tournamentPalette.length],
            }}
          >
            <div className="tournament-card-head">
              <div className="tournament-badge">{getBadgeText(tournament.name)}</div>
              <div>
                <h3>{tournament.name}</h3>
                <p className="team-note">{tournament.contests} contests available</p>
              </div>
            </div>
            <div className="top-actions">
              <Link to={`/tournaments/${tournament.id}`} className="ghost small">
                Open
              </Link>
              <Link
                to={`/tournaments/${tournament.id}/cricketer-stats`}
                className="leaderboard-link"
              >
                Stats
              </Link>
            </div>
          </article>
        ))}
      </div>
    </section>
  )
}

export default Tournaments
