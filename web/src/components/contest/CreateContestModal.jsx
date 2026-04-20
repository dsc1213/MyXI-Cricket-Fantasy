import Button from '../ui/Button.jsx'
import Modal from '../ui/Modal.jsx'
import PlayingXiModalLink from '../ui/PlayingXiModalLink.jsx'
import SelectField from '../ui/SelectField.jsx'
import { formatCompactMatchLabel } from '../../lib/matchLabels.js'

const formatLocalMatchOptionDate = (value) => {
  const raw = (value || '').toString().trim()
  if (!raw) return 'Manual'
  const parsed = new Date(raw)
  if (Number.isNaN(parsed.getTime())) return raw
  return parsed.toLocaleString(undefined, {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
    timeZoneName: 'short',
  })
}

function CreateContestModal({
  open,
  onClose,
  onCreate,
  isSaving = false,
  tournaments = [],
  form,
  onChangeForm,
  matchOptions = [],
  selectedMatchIds = [],
  onChangeSelectedMatchIds,
  isLoadingMatches = false,
  lockedTournamentId = '',
}) {
  const tournamentId = lockedTournamentId || form.tournamentId || ''
  const normalizedSelectedMatchIds = selectedMatchIds.map((id) => String(id))
  const canCreateWithMatches = normalizedSelectedMatchIds.length > 0
  const updateForm = (patch) => onChangeForm?.({ ...form, ...patch })

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Create contest"
      size="md"
      closeOnBackdrop={false}
      footer={
        <>
          <Button variant="ghost" size="small" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="primary"
            size="small"
            disabled={
              isSaving ||
              isLoadingMatches ||
              !form.name ||
              !tournamentId ||
              Number(form.teams || 0) < 2 ||
              !canCreateWithMatches
            }
            onClick={onCreate}
          >
            {isSaving ? 'Creating...' : 'Create'}
          </Button>
        </>
      }
    >
      <div className="create-contest-form">
        <label className="create-contest-field">
          <span>Tournament</span>
          <SelectField
            className="create-contest-input"
            value={tournamentId}
            disabled={Boolean(lockedTournamentId)}
            onChange={(event) => updateForm({ tournamentId: event.target.value })}
            options={[
              { value: '', label: 'Select tournament' },
              ...tournaments.map((item) => ({ value: item.id, label: item.name })),
            ]}
          />
        </label>
        <label className="create-contest-field">
          <span>Contest name</span>
          <input
            className="create-contest-input"
            type="text"
            value={form.name}
            onChange={(event) => updateForm({ name: event.target.value })}
          />
        </label>
        <label className="create-contest-field">
          <span>Max players</span>
          <input
            className="create-contest-input"
            type="number"
            min="2"
            value={form.teams}
            onChange={(event) => updateForm({ teams: Number(event.target.value || 0) })}
          />
          {Number(form.teams || 0) > 0 && Number(form.teams || 0) < 2 ? (
            <small className="error-text">Max players must be at least 2.</small>
          ) : null}
        </label>
        <label className="create-contest-field">
          <span>Starts at</span>
          <input
            className="create-contest-input"
            type="datetime-local"
            value={form.startAt}
            onChange={(event) => updateForm({ startAt: event.target.value })}
          />
          <small className="team-note">
            Leave empty to keep the contest open until an admin starts it manually.
          </small>
        </label>
        <div className="create-contest-field create-contest-matches-field">
          <span>Matches in this contest</span>
          <div className="create-contest-match-actions">
            <Button
              variant="ghost"
              size="small"
              disabled={!matchOptions.length}
              onClick={() =>
                onChangeSelectedMatchIds?.(matchOptions.map((item) => String(item.id)))
              }
            >
              Select all
            </Button>
            <Button
              variant="ghost"
              size="small"
              disabled={!selectedMatchIds.length}
              onClick={() => onChangeSelectedMatchIds?.([])}
            >
              Clear
            </Button>
            <small className="team-note">
              Selected {selectedMatchIds.length} / {matchOptions.length}
            </small>
          </div>
          <div
            className="create-contest-match-grid"
            role="group"
            aria-label="Contest matches"
          >
            {isLoadingMatches ? (
              <p className="team-note">Loading matches...</p>
            ) : matchOptions.length ? (
              matchOptions.map((match) => {
                const matchId = String(match.id)
                const checked = normalizedSelectedMatchIds.includes(matchId)
                return (
                  <label key={matchId} className="create-contest-match-row">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={(event) => {
                        onChangeSelectedMatchIds?.(
                          event.target.checked
                            ? normalizedSelectedMatchIds.includes(matchId)
                              ? normalizedSelectedMatchIds
                              : [...normalizedSelectedMatchIds, matchId]
                            : normalizedSelectedMatchIds.filter((id) => id !== matchId),
                        )
                      }}
                    />
                    <span>
                      {formatCompactMatchLabel(match)}
                      <small>
                        {formatLocalMatchOptionDate(match.startAt || match.date)} -{' '}
                        {match.status}
                      </small>
                      <PlayingXiModalLink
                        tournamentId={tournamentId}
                        matchId={match.id}
                        className="inline-playing-xi-link"
                      />
                    </span>
                  </label>
                )
              })
            ) : (
              <p className="team-note">No matches available for this tournament.</p>
            )}
          </div>
        </div>
      </div>
    </Modal>
  )
}

export default CreateContestModal
