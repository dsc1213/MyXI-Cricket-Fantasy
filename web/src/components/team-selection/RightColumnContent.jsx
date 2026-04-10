import PlayerLabel from './PlayerLabel.jsx'
import SelectField from '../ui/SelectField.jsx'

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
  const selectedOptions = selected.map((player) => ({
    value: String(player.id),
    label: formatRolePickLabel(player.name),
  }))
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
          <div className="myxi-role-selectors">
            <label className="myxi-role-field">
              <span>C</span>
              <SelectField
                value={captainId == null ? '' : String(captainId)}
                onChange={(event) => onCaptainChange?.(event.target.value || null)}
                disabled={disabled || selected.length === 0}
                className="myxi-role-select"
              >
                <option value="">Select C</option>
                {selectedOptions.map((option) => (
                  <option
                    key={`captain-${option.value}`}
                    value={option.value}
                    disabled={
                      viceCaptainId != null &&
                      String(viceCaptainId) === String(option.value)
                    }
                  >
                    {option.label}
                  </option>
                ))}
              </SelectField>
            </label>
            <label className="myxi-role-field">
              <span>VC</span>
              <SelectField
                value={viceCaptainId == null ? '' : String(viceCaptainId)}
                onChange={(event) => onViceCaptainChange?.(event.target.value || null)}
                disabled={disabled || selected.length === 0}
                className="myxi-role-select"
              >
                <option value="">Select VC</option>
                {selectedOptions.map((option) => (
                  <option
                    key={`vice-${option.value}`}
                    value={option.value}
                    disabled={
                      captainId != null && String(captainId) === String(option.value)
                    }
                  >
                    {option.label}
                  </option>
                ))}
              </SelectField>
            </label>
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
