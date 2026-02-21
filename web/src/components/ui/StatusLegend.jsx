import { statusMeta, statusOrder } from './status.js'

function StatusLegend({ statuses = statusOrder }) {
  return (
    <div className="status-legend" aria-label="Status legend">
      {statuses.map((status) => {
        const meta = statusMeta[status]
        if (!meta) return null
        return (
          <span key={status} className={`status-legend-item ${meta.className}`.trim()}>
            <span className="status-swatch" />
            {status}
          </span>
        )
      })}
    </div>
  )
}

export default StatusLegend
