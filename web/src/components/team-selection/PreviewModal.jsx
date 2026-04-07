import Modal from '../ui/Modal.jsx'

function PreviewModal({
  open,
  title,
  onClose,
  children,
  size = 'md',
  className = '',
  footer,
}) {
  const fallbackFooter = (
    <button type="button" className="ghost small" onClick={onClose}>
      Close
    </button>
  )

  return (
    <Modal
      open={open}
      title={title}
      onClose={onClose}
      size={size}
      className={className}
      footer={footer || fallbackFooter}
    >
      {children}
    </Modal>
  )
}

export default PreviewModal
