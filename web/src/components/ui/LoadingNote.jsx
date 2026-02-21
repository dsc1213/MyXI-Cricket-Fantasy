import LoadingDots from './LoadingDots.jsx'

function LoadingNote({ loading, errorText, loadingText = 'Loading...' }) {
  return (
    <>
      {loading && (
        <p className="team-note loading-note">
          <LoadingDots />
          <span>{loadingText}</span>
        </p>
      )}
      {!!errorText && <p className="error-text">{errorText}</p>}
    </>
  )
}

export default LoadingNote
