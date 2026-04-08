import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import Button from './Button.jsx'

function JsonAssistantModal({
  open,
  ariaLabel,
  title,
  description,
  jsonLabel = 'JSON',
  jsonText = '',
  jsonFallback = '{\n}\n',
  onCopyJson,
  copyJsonLabel = 'Copy JSON',
  disableCopyJson = false,
  promptLabel = 'AI Prompt',
  promptText = '',
  onCopyPrompt,
  copyPromptLabel = 'Copy AI Prompt',
  disableCopyPrompt = false,
  footerActions = [],
  onClose = null,
}) {
  useEffect(() => {
    if (!open) return undefined
    document.body.classList.add('app-modal-open')
    const onEsc = (event) => {
      if (event.key === 'Escape') onClose?.()
    }
    document.addEventListener('keydown', onEsc)
    return () => {
      document.body.classList.remove('app-modal-open')
      document.removeEventListener('keydown', onEsc)
    }
  }, [open, onClose])

  if (!open) return null

  if (typeof document === 'undefined') return null

  return createPortal(
    <div
      className="score-preview-modal-backdrop"
      role="presentation"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose?.()
      }}
    >
      <div
        className="score-preview-modal"
        role="dialog"
        aria-modal="true"
        aria-label={ariaLabel}
      >
        <div className="score-preview-modal-head">
          <h4>{title}</h4>
          <p>{description}</p>
        </div>

        <section className="score-preview-block score-preview-block-json">
          <div className="score-preview-block-head">
            <span>{jsonLabel}</span>
            {!!onCopyJson && (
              <Button
                type="button"
                variant="ghost"
                size="small"
                onClick={onCopyJson}
                disabled={disableCopyJson}
              >
                {copyJsonLabel}
              </Button>
            )}
          </div>
          <textarea
            className="score-preview-textarea"
            value={jsonText || jsonFallback}
            readOnly
          />
        </section>

        {promptText ? (
          <section className="score-preview-block score-preview-block-prompt">
            <div className="score-preview-block-head">
              <span>{promptLabel}</span>
              {!!onCopyPrompt && (
                <Button
                  type="button"
                  variant="ghost"
                  size="small"
                  onClick={onCopyPrompt}
                  disabled={disableCopyPrompt}
                >
                  {copyPromptLabel}
                </Button>
              )}
            </div>
            <textarea
              className="score-preview-textarea score-preview-textarea-prompt"
              value={promptText}
              readOnly
            />
          </section>
        ) : null}

        <div className="score-preview-modal-actions">
          {(footerActions || []).map((action, index) => (
            <Button
              key={`${action.label}-${index}`}
              type="button"
              variant={action.variant || 'secondary'}
              size="small"
              className={action.className || ''}
              onClick={action.onClick}
              disabled={Boolean(action.disabled)}
            >
              {action.label}
            </Button>
          ))}
        </div>
      </div>
    </div>,
    document.body,
  )
}

export default JsonAssistantModal
