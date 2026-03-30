import Modal from '../ui/Modal.jsx'

function PreviewModal({ open, title, onClose, children, size = 'md', className = '' }) {
  return (
    <Modal
      open={open}
      title={title}
      onClose={onClose}
      size={size}
      className={className}
      footer={
        <button type="button" className="ghost small" onClick={onClose}>
          Close
        </button>
      }
    >
      {children}
    </Modal>
  )
}

export default PreviewModal
