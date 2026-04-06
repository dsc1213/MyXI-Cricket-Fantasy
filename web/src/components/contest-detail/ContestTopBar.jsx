import { Link } from 'react-router-dom'
import LoadingNote from '../ui/LoadingNote.jsx'

function ContestTopBar({
  contestTitle,
  tournamentName,
  lastScoreUpdatedAt = '',
  lastScoreUpdatedBy = '',
  isLoading,
  errorText,
  tournamentId,
  viewMode = '',
  actions = null,
}) {
  const isAuctionView = viewMode === 'auction'
  const rootHref = isAuctionView ? '/auction' : '/fantasy'
  const rootLabel = isAuctionView ? 'Auction' : 'Fantasy'
  const tournamentHref = isAuctionView
    ? `/auction?view=auction&tournament=${encodeURIComponent(tournamentId)}`
    : `/tournaments/${tournamentId}`
  return (
    <div className="contest-topbar-compact">
      <div className="flow-breadcrumb">
        <Link to={rootHref}>{rootLabel}</Link>
        <span>/</span>
        <Link to={tournamentHref}>{tournamentName}</Link>
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
          Last score update:{' '}
          {lastScoreUpdatedAt ? new Date(lastScoreUpdatedAt).toLocaleString() : '-'}
          {lastScoreUpdatedBy ? ` by ${lastScoreUpdatedBy}` : ''}
        </p>
        <LoadingNote loading={isLoading} errorText={errorText} />
      </div>
    </div>
  )
}

export default ContestTopBar
