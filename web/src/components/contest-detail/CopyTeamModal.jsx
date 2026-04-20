import Button from '../ui/Button.jsx'
import Modal from '../ui/Modal.jsx'

function CopyTeamModal({
  open = false,
  sources = [],
  selectedSourceId = '',
  playerMap = new Map(),
  isLoading = false,
  isSaving = false,
  errorText = '',
  onClose,
  onSelectSource,
  onSave,
}) {
  const selectedSource = sources.find(
    (source) => String(source.id) === String(selectedSourceId),
  )
  const previewXI = (selectedSource?.playingXi || [])
    .map((id) => playerMap.get(String(id)))
    .filter(Boolean)
  const previewBackups = (selectedSource?.backups || [])
    .map((id) => playerMap.get(String(id)))
    .filter(Boolean)

  return (
    <Modal
      open={open}
      onClose={() => {
        if (!isSaving) onClose?.()
      }}
      title="Copy team"
      size="md"
      footer={
        <Button variant="ghost" size="small" disabled={isSaving} onClick={onClose}>
          {sources.length > 0 ? 'Cancel' : 'Close'}
        </Button>
      }
    >
      {isLoading ? <p className="team-note">Loading teams...</p> : null}
      {errorText ? <p className="error-text">{errorText}</p> : null}
      {!isLoading && !errorText && sources.length === 0 ? (
        <p className="team-note">No saved team found for this match in other contests.</p>
      ) : null}
      {sources.length > 0 ? (
        <div className="copy-team-modal-scroll">
          <div className="copy-team-modal-grid">
            <div className="copy-team-source-list">
              {sources.map((source) => (
                <button
                  key={source.id}
                  type="button"
                  className={`copy-team-source-row ${String(source.id) === String(selectedSourceId) ? 'active' : ''}`}
                  disabled={isSaving}
                  onClick={() => onSelectSource?.(String(source.id))}
                >
                  <strong>{source.contestName || `Contest ${source.contestId}`}</strong>
                  <span>
                    {`${source.playingXi?.length || 0} players · ${source.backups?.length || 0} backups`}
                  </span>
                </button>
              ))}
            </div>
            <div className="copy-team-preview">
              <div className="copy-team-preview-head">
                <strong>{selectedSource?.contestName || 'Selected team'}</strong>
                <span>Read-only preview</span>
              </div>
              <CopyTeamPreviewSection
                title="Playing XI"
                players={previewXI}
                captainId={selectedSource?.captainId}
                viceCaptainId={selectedSource?.viceCaptainId}
              />
              {previewBackups.length > 0 ? (
                <CopyTeamPreviewSection title="Backups" players={previewBackups} />
              ) : null}
            </div>
          </div>
          <div className="copy-team-save-row">
            <Button
              variant="primary"
              size="small"
              disabled={!selectedSource || isSaving}
              onClick={onSave}
            >
              {isSaving ? 'Saving...' : 'Save copied team'}
            </Button>
          </div>
        </div>
      ) : null}
    </Modal>
  )
}

function CopyTeamPreviewSection({
  title,
  players = [],
  captainId = null,
  viceCaptainId = null,
}) {
  return (
    <div className="copy-team-preview-section">
      <h4>{title}</h4>
      <div className="copy-team-player-list">
        {players.map((player) => {
          const isCaptain = String(player.id) === String(captainId)
          const isViceCaptain = String(player.id) === String(viceCaptainId)
          return (
            <div key={player.id} className="copy-team-player-row">
              <span>{player.name}</span>
              <small>
                {player.team || ''}
                {isCaptain ? ' · C' : ''}
                {isViceCaptain ? ' · VC' : ''}
              </small>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default CopyTeamModal
