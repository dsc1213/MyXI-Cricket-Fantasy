import LoadingDots from './LoadingDots.jsx'

function GlobalApiLoader({ loading }) {
  return (
    <div
      className={`global-api-loader ${loading ? 'show' : ''}`.trim()}
      role="status"
      aria-live="polite"
      aria-hidden={!loading}
    >
      <LoadingDots />
      <span>Loading</span>
    </div>
  )
}

export default GlobalApiLoader
