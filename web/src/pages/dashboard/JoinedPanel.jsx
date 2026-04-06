import { Link } from 'react-router-dom'
import ContestTileCard from '../../components/contest/ContestTileCard.jsx'
import SelectField from '../../components/ui/SelectField.jsx'
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
                const joinedCount = Number(
                  contest.joinedCount ?? contest.participants ?? 0,
                )
                const maxPlayers = Number(contest.maxPlayers ?? contest.teams ?? 0)
                const points =
                  contest?.points == null || contest?.points === '' ? '-' : contest.points
                const rank =
                  contest?.rank == null || contest?.rank === '' ? '-' : contest.rank
                return (
                  <ContestTileCard
                    key={`${game}-${contest.id}`}
                    contest={contest}
                    className={gameClassMap[contest.game] || ''}
                    tournamentName={tournamentName}
                    participantsText={`Participants ${joinedCount}${maxPlayers > 0 ? ` / ${maxPlayers}` : ''}`}
                    statsLeftText={`Points ${points}`}
                    statsRightText={`Rank #${rank}`}
                    openTo={`/tournaments/${contest.tournamentId}/contests/${contest.id}`}
                    leaderboardTo={`/tournaments/${contest.tournamentId}/contests/${contest.id}/leaderboard`}
                  />
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
