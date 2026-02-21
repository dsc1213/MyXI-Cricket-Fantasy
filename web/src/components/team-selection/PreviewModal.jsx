import Modal from '../ui/Modal.jsx'

function PreviewModal({ open, title, onClose, children }) {
  return (
    <Modal
      open={open}
      title={title}
      onClose={onClose}
      size="sm"
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
