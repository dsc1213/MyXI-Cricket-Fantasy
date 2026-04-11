import PlayerLabel from './PlayerLabel.jsx'

const ROLE_LANES = ['WK', 'BAT', 'AR', 'BOWL']

function normalizePlayerRole(role = '') {
  const value = role.toString().trim().toUpperCase()
  if (value.includes('WICKET') || value === 'WK') return 'WK'
  if (value.includes('BOWL')) return 'BOWL'
  if (value.includes('ALL') || value === 'AR') return 'AR'
  if (value.includes('BAT')) return 'BAT'
  return 'BAT'
}

function formatRolePickLabel(name = '') {
  const parts = name.toString().trim().split(/\s+/).filter(Boolean)
  if (!parts.length) return ''
  if (parts.length === 1) return parts[0]
  const last = parts[parts.length - 1]
  const initials = parts
    .slice(0, -1)
    .map((part) => `${part[0]}.`)
    .join(' ')
  return `${initials} ${last}`.trim()
}

function buildTeamCounts(selected = []) {
  const counts = new Map()
  selected.forEach((player) => {
    const teamCode = (player?.team || player?.teamCode || '').toString().trim().toUpperCase()
    if (!teamCode) return
    counts.set(teamCode, (counts.get(teamCode) || 0) + 1)
  })
  return Array.from(counts.entries()).sort((a, b) => {
    if (b[1] !== a[1]) return b[1] - a[1]
    return a[0].localeCompare(b[0])
  })
}

function RightColumnContent({
  selected,
  counts,
  backups,
  captainId,
  viceCaptainId,
  onCaptainChange,
  onViceCaptainChange,
  validationMessage = '',
  disabled = false,
}) {
  const groupedSelected = selected.reduce(
    (acc, player) => {
      const lane = normalizePlayerRole(player?.role)
      acc[lane].push(player)
      return acc
    },
    {
      WK: [],
      BAT: [],
      AR: [],
      BOWL: [],
    },
  )
  const teamCounts = buildTeamCounts(selected)
  const captainPlayer = selected.find((player) => String(player.id) === String(captainId))
  const viceCaptainPlayer = selected.find((player) => String(player.id) === String(viceCaptainId))

  return (
    <>
      <aside className="myxi-card">
        <div className="myxi-header">
          <h3>MyXI Picks</h3>
          <span className="count-pill">{selected.length} / 11</span>
        </div>
        <div className="myxi-top">
          <div className="myxi-meta">
            <span>BAT: {counts.BAT}</span>
            <span>BOWL: {counts.BOWL}</span>
            <span>WK: {counts.WK}</span>
            <span>ALL: {counts.AR}</span>
          </div>
          {!!teamCounts.length && (
            <div className="myxi-team-meta">
              {teamCounts.map(([teamCode, total]) => (
                <span key={teamCode}>{`${teamCode} ${total}`}</span>
              ))}
            </div>
          )}
          <div className="myxi-role-selectors is-inline-actions">
            <div className="myxi-role-summary">
              <span className="myxi-role-summary-pill captain">
                {`C 2x: ${captainPlayer ? formatRolePickLabel(captainPlayer.name) : 'Not set'}`}
              </span>
              <span className="myxi-role-summary-pill vice-captain">
                {`VC 1.5x: ${viceCaptainPlayer ? formatRolePickLabel(viceCaptainPlayer.name) : 'Not set'}`}
              </span>
            </div>
            <p className="myxi-role-hint">Tap C or VC on a player card to assign roles.</p>
          </div>
          {!!validationMessage && <p className="myxi-validation">{validationMessage}</p>}
        </div>
        <div className="myxi-role-lanes">
          {selected.length === 0 && <p className="empty">No players selected</p>}
          {ROLE_LANES.map((lane) => {
            const lanePlayers = groupedSelected[lane]
            return (
              <section
                key={lane}
                className={`myxi-role-lane${lanePlayers.length ? '' : ' is-empty'}`}
                aria-label={`${lane} picks`}
                data-role-lane={lane}
              >
                <div className="myxi-role-lane-chips">
                  {lanePlayers.map((player) => (
                    <PlayerLabel
                      key={player.id}
                      player={player}
                      lineupStatus={player.lineupStatus || ''}
                      className="myxi-role-chip"
                      showTeam
                      roleControls={{
                        captainActive: String(player.id) === String(captainId),
                        viceCaptainActive: String(player.id) === String(viceCaptainId),
                        onCaptainClick: disabled
                          ? null
                          : () =>
                              onCaptainChange?.(
                                String(player.id) === String(captainId)
                                  ? null
                                  : String(player.id),
                              ),
                        onViceCaptainClick: disabled
                          ? null
                          : () =>
                              onViceCaptainChange?.(
                                String(player.id) === String(viceCaptainId)
                                  ? null
                                  : String(player.id),
                              ),
                      }}
                    />
                  ))}
                </div>
              </section>
            )
          })}
        </div>
      </aside>

      <div className="backups-card">
        <div className="backups-title">
          <h4>Backups</h4>
          <span className="backup-note">Select B to add</span>
        </div>
        <div className="backups-grid">
          {[...Array(6)].map((_, index) => {
            const player = backups[index]
            return player ? (
              <PlayerLabel
                key={`bb-${index}`}
                player={player}
                className="backup-chip"
                lineupStatus={player.lineupStatus || ''}
                showTeam
              />
            ) : (
              <div className="backup-chip empty" key={`bb-${index}`}>
                <span>Empty</span>
              </div>
            )
          })}
        </div>
      </div>
    </>
  )
}

export default RightColumnContent
