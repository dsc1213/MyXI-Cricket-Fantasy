import Button from './Button.jsx'

function ApiErrorTile({
  title = 'Fantasy Feed Unavailable',
  message = 'We could not load tournaments and contests right now.',
  supportText = 'Check API/server status and retry.',
  onRetry,
}) {
  return (
    <section className="api-error-tile" role="alert" aria-live="polite">
      <div className="api-error-visual" aria-hidden="true">
        <div className="stumps">
          <span />
          <span />
          <span />
        </div>
        <div className="ball" />
        <div className="pitch-line" />
      </div>
      <div className="api-error-content">
        <p className="api-error-badge">Match Delayed</p>
        <h3>{title}</h3>
        <p>{message}</p>
        <p className="team-note">{supportText}</p>
        <div className="top-actions">
          <Button variant="primary" size="small" onClick={onRetry}>
            Retry
          </Button>
          <Button to="/home" variant="ghost" size="small">
            Back to Home
          </Button>
        </div>
      </div>
    </section>
  )
}

export default ApiErrorTile
