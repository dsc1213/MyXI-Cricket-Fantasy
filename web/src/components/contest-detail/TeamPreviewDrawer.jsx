import { useEffect } from 'react'
import { MatchLabel } from '../ui/CountryFlag.jsx'

function TeamPreviewDrawer({
  previewPlayer,
  activeMatch,
  previewXI,
  previewBackups,
  onClose,
}) {
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
            <h3>{previewPlayer ? `${previewPlayer.name} XI` : 'Team Preview'}</h3>
            {activeMatch && (
              <p>
                <MatchLabel home={activeMatch.home} away={activeMatch.away} value={activeMatch.name} />
              </p>
            )}
            {previewPlayer && <p>{`Points: ${previewPlayer.points}`}</p>}
          </div>
          <button type="button" className="ghost small" onClick={onClose}>
            Close
          </button>
        </div>
        <div className="team-preview-list">
          {previewXI.map((entry, index) => {
            const name = typeof entry === 'string' ? entry : entry?.name || `Player ${index + 1}`
            const points = typeof entry === 'object' ? Number(entry?.points || 0) : 0
            return (
              <div className="player-row team-preview-row" key={`${name}-${index}`}>
                <strong>{name}</strong>
                <span>{points}</span>
              </div>
            )
          })}
        </div>
        {!!previewBackups?.length && (
          <>
            <h4>Backups</h4>
            <div className="team-preview-list">
              {previewBackups.map((entry, index) => {
                const name =
                  typeof entry === 'string' ? entry : entry?.name || `Backup ${index + 1}`
                const points = typeof entry === 'object' ? Number(entry?.points || 0) : 0
                return (
                  <div className="player-row team-preview-row" key={`backup-${name}-${index}`}>
                    <strong>{name}</strong>
                    <span>{points}</span>
                  </div>
                )
              })}
            </div>
          </>
        )}
      </aside>
    </div>
  )
}

export default TeamPreviewDrawer
