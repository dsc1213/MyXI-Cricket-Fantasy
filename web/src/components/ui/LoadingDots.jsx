function LoadingDots({ className = '' }) {
  return (
    <span className={`loading-dots ${className}`.trim()} aria-hidden="true">
      <span />
      <span />
      <span />
    </span>
  )
}

export default LoadingDots
