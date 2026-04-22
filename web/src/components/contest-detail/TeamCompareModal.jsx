import { getDisplayName } from '../../lib/displayName.js'
import Button from '../ui/Button.jsx'
import Modal from '../ui/Modal.jsx'

function CompareRoleBadge({ roleTag, variant }) {
  if (!roleTag) return null
  const roleClass = `is-${String(roleTag).toLowerCase()}`
  return (
    <span className={`team-compare-role-badge ${variant} ${roleClass}`.trim()}>
      {roleTag}
    </span>
  )
}

const getPointToneClass = (value) =>
  Number(value || 0) < 0 ? 'is-negative' : 'is-positive'

function ComparePointPill({ value, prefix = '', suffix = ' pts', tone = '' }) {
  const toneClass = tone || getPointToneClass(value)
  return (
    <strong className={`team-compare-point-pill ${toneClass}`}>
      {`${prefix}${Number(value || 0)}${suffix}`}
    </strong>
  )
}

function ComparePlayerCell({ player, roleVariant = 'mine' }) {
  return (
    <div className="team-compare-player-cell">
      <span>{player.name}</span>
      {!!player.team && <em>{player.team}</em>}
      <CompareRoleBadge roleTag={player.roleTag} variant={roleVariant} />
    </div>
  )
}

function CompareUniquePlayer({ player, roleVariant = 'mine' }) {
  return (
    <div className="team-compare-unique-player">
      <div>
        <span>{player.name}</span>
        {!!player.team && <em>{player.team}</em>}
        <CompareRoleBadge roleTag={player.roleTag} variant={roleVariant} />
      </div>
      <strong>{Number(player.points || 0)}</strong>
    </div>
  )
}

const sumPlayerPoints = (players = []) =>
  players.reduce((total, player) => total + Number(player?.points || 0), 0)

function getCompareStats(compareData = {}) {
  const normalizedCommon = []
  const roleMismatchMine = []
  const roleMismatchTheirs = []

  ;(compareData.common || []).forEach(({ mine, theirs }) => {
    if ((mine?.roleTag || '') === (theirs?.roleTag || '')) {
      normalizedCommon.push({ mine, theirs })
      return
    }
    roleMismatchMine.push(mine)
    roleMismatchTheirs.push(theirs)
  })

  const normalizedOnlyMine = [...(compareData.onlyMine || []), ...roleMismatchMine]
  const normalizedOnlyTheirs = [...(compareData.onlyTheirs || []), ...roleMismatchTheirs]
  const totalDiff = normalizedOnlyMine.length + normalizedOnlyTheirs.length
  const commonPoints = normalizedCommon.reduce(
    (total, row) => total + Number(row?.mine?.points || row?.theirs?.points || 0),
    0,
  )
  const myDiffPoints = sumPlayerPoints(normalizedOnlyMine)
  const opponentDiffPoints = sumPlayerPoints(normalizedOnlyTheirs)
  const pointDifference = myDiffPoints - opponentDiffPoints

  return {
    normalizedCommon,
    normalizedOnlyMine,
    normalizedOnlyTheirs,
    totalDiff,
    commonPoints,
    myDiffPoints,
    opponentDiffPoints,
    pointDifference,
  }
}

function TeamComparePanel({
  comparePlayer,
  compareData,
  isLoading = false,
  errorText = '',
  myName = 'Me',
}) {
  const opponentName = comparePlayer ? getDisplayName(comparePlayer) : 'Opponent'
  const {
    normalizedCommon,
    normalizedOnlyMine,
    normalizedOnlyTheirs,
    totalDiff,
    commonPoints,
    myDiffPoints,
    opponentDiffPoints,
  } = getCompareStats(compareData)
  const myDiffTone =
    myDiffPoints < opponentDiffPoints ? 'is-negative' : 'is-positive'
  const opponentDiffTone =
    opponentDiffPoints < myDiffPoints ? 'is-negative' : 'is-positive'
  return (
    <div className="team-compare-panel">
      {isLoading && <p className="team-note">Loading team comparison...</p>}
      {!!errorText && <p className="error-text">{errorText}</p>}
      {!isLoading && !errorText && (
        <>
          <section className="team-compare-section">
            <div className="team-compare-section-head">
              <h4>{`Common players (${normalizedCommon.length})`}</h4>
              <ComparePointPill value={commonPoints} />
            </div>
            <div className="team-compare-list">
              {normalizedCommon.length ? (
                <>
                  <div className="team-compare-common-head">
                    <span>{myName}</span>
                    <span>Pts</span>
                    <span>{opponentName}</span>
                  </div>
                  {normalizedCommon.map(({ mine, theirs }) => (
                    <div className="team-compare-common-row" key={mine.key}>
                      <ComparePlayerCell player={mine} roleVariant="mine" />
                      <strong className="team-compare-points">
                        {Number(mine.points || theirs.points || 0)}
                      </strong>
                      <ComparePlayerCell player={theirs} roleVariant="theirs" />
                    </div>
                  ))}
                </>
              ) : (
                <p className="team-note">No common players.</p>
              )}
            </div>
          </section>

          <section className="team-compare-section team-compare-diff-section">
            <div className="team-compare-section-head">
              <h4>{`Different players (${totalDiff})`}</h4>
            </div>
            <div className="team-compare-split">
              <div className="team-compare-diff-column">
                <h5>
                  <span>{`${myName} (${normalizedOnlyMine.length})`}</span>
                  <ComparePointPill value={myDiffPoints} tone={myDiffTone} />
                </h5>
                <div className="team-compare-list">
                  {normalizedOnlyMine.length ? (
                    normalizedOnlyMine.map((player) => (
                      <CompareUniquePlayer
                        key={player.key}
                        player={player}
                        roleVariant="mine"
                      />
                    ))
                  ) : (
                    <p className="team-note">No unique players.</p>
                  )}
                </div>
              </div>
              <div className="team-compare-diff-column">
                <h5>
                  <span>{`${opponentName} (${normalizedOnlyTheirs.length})`}</span>
                  <ComparePointPill
                    value={opponentDiffPoints}
                    tone={opponentDiffTone}
                  />
                </h5>
                <div className="team-compare-list">
                  {normalizedOnlyTheirs.length ? (
                    normalizedOnlyTheirs.map((player) => (
                      <CompareUniquePlayer
                        key={player.key}
                        player={player}
                        roleVariant="theirs"
                      />
                    ))
                  ) : (
                    <p className="team-note">No unique players.</p>
                  )}
                </div>
              </div>
            </div>
          </section>
        </>
      )}
    </div>
  )
}

function TeamCompareModal({
  comparePlayer,
  compareData,
  isLoading,
  errorText,
  myName,
  onClose,
}) {
  const { pointDifference } = getCompareStats(compareData)
  const pointDiffLabel =
    !isLoading && !errorText ? (
      <ComparePointPill value={pointDifference} prefix="Net " />
    ) : null
  return (
    <Modal
      open={Boolean(comparePlayer)}
      onClose={onClose}
      title={`Compare with: ${comparePlayer ? `${getDisplayName(comparePlayer)} ` : ''}`}
      titleMeta={pointDiffLabel}
      size="md"
      footer={
        <Button variant="ghost" size="small" onClick={onClose}>
          Close
        </Button>
      }
    >
      <TeamComparePanel
        comparePlayer={comparePlayer}
        compareData={compareData}
        isLoading={isLoading}
        errorText={errorText}
        myName={myName}
      />
    </Modal>
  )
}

export default TeamCompareModal
