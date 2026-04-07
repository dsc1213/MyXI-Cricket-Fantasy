import { useEffect, useMemo, useState } from 'react'
import PlayerIdentity from '../components/ui/PlayerIdentity.jsx'
import { fetchTeamPool, fetchUserPicks } from '../lib/api.js'
import { sortPlayersByDisplayRole } from '../lib/playerRoleSort.js'

function MyTeam() {
  const [players, setPlayers] = useState([])
  const [matchLabel, setMatchLabel] = useState('Match 1')
  const [tournamentName, setTournamentName] = useState('T20 World Cup 2026')
  const [errorText, setErrorText] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const sortedPlayers = useMemo(() => sortPlayersByDisplayRole(players), [players])

  useEffect(() => {
    let active = true
    const raw = localStorage.getItem('myxi-user')
    const currentUser = raw ? JSON.parse(raw) : null
    const userId = currentUser?.gameName || 'rahul-xi'

    const load = async () => {
      try {
        setIsLoading(true)
        setErrorText('')
        const [picksRes, poolRes] = await Promise.all([
          fetchUserPicks({
            userId,
            tournamentId: 't20wc-2026',
            contestId: 'huntercherry',
          }),
          fetchTeamPool({ contestId: 'huntercherry', matchId: 'm1' }),
        ])
        if (!active) return
        setPlayers(picksRes?.picksDetailed || [])
        setTournamentName(picksRes?.tournamentName || 'T20 World Cup 2026')
        setMatchLabel(poolRes?.activeMatch?.name || 'Match 1')
      } catch (error) {
        if (!active) return
        setErrorText(error.message || 'Failed to load team')
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

  return (
    <section className="team">
      <div className="admin-header">
        <div>
          <p className="eyebrow">Player</p>
          <h2>My team view</h2>
          <p className="lead">Selected tournament and saved XI for the active match.</p>
          {isLoading && <p className="team-note">Loading...</p>}
          {!!errorText && <p className="error-text">{errorText}</p>}
        </div>
      </div>

      <div className="team-grid">
        <article className="team-card">
          <h3>Tournament</h3>
          <div className="select-row">
            <span>{tournamentName}</span>
            <span className="badge light">{matchLabel}</span>
          </div>
        </article>

        <article className="team-card">
          <h3>Saved XI</h3>
          <div className="player-list">
            {sortedPlayers.map((player) => (
              <div className="player-row" key={player.name}>
                <div className="player-row-main">
                  <PlayerIdentity
                    name={player.name}
                    imageUrl={player.imageUrl || ''}
                    subtitle={player.role}
                  />
                </div>
                <small>{player.team}</small>
              </div>
            ))}
          </div>
        </article>
      </div>
    </section>
  )
}

export default MyTeam
