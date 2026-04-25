import Modal from '../ui/Modal.jsx'
import Button from '../ui/Button.jsx'

function SaveToContestsModal({
  open,
  onClose,
  onConfirm,
  contests = [],
  selectedContestIds = new Set(),
  onToggleContest = null,
  isSaving = false,
}) {
  const contestCount =
    Array.isArray(contests) && selectedContestIds instanceof Set
      ? contests.filter((contest) => selectedContestIds.has(String(contest.id))).length
      : 0

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Save to joined contests"
      size="sm"
      footer={
        <>
          <Button type="button" variant="ghost" onClick={onClose} disabled={isSaving}>
            Cancel
          </Button>
          <Button
            type="button"
            variant="primary"
            onClick={onConfirm}
            disabled={isSaving || contestCount === 0}
          >
            {isSaving
              ? 'Saving...'
              : `Save to ${contestCount} contest${contestCount === 1 ? '' : 's'}`}
          </Button>
        </>
      }
    >
      <div className="save-all-confirm-copy">
        <p>
          Save this XI to your current contest and the other joined contests for this
          match?
        </p>
        <div className="save-all-confirm-list">
          {(contests || []).map((contest) => (
            <div key={contest.id} className="save-all-confirm-row">
              <label className="save-all-confirm-check">
                <input
                  type="checkbox"
                  checked={selectedContestIds.has(String(contest.id))}
                  onChange={() => onToggleContest?.(contest.id)}
                  disabled={isSaving}
                />
                <div className="save-all-confirm-copy-block">
                  <strong>{contest.name || `Contest ${contest.id}`}</strong>
                  <span>
                    {contest.id === contests[0]?.id ? 'Current contest' : 'Also update'}
                  </span>
                </div>
              </label>
            </div>
          ))}
        </div>
      </div>
    </Modal>
  )
}

export default SaveToContestsModal
