import { Link } from 'react-router-dom'
import LoadingNote from '../ui/LoadingNote.jsx'

function ContestTopBar({
  contestTitle,
  tournamentName,
  lastScoreUpdatedAt = '',
  isLoading,
  errorText,
  tournamentId,
  actions = null,
}) {
  return (
    <div className="contest-topbar-compact">
      <div className="flow-breadcrumb">
        <Link to="/fantasy">Fantasy</Link>
        <span>/</span>
        <Link to={`/tournaments/${tournamentId}`}>{tournamentName}</Link>
        <span>/</span>
        <strong>{contestTitle}</strong>
      </div>

      <div className="section-head-compact contest-headline">
        <div className="contest-section-head">
          <h2>{contestTitle}</h2>
          {!!actions && <div className="top-actions">{actions}</div>}
        </div>
        <p className="team-note">{tournamentName}</p>
        <p className="team-note">
          Last score update: {lastScoreUpdatedAt ? new Date(lastScoreUpdatedAt).toLocaleString() : '-'}
        </p>
        <LoadingNote loading={isLoading} errorText={errorText} />
      </div>
    </div>
  )
}

export default ContestTopBar
