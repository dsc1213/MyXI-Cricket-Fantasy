export const statusMeta = {
  Open: { className: 'status-open' },
  'Starting Soon': { className: 'status-progress' },
  'In Progress': { className: 'status-progress' },
  Locked: { className: 'status-locked' },
  Closed: { className: 'status-locked' },
  Completed: { className: 'status-complete' },
}

export const statusOrder = ['Open', 'Starting Soon', 'In Progress', 'Locked', 'Completed']

export const getStatusClassName = (status) => statusMeta[status]?.className || ''
