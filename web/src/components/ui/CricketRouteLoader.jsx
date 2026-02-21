function CricketRouteLoader({
  loading,
  title = 'Loading...',
  subtitle = 'Loading fantasy feed',
  mode = 'bowl',
}) {
  return (
    <div
      className={`cricket-route-loader ${loading ? 'show' : ''}`.trim()}
      role="status"
      aria-live="polite"
      aria-hidden={!loading}
    >
      <div className="cricket-route-loader-card">
        <div className={`cricket-route-loader-scene mode-${mode}`.trim()} aria-hidden>
          <span className="pitch" />
          <span className="stump stump-1" />
          <span className="stump stump-2" />
          <span className="stump stump-3" />
          {mode === 'hit' && (
            <>
              <span className="batsman" />
              <span className="bat" />
            </>
          )}
          <span className="ball" />
        </div>
        <strong>{title}</strong>
        <p>{subtitle}</p>
      </div>
    </div>
  )
}

export default CricketRouteLoader
