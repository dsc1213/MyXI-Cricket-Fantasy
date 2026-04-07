import { useEffect, useMemo } from 'react'
import { MatchLabel } from '../ui/CountryFlag.jsx'
import PlayerAvatar from '../ui/PlayerAvatar.jsx'
import { sortPlayersByDisplayRole } from '../../lib/playerRoleSort.js'

const normalizeLineupName = (value = '') =>
  String(value || '')
    .trim()
    .replace(/\s+/g, ' ')
    .toLowerCase()

const normalizeTeamCode = (value = '') =>
  String(value || '')
    .trim()
    .toUpperCase()

const toNameSet = (values = []) =>
  new Set(
    (Array.isArray(values) ? values : [])
      .map((item) => normalizeLineupName(item))
      .filter(Boolean),
  )

function TeamPreviewDrawer({
  contestMode = '',
  previewPlayer,
  activeMatch,
  previewXI,
  previewBackups,
  isLoading = false,
  onClose,
}) {
  const isFixedRosterContest = contestMode === 'fixed_roster'
  useEffect(() => {
    document.body.classList.toggle('team-preview-open', !!previewPlayer)
    return () => document.body.classList.remove('team-preview-open')
  }, [previewPlayer])

  const sortedPreviewXI = useMemo(() => {
    if (!Array.isArray(previewXI)) return []
    const objectEntries = previewXI.filter((entry) => entry && typeof entry === 'object')
    if (objectEntries.length !== previewXI.length) return previewXI
    return sortPlayersByDisplayRole(objectEntries)
  }, [previewXI])

  const sortedPreviewBackups = useMemo(() => {
    if (!Array.isArray(previewBackups)) return []
    const objectEntries = previewBackups.filter(
      (entry) => entry && typeof entry === 'object',
    )
    if (objectEntries.length !== previewBackups.length) return previewBackups
    return sortPlayersByDisplayRole(objectEntries)
  }, [previewBackups])

  const announcedLineup = useMemo(() => {
    const teamASet = toNameSet(
      activeMatch?.playingXiA ||
        activeMatch?.playingXIA ||
        activeMatch?.lineupA?.playingXI ||
        activeMatch?.teamALineup?.playingXI ||
        [],
    )
    const teamBSet = toNameSet(
      activeMatch?.playingXiB ||
        activeMatch?.playingXIB ||
        activeMatch?.lineupB?.playingXI ||
        activeMatch?.teamBLineup?.playingXI ||
        [],
    )
    return {
      teamASet,
      teamBSet,
      homeCode: normalizeTeamCode(activeMatch?.home || activeMatch?.teamA || ''),
      awayCode: normalizeTeamCode(activeMatch?.away || activeMatch?.teamB || ''),
      hasAny: teamASet.size > 0 || teamBSet.size > 0,
    }
  }, [activeMatch])

  const resolveLineupStatus = (entry) => {
    const explicit =
      typeof entry?.lineupStatus === 'string'
        ? entry.lineupStatus.trim().toLowerCase()
        : ''
    if (explicit === 'playing' || explicit === 'bench') {
      return explicit
    }
    if (!announcedLineup.hasAny) return ''

    const nameKey = normalizeLineupName(entry?.name || '')
    if (!nameKey) return ''

    const teamCode = normalizeTeamCode(entry?.team || entry?.teamCode || '')
    const isTeamA = teamCode && teamCode === announcedLineup.homeCode
    const isTeamB = teamCode && teamCode === announcedLineup.awayCode
    if (isTeamA && announcedLineup.teamASet.size) {
      return announcedLineup.teamASet.has(nameKey) ? 'playing' : 'bench'
    }
    if (isTeamB && announcedLineup.teamBSet.size) {
      return announcedLineup.teamBSet.has(nameKey) ? 'playing' : 'bench'
    }
    return ''
  }

  return (
    <div
      className={`team-preview-drawer ${previewPlayer ? 'open' : ''}`.trim()}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <aside className="team-preview-panel solid">
        <div className="team-preview-head">
          <div>
            <h3>
              {previewPlayer
                ? `${previewPlayer.name} ${isFixedRosterContest ? 'roster' : 'XI'}`
                : 'Team Preview'}
            </h3>
            {activeMatch && (
              <p>
                <MatchLabel
                  home={activeMatch.home}
                  away={activeMatch.away}
                  value={activeMatch.name}
                />
              </p>
            )}
            {previewPlayer && <p>{`Points: ${previewPlayer.points}`}</p>}
            {isFixedRosterContest && (
              <p>Leaderboard counts the top 11 scoring roster players.</p>
            )}
          </div>
          <button type="button" className="ghost small" onClick={onClose}>
            Close
          </button>
        </div>
        <div className="team-preview-sections">
          <section className="team-preview-section team-preview-section-primary">
            <div className="team-preview-list">
              {isLoading && <p className="team-note">Loading team preview...</p>}
              {!isLoading && isFixedRosterContest && !sortedPreviewXI.length && (
                <p className="team-note">No owned players are involved in this match.</p>
              )}
              {!isLoading && !isFixedRosterContest && !sortedPreviewXI.length && (
                <p className="team-note">No saved lineup found for this match.</p>
              )}
              {!isLoading &&
                sortedPreviewXI.map((entry, index) => {
                  const name =
                    typeof entry === 'string'
                      ? entry
                      : entry?.name || `Player ${index + 1}`
                  const points =
                    typeof entry === 'object' ? Number(entry?.points || 0) : 0
                  const lineupStatus =
                    typeof entry === 'object' ? resolveLineupStatus(entry) : ''
                  return (
                    <div className="player-row team-preview-row" key={`${name}-${index}`}>
                      <div className="player-row-main">
                        <PlayerAvatar
                          name={name}
                          imageUrl={
                            typeof entry === 'object' ? entry?.imageUrl || '' : ''
                          }
                        />
                        {!!lineupStatus && (
                          <span
                            className={`team-preview-lineup-dot lineup-status-light ${lineupStatus}`.trim()}
                            title={
                              lineupStatus === 'playing'
                                ? 'In announced playing XI'
                                : 'Not in announced playing XI'
                            }
                            aria-label={
                              lineupStatus === 'playing'
                                ? 'In announced playing XI'
                                : 'Not in announced playing XI'
                            }
                          />
                        )}
                        <strong>{name}</strong>
                      </div>
                      <span>{points}</span>
                    </div>
                  )
                })}
            </div>
          </section>
          {!isLoading && !!sortedPreviewBackups?.length && (
            <section className="team-preview-section team-preview-section-backups">
              <h4>{isFixedRosterContest ? 'Other owned players' : 'Backups'}</h4>
              <div className="team-preview-list">
                {sortedPreviewBackups.map((entry, index) => {
                  const name =
                    typeof entry === 'string'
                      ? entry
                      : entry?.name || `Backup ${index + 1}`
                  const points =
                    typeof entry === 'object' ? Number(entry?.points || 0) : 0
                  const lineupStatus =
                    typeof entry === 'object' ? resolveLineupStatus(entry) : ''
                  return (
                    <div
                      className="player-row team-preview-row"
                      key={`backup-${name}-${index}`}
                    >
                      <div className="player-row-main">
                        <PlayerAvatar
                          name={name}
                          imageUrl={
                            typeof entry === 'object' ? entry?.imageUrl || '' : ''
                          }
                        />
                        {!!lineupStatus && (
                          <span
                            className={`team-preview-lineup-dot lineup-status-light ${lineupStatus}`.trim()}
                            title={
                              lineupStatus === 'playing'
                                ? 'In announced playing XI'
                                : 'Not in announced playing XI'
                            }
                            aria-label={
                              lineupStatus === 'playing'
                                ? 'In announced playing XI'
                                : 'Not in announced playing XI'
                            }
                          />
                        )}
                        <strong>{name}</strong>
                      </div>
                      <span>{points}</span>
                    </div>
                  )
                })}
              </div>
            </section>
          )}
        </div>
      </aside>
    </div>
  )
}

export default TeamPreviewDrawer
