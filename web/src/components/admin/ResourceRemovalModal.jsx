import { useEffect, useMemo, useState } from 'react'
import Modal from '../ui/Modal.jsx'
import Button from '../ui/Button.jsx'

function ResourceRemovalModal({
  open,
  resourceId = '',
  resourceName = '',
  resourceLabel = 'resource',
  impactLabel = 'impact',
  impactRows = [],
  loadPreview,
  onClose,
  onConfirm,
  isSubmitting = false,
}) {
  const normalizeConfirmValue = (value = '') => value.toString().trim().toLowerCase()
  const [preview, setPreview] = useState(null)
  const [isLoadingPreview, setIsLoadingPreview] = useState(Boolean(open && resourceId))
  const [errorText, setErrorText] = useState('')
  const [typedValue, setTypedValue] = useState('')

  useEffect(() => {
    if (!open || !resourceId || typeof loadPreview !== 'function') return undefined
    let cancelled = false
    void loadPreview(resourceId)
      .then((payload) => {
        if (cancelled) return
        setPreview(payload || null)
        setErrorText('')
      })
      .catch((error) => {
        if (cancelled) return
        setErrorText(error.message || `Failed to load ${impactLabel}`)
      })
      .finally(() => {
        if (cancelled) return
        setIsLoadingPreview(false)
      })
    return () => {
      cancelled = true
    }
  }, [impactLabel, loadPreview, open, resourceId])

  const expectedName = useMemo(() => {
    const raw =
      preview?.contestName ||
      preview?.tournamentName ||
      preview?.userName ||
      preview?.name ||
      resourceName
    return String(raw || '').trim()
  }, [preview, resourceName])

  const isTypedMatch =
    normalizeConfirmValue(typedValue) === normalizeConfirmValue(expectedName)

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Remove ${resourceLabel}`}
      size="sm"
      footer={
        <>
          <Button variant="ghost" size="small" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="danger"
            size="small"
            disabled={isSubmitting || isLoadingPreview || !isTypedMatch || !expectedName}
            onClick={() => void onConfirm?.()}
          >
            {isSubmitting ? 'Removing...' : 'Remove'}
          </Button>
        </>
      }
    >
      <div className="remove-resource-modal">
        <p className="team-note">
          {`This hides the ${resourceLabel} from normal views and sends it to master review for final delete or restore.`}
        </p>
        {isLoadingPreview ? (
          <p className="team-note">{`Loading ${impactLabel}...`}</p>
        ) : null}
        {!!errorText && <p className="error-text">{errorText}</p>}
        {preview ? (
          <div className="remove-resource-summary">
            {impactRows.map((row) => (
              <div key={row.key} className="remove-resource-summary-row">
                <span>{row.label}</span>
                <strong>{row.render ? row.render(preview) : preview?.[row.key] || 0}</strong>
              </div>
            ))}
          </div>
        ) : null}
        <label className="create-contest-field remove-resource-confirm-field">
          <span>{`Type "${expectedName || resourceName}" to confirm`}</span>
          <input
            type="text"
            className="dashboard-text-input"
            value={typedValue}
            onChange={(event) => setTypedValue(event.target.value)}
          />
        </label>
      </div>
    </Modal>
  )
}

export default ResourceRemovalModal
