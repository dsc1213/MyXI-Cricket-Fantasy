import Button from './Button.jsx'

function ApiFailureTile({
  title = 'Data could not be loaded',
  message = 'We are unable to fetch live contest data right now.',
  onRetry,
}) {
  return (
    <section className="api-failure-tile" role="status" aria-live="polite">
      <div className="api-failure-badge">Match Halted</div>
      <div className="api-failure-visual" aria-hidden>
        <span className="stump stump-one" />
        <span className="stump stump-two" />
        <span className="stump stump-three" />
        <span className="ball" />
      </div>
      <h3>{title}</h3>
      <p>{message}</p>
      <p className="team-note">Start backend API and retry to continue fantasy actions.</p>
      {!!onRetry && (
        <div className="api-failure-actions">
          <Button variant="primary" size="small" onClick={onRetry}>
            Retry
          </Button>
        </div>
      )}
    </section>
  )
}

export default ApiFailureTile
