import { Link } from 'react-router-dom'
import LoadingNote from '../ui/LoadingNote.jsx'
import LastScoreMeta from '../ui/LastScoreMeta.jsx'
import { getIplTeamStyle } from '../../lib/iplTeamPalette.js'

function ContestTopBar({
  contestTitle,
  tournamentName,
  liveScoreSummary = [],
  lastScoreUpdatedAt = '',
  lastScoreUpdatedBy = '',
  lastUpdatedContext = '',
  isLoading,
  errorText,
  tournamentId,
  viewMode = '',
  actions = null,
}) {
  const isAuctionView = viewMode === 'auction'
  const visibleLiveScores = Array.isArray(liveScoreSummary)
    ? liveScoreSummary.slice(0, 2)
    : []
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
        <div className="contest-score-meta-row">
          <LastScoreMeta
            lastScoreUpdatedAt={lastScoreUpdatedAt}
            lastScoreUpdatedBy={lastScoreUpdatedBy}
            lastUpdatedContext={lastUpdatedContext}
            compact
          />
          {visibleLiveScores.length ? (
            <div className="contest-live-score-summary" aria-label="Selected match score">
              {visibleLiveScores.map((row, index) => (
                <p
                  className={`contest-live-score-row team-side-${index === 0 ? 'a' : 'b'}`}
                  key={`${row.team}-${index}`}
                  style={getIplTeamStyle(row.team)}
                >
                  <span>{row.team}</span>
                  {row.isYetToBat ? (
                    <strong className="contest-live-score-muted">Yet to bat</strong>
                  ) : (
                    <>
                      <strong>{row.score}</strong>
                      <small>{`${row.overs} ov`}</small>
                    </>
                  )}
                </p>
              ))}
            </div>
          ) : null}
        </div>
        <LoadingNote loading={isLoading} errorText={errorText} />
      </div>
    </div>
  )
}

export default ContestTopBar
