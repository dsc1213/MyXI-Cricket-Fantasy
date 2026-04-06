import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { fetchContests, fetchTournaments } from '../lib/api.js'
import TournamentPageTabs from '../components/TournamentPageTabs.jsx'

function TournamentContests() {
  const { tournamentId } = useParams()
  const [isLoading, setIsLoading] = useState(true)
  const [errorText, setErrorText] = useState('')
  const [tournamentName, setTournamentName] = useState(tournamentId)
  const [tournamentContests, setTournamentContests] = useState([])

  useEffect(() => {
    let active = true

    const load = async () => {
      try {
        setIsLoading(true)
        setErrorText('')
        const [tournaments, contests] = await Promise.all([
          fetchTournaments(),
          fetchContests({ game: 'Fantasy', tournamentId }),
        ])
        if (!active) return
        const tournament = tournaments.find((item) => item.id === tournamentId)
        setTournamentName(tournament?.name || tournamentId)
        setTournamentContests(contests)
      } catch (error) {
        if (!active) return
        setErrorText(error.message || 'Failed to load contests')
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
  }, [tournamentId])

  return (
    <section className="team">
      <div className="flow-breadcrumb">
        <Link to="/fantasy">Fantasy</Link>
        <span>/</span>
        <strong>{tournamentName}</strong>
      </div>
      <div className="section-head-compact">
        <h2>{tournamentName}</h2>
        {isLoading && <p className="team-note">Loading...</p>}
        {!!errorText && <p className="error-text">{errorText}</p>}
      </div>
      <TournamentPageTabs tournamentId={tournamentId} />
      <div className="team-grid">
        {tournamentContests.map((contest) => (
          <article className="team-card" key={contest.id}>
            <h3>{contest.name}</h3>
            <p className="team-note">{contest.teams} joined players</p>
            <div className="top-actions">
              <Link
                className="cta small"
                to={`/tournaments/${tournamentId}/contests/${contest.id}`}
              >
                Open contest
              </Link>
              <Link
                className="ghost small"
                to={`/tournaments/${tournamentId}/contests/${contest.id}/leaderboard`}
              >
                Leaderboard
              </Link>
            </div>
          </article>
        ))}
      </div>
    </section>
  )
}

export default TournamentContests
