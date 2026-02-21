import { Link } from 'react-router-dom'
import SelectField from '../../components/ui/SelectField.jsx'
import { getStatusClassName } from '../../components/ui/status.js'
import { gameClassMap } from './constants.js'

function JoinedPanel({
  selectedTournament,
  setSelectedTournament,
  selectedStatus,
  setSelectedStatus,
  tournaments,
  allStatuses,
  groupedJoined,
  tournamentNameMap,
  errorText,
}) {
  const groupedEntries = Object.entries(groupedJoined)
  const hasContests = groupedEntries.some(([, contestList]) => contestList.length > 0)

  return (
    <>
      <div className="module-filters">
        <SelectField
          value={selectedTournament}
          onChange={(event) => setSelectedTournament(event.target.value)}
          options={[
            { value: 'all', label: 'All tournaments' },
            ...tournaments.map((item) => ({ value: item.id, label: item.name })),
          ]}
        />
        <SelectField
          value={selectedStatus}
          onChange={(event) => setSelectedStatus(event.target.value)}
          options={allStatuses.map((status) => ({
            value: status,
            label: status === 'all' ? 'All status' : status,
          }))}
        />
      </div>

      {hasContests ? (
        groupedEntries.map(([game, contestList]) => (
          <section className="dashboard-section" key={game}>
            <h3>{`My ${game} Contests`}</h3>
            <div className="compact-card-grid joined-contest-grid">
              {contestList.map((contest) => {
                const tournamentName = tournamentNameMap[contest.tournamentId] || '-'
                return (
                  <article
                    className={`compact-contest-card ${gameClassMap[contest.game] || ''} ${getStatusClassName(contest.status)}`.trim()}
                    key={`${game}-${contest.id}`}
                  >
                    <div className="contest-card-top">
                      <strong>{contest.name}</strong>
                      <span className={`contest-status-text ${getStatusClassName(contest.status)}`.trim()}>
                        {contest.status}
                      </span>
                    </div>
                    <p className="team-note">{tournamentName}</p>
                    <p className="team-note">{contest.game}</p>
                    <div className="contest-card-bottom">
                      <span>{`Pts ${contest.points}`}</span>
                      <span>{`Rank #${contest.rank}`}</span>
                      <Link
                        className="ghost small"
                        to={`/tournaments/${contest.tournamentId}/contests/${contest.id}`}
                      >
                        Open
                      </Link>
                    </div>
                  </article>
                )
              })}
            </div>
          </section>
        ))
      ) : (
        <section className="dashboard-empty-state">
          <h3>No joined contests to show</h3>
          <p>
            {errorText
              ? 'API is currently unavailable. Start backend on port 4000 to load live contests.'
              : 'Join a contest from Fantasy to see your entries here.'}
          </p>
          <Link to="/fantasy" className="ghost small">
            Open Fantasy
          </Link>
        </section>
      )}
    </>
  )
}

export default JoinedPanel
