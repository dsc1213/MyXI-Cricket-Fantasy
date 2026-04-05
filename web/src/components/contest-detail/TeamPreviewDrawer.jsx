import { useEffect } from 'react'
import { MatchLabel } from '../ui/CountryFlag.jsx'
import PlayerAvatar from '../ui/PlayerAvatar.jsx'

function TeamPreviewDrawer({
  contestMode = '',
  previewPlayer,
  activeMatch,
  previewXI,
  previewBackups,
  isLoading = false,
  onClose,
}) {
  const isFixedRosterContest = contestMode === 'fixed_roster'
  useEffect(() => {
    document.body.classList.toggle('team-preview-open', !!previewPlayer)
    return () => document.body.classList.remove('team-preview-open')
  }, [previewPlayer])

  return (
    <div
      className={`team-preview-drawer ${previewPlayer ? 'open' : ''}`.trim()}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <aside className="team-preview-panel solid">
        <div className="team-preview-head">
          <div>
            <h3>
              {previewPlayer
                ? `${previewPlayer.name} ${isFixedRosterContest ? 'roster' : 'XI'}`
                : 'Team Preview'}
            </h3>
            {activeMatch && (
              <p>
                <MatchLabel home={activeMatch.home} away={activeMatch.away} value={activeMatch.name} />
              </p>
            )}
            {previewPlayer && <p>{`Points: ${previewPlayer.points}`}</p>}
            {isFixedRosterContest && <p>Leaderboard counts the top 11 scoring roster players.</p>}
          </div>
          <button type="button" className="ghost small" onClick={onClose}>
            Close
          </button>
        </div>
        <div className="team-preview-sections">
          <section className="team-preview-section team-preview-section-primary">
            <div className="team-preview-list">
              {isLoading && <p className="team-note">Loading team preview...</p>}
              {!isLoading && isFixedRosterContest && !previewXI.length && (
                <p className="team-note">No owned players are involved in this match.</p>
              )}
              {!isLoading && !isFixedRosterContest && !previewXI.length && (
                <p className="team-note">No saved lineup found for this match.</p>
              )}
              {!isLoading && previewXI.map((entry, index) => {
                const name = typeof entry === 'string' ? entry : entry?.name || `Player ${index + 1}`
                const points = typeof entry === 'object' ? Number(entry?.points || 0) : 0
                return (
                  <div className="player-row team-preview-row" key={`${name}-${index}`}>
                    <div className="player-row-main">
                      <PlayerAvatar name={name} imageUrl={typeof entry === 'object' ? entry?.imageUrl || '' : ''} />
                      <strong>{name}</strong>
                    </div>
                    <span>{points}</span>
                  </div>
                )
              })}
            </div>
          </section>
          {!isLoading && !!previewBackups?.length && (
            <section className="team-preview-section team-preview-section-backups">
              <h4>{isFixedRosterContest ? 'Other owned players' : 'Backups'}</h4>
              <div className="team-preview-list">
                {previewBackups.map((entry, index) => {
                  const name =
                    typeof entry === 'string' ? entry : entry?.name || `Backup ${index + 1}`
                  const points = typeof entry === 'object' ? Number(entry?.points || 0) : 0
                  return (
                    <div className="player-row team-preview-row" key={`backup-${name}-${index}`}>
                      <div className="player-row-main">
                        <PlayerAvatar
                          name={name}
                          imageUrl={typeof entry === 'object' ? entry?.imageUrl || '' : ''}
                        />
                        <strong>{name}</strong>
                      </div>
                      <span>{points}</span>
                    </div>
                  )
                })}
              </div>
            </section>
          )}
        </div>
      </aside>
    </div>
  )
}

export default TeamPreviewDrawer
