import { useMemo, useState } from 'react'
import { fetchTeamPool } from '../../lib/api.js'
import Modal from './Modal.jsx'
import PlayerIdentity from './PlayerIdentity.jsx'

const normalizeNameKey = (value = '') =>
  String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')

const defaultRenderScore = () => ''

function buildLineupRows(team = {}, renderScore = defaultRenderScore) {
  const players = Array.isArray(team?.players) ? team.players : []
  const playingXI = Array.isArray(team?.lineup?.playingXI) ? team.lineup.playingXI : []
  const playersByName = new Map(
    players.map((player) => [normalizeNameKey(player?.name), player]),
  )

  return playingXI.map((name, index) => {
    const matched = playersByName.get(normalizeNameKey(name)) || null
    return {
      id: matched?.id || `${normalizeNameKey(name)}-${index}`,
      name: matched?.name || name,
      imageUrl: matched?.imageUrl || '',
      scoreText: renderScore(matched || { name }),
    }
  })
}

function PlayingXiModalLink({
  tournamentId = '',
  matchId = '',
  label = 'Show Playing XI',
  className = '',
  teams = null,
  renderScore = defaultRenderScore,
  disabled = false,
}) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [errorText, setErrorText] = useState('')
  const [loadedTeams, setLoadedTeams] = useState(null)

  const activeTeams = teams || loadedTeams

  const teamCards = useMemo(() => {
    const teamA = activeTeams?.teamA || { name: 'Team A', players: [], lineup: null }
    const teamB = activeTeams?.teamB || { name: 'Team B', players: [], lineup: null }
    return [
      {
        key: 'teamA',
        name: teamA.name || 'Team A',
        rows: buildLineupRows(teamA, renderScore),
      },
      {
        key: 'teamB',
        name: teamB.name || 'Team B',
        rows: buildLineupRows(teamB, renderScore),
      },
    ]
  }, [activeTeams, renderScore])

  const handleOpen = async () => {
    if (disabled || !tournamentId || !matchId) return
    setOpen(true)
    if (teams || loadedTeams) return
    try {
      setLoading(true)
      setErrorText('')
      const response = await fetchTeamPool({ tournamentId, matchId })
      setLoadedTeams(response?.teams || null)
    } catch (error) {
      setErrorText(error.message || 'Failed to load Playing XI')
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <button
        type="button"
        className={`playing-xi-link ${className}`.trim()}
        onClick={handleOpen}
        disabled={disabled || !tournamentId || !matchId}
      >
        {label}
      </button>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Playing XI"
        size="md"
        className="playing-xi-modal"
      >
        {loading ? (
          <p className="team-note">Loading Playing XI...</p>
        ) : errorText ? (
          <div className="json-upload-diagnostics" role="alert">
            <h5>Could Not Load Playing XI</h5>
            <p>{errorText}</p>
          </div>
        ) : (
          <div className="playing-xi-grid">
            {teamCards.map((team) => (
              <section key={team.key} className="playing-xi-card">
                <header className="playing-xi-card-head">
                  <h4>{team.name}</h4>
                  <span>{`${team.rows.length} selected`}</span>
                </header>
                {team.rows.length ? (
                  <ul className="playing-xi-list">
                    {team.rows.map((row) => (
                      <li key={row.id}>
                        <PlayerIdentity
                          name={row.name}
                          imageUrl={row.imageUrl}
                          className="manual-player-identity dense"
                          size="sm"
                        />
                        {row.scoreText ? (
                          <span className="playing-xi-score-chip">{row.scoreText}</span>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="team-note">No Playing XI available for this match.</p>
                )}
              </section>
            ))}
          </div>
        )}
      </Modal>
    </>
  )
}

export default PlayingXiModalLink
