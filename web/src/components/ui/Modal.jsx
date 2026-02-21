import { useEffect } from 'react'

function Modal({
  open,
  title,
  onClose,
  children,
  footer = null,
  size = 'md',
  className = '',
  closeOnBackdrop = true,
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

  return (
    <div
      className="ui-modal-overlay"
      onClick={(event) => {
        if (closeOnBackdrop && event.target === event.currentTarget) onClose?.()
      }}
    >
      <div className={`ui-modal-card size-${size} ${className}`.trim()}>
        <div className="ui-modal-header">
          <span>{title}</span>
          <button type="button" className="ui-modal-close" onClick={onClose}>
            ×
          </button>
        </div>
        <div className="ui-modal-body">{children}</div>
        {!!footer && <div className="ui-modal-footer">{footer}</div>}
      </div>
    </div>
  )
}

export default Modal
