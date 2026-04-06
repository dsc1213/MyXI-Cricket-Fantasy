import { statusMeta } from './status.js'

function StatusChip({ status, iconOnly = false, className = '' }) {
  const meta = statusMeta[status] || { className: '' }
  const classes = [
    'badge',
    'light',
    'status-chip',
    iconOnly ? 'status-icon-only' : '',
    meta.className,
    className,
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <span className={classes} title={status} aria-label={status}>
      {!iconOnly ? status : ''}
    </span>
  )
}

export default StatusChip
