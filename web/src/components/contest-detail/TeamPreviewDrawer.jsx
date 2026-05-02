import { useEffect, useMemo, useState } from 'react'
import { MatchLabel } from '../ui/CountryFlag.jsx'
import PlayerAvatar from '../ui/PlayerAvatar.jsx'
import ScorePill from '../ui/ScorePill.jsx'
import { sortPlayersByDisplayRole } from '../../lib/playerRoleSort.js'
import { isMatchLiveOrComplete } from '../../lib/matchStatus.js'
import { getIplTeamStyle } from '../../lib/iplTeamPalette.js'

const normalizeLineupName = (value = '') =>
  String(value || '')
    .trim()
    .replace(/\s+/g, ' ')
    .toLowerCase()

const normalizeTeamCode = (value = '') =>
  String(value || '')
    .trim()
    .toUpperCase()

const getEntryTeamCode = (entry) =>
  normalizeTeamCode(typeof entry === 'object' ? entry?.team || entry?.teamCode || '' : '')

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
  showTeam = false,
  isLoading = false,
  onClose,
}) {
  const isFixedRosterContest = contestMode === 'fixed_roster'
  const [expandedRows, setExpandedRows] = useState({})
  const [openMetaInfoKey, setOpenMetaInfoKey] = useState('')
  const shouldShowOwnershipCounts = useMemo(() => {
    return isMatchLiveOrComplete(activeMatch?.status)
  }, [activeMatch?.status])

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
    return previewBackups
  }, [previewBackups])

  const previewXITeamGroups = useMemo(() => {
    if (isFixedRosterContest || !Array.isArray(sortedPreviewXI) || !sortedPreviewXI.length) {
      return []
    }
    const primaryCodes = [
      normalizeTeamCode(activeMatch?.home || activeMatch?.teamA || ''),
      normalizeTeamCode(activeMatch?.away || activeMatch?.teamB || ''),
    ].filter(Boolean)
    const groups = primaryCodes.map((teamCode) => ({
      teamCode,
      entries: sortedPreviewXI.filter((entry) => getEntryTeamCode(entry) === teamCode),
    }))
    const otherEntries = sortedPreviewXI.filter((entry) => {
      const teamCode = getEntryTeamCode(entry)
      return !primaryCodes.includes(teamCode)
    })
    if (otherEntries.length) {
      groups.push({
        teamCode: 'Other',
        entries: otherEntries,
      })
    }
    return groups.filter((group) => group.entries.length)
  }, [
    activeMatch?.away,
    activeMatch?.home,
    activeMatch?.teamA,
    activeMatch?.teamB,
    isFixedRosterContest,
    sortedPreviewXI,
  ])

  const fixedRosterDisplayGroups = useMemo(() => {
    if (!isFixedRosterContest) {
      return {
        primary: sortedPreviewXI,
        secondary: sortedPreviewBackups,
      }
    }
    const matchTeamCodes = new Set(
      [activeMatch?.home, activeMatch?.away, activeMatch?.teamA, activeMatch?.teamB]
        .map((value) => normalizeTeamCode(value))
        .filter(Boolean),
    )
    const allOwnedPlayers = [...sortedPreviewXI, ...sortedPreviewBackups]
    if (!matchTeamCodes.size) {
      return {
        primary: allOwnedPlayers,
        secondary: [],
      }
    }
    return {
      primary: allOwnedPlayers.filter((entry) =>
        matchTeamCodes.has(
          normalizeTeamCode(
            typeof entry === 'object' ? entry?.team || entry?.teamCode || '' : '',
          ),
        ),
      ),
      secondary: allOwnedPlayers.filter(
        (entry) =>
          !matchTeamCodes.has(
            normalizeTeamCode(
              typeof entry === 'object' ? entry?.team || entry?.teamCode || '' : '',
            ),
          ),
      ),
    }
  }, [
    activeMatch?.away,
    activeMatch?.home,
    activeMatch?.teamA,
    activeMatch?.teamB,
    isFixedRosterContest,
    sortedPreviewBackups,
    sortedPreviewXI,
  ])

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

  const toggleExpanded = (key) => {
    setExpandedRows((prev) => ({ ...prev, [key]: !prev[key] }))
  }

  const toggleMetaInfo = (key) => {
    setOpenMetaInfoKey((prev) => (prev === key ? '' : key))
  }

  const renderInfoHint = ({
    label = '',
    title,
    className = '',
    infoKey = '',
    dialogText = '',
    showIcon = false,
    iconOnly = false,
  }) => (
    <span className={`team-preview-info-wrap ${className}`.trim()}>
      <button
        type="button"
        className="team-preview-info-hint"
        title={title}
        aria-label={title}
        aria-expanded={infoKey ? openMetaInfoKey === infoKey : undefined}
        onClick={infoKey ? () => toggleMetaInfo(infoKey) : undefined}
      >
        {label ? <span>{label}</span> : null}
        {showIcon ? (
          <span
            className={`team-preview-info-icon ${iconOnly ? 'icon-only' : ''}`.trim()}
            aria-hidden="true"
          >
            i
          </span>
        ) : null}
      </button>
      {infoKey && openMetaInfoKey === infoKey && dialogText ? (
        <div className="team-preview-inline-tooltip" role="note">
          {dialogText}
        </div>
      ) : null}
    </span>
  )

  const renderPlayerMeta = (entry, name, rowKey) => {
    const teamCode =
      typeof entry === 'object'
        ? normalizeTeamCode(entry?.team || entry?.teamCode || '')
        : ''
    const autoSwapped = typeof entry === 'object' ? Boolean(entry?.autoSwapped) : false
    const replacementInfoText =
      entry?.replacementInfo ||
      'Promoted from backups because a picked XI player was not in the announced playing XI.'
    return (
      <div className="team-preview-copy">
        <div className="team-preview-copy-main">
          <strong>{name}</strong>
          {shouldShowOwnershipCounts && entry?.ownership?.pickedByCount > 0 ? (
            <button
              type="button"
              className="team-preview-ownership-link"
              onClick={() => toggleExpanded(`ownership:${rowKey}`)}
              aria-expanded={Boolean(expandedRows[`ownership:${rowKey}`])}
              aria-label={`${expandedRows[`ownership:${rowKey}`] ? 'Hide' : 'Show'} ownership for ${name}`}
            >
              {entry.ownership.pickedByCount}
            </button>
          ) : null}
          {showTeam && teamCode && isFixedRosterContest ? (
            <span
              className="team-preview-team-tag ipl-team-text"
              style={getIplTeamStyle(teamCode)}
            >{`(${teamCode})`}</span>
          ) : null}
          {entry?.roleTag ? (
            <span
              className={`team-preview-role-badge team-preview-role-badge-${entry.roleTag.toString().trim().toLowerCase()}`.trim()}
            >
              {entry.roleTag}
            </span>
          ) : null}
        </div>
        {autoSwapped
          ? renderInfoHint({
              label: 'Backup replacement',
              title: replacementInfoText,
              className: 'team-preview-meta-note',
              infoKey: `replacement:${rowKey}`,
              dialogText: replacementInfoText,
            })
          : null}
      </div>
    )
  }

  const renderPointCell = (entry, key) => {
    const points = typeof entry === 'object' ? Number(entry?.points || 0) : 0
    const isExpanded = Boolean(expandedRows[key])
    const hasDetails =
      typeof entry === 'object' &&
      (Array.isArray(entry?.pointBreakdown) && entry.pointBreakdown.length > 0
        ? true
        : Number(entry?.multiplier || 1) !== 1 || Boolean(entry?.roleTag))
    if (!hasDetails) return <span>{points}</span>
    return (
      <button
        type="button"
        className="team-preview-points-link"
        onClick={() => toggleExpanded(key)}
        aria-expanded={isExpanded}
        aria-label={`${isExpanded ? 'Hide' : 'Show'} score breakdown for ${entry?.name || 'player'}`}
      >
        <span>{`${points} pts`}</span>
        <span className="team-preview-points-caret" aria-hidden="true">
          {isExpanded ? '▴' : '▾'}
        </span>
      </button>
    )
  }

  const renderExpandedBreakdown = (entry, key) => {
    if (!expandedRows[key] || typeof entry !== 'object') return null
    const breakdown = Array.isArray(entry?.pointBreakdown) ? entry.pointBreakdown : []
    const basePoints = Number(entry?.basePoints || 0)
    const multiplier = Number(entry?.multiplier || 1)
    const totalPoints = Number(entry?.points || 0)
    const roleTag = (entry?.roleTag || '').toString().trim()
    return (
      <div className="team-preview-breakdown">
        {!!breakdown.length && (
          <ul className="team-preview-breakdown-list">
            {breakdown.map((row, index) => (
              <li key={`${key}-row-${index}`}>
                <span>
                  <strong>{row.label}</strong>
                  {row.count != null && row.valuePerUnit != null ? (
                    <small>{`${row.count} x ${row.valuePerUnit}`}</small>
                  ) : null}
                </span>
                <span>{row.points}</span>
              </li>
            ))}
          </ul>
        )}
        <div className="team-preview-breakdown-summary">
          <span>{`Base: ${basePoints}`}</span>
          <span>
            {multiplier === 1
              ? 'No multiplier'
              : `${roleTag || 'Multiplier'} x${multiplier}`}
          </span>
          <strong>{`Total: ${totalPoints}`}</strong>
        </div>
      </div>
    )
  }

  const renderExpandedOwnership = (entry, key) => {
    if (!expandedRows[`ownership:${key}`] || typeof entry !== 'object') return null
    const pickedBy = Array.isArray(entry?.ownership?.pickedBy)
      ? entry.ownership.pickedBy
      : []
    if (!pickedBy.length) return null
    return (
      <div className="team-preview-ownership-panel">
        <ul className="team-preview-ownership-list">
          {pickedBy.map((row, index) => (
            <li key={`${key}-owner-${index}`}>
              <span>{row.name}</span>
              {row.roleTag ? (
                <span
                  className={`team-preview-role-badge team-preview-role-badge-${row.roleTag.toString().trim().toLowerCase()}`.trim()}
                >
                  {row.roleTag}
                </span>
              ) : null}
            </li>
          ))}
        </ul>
      </div>
    )
  }

  const renderPreviewEntry = (entry, index, prefix = 'xi') => {
    const name = typeof entry === 'string' ? entry : entry?.name || `Player ${index + 1}`
    const lineupStatus = typeof entry === 'object' ? resolveLineupStatus(entry) : ''
    const rowKey = `${prefix}-${name}-${index}`
    return (
      <div className="team-preview-entry" key={rowKey}>
        <div className="player-row team-preview-row">
          <div className="player-row-main">
            <PlayerAvatar
              name={name}
              imageUrl={typeof entry === 'object' ? entry?.imageUrl || '' : ''}
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
            {renderPlayerMeta(entry, name, rowKey)}
          </div>
          {renderPointCell(entry, rowKey)}
        </div>
        {renderExpandedOwnership(entry, rowKey)}
        {renderExpandedBreakdown(entry, rowKey)}
      </div>
    )
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
              <p>
                Leaderboard counts the top 11 roster players by overall contest points.
              </p>
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
              {!isLoading &&
                isFixedRosterContest &&
                !fixedRosterDisplayGroups.primary.length && (
                  <p className="team-note">
                    No owned players are involved in this match.
                  </p>
                )}
              {!isLoading && !isFixedRosterContest && !sortedPreviewXI.length && (
                <p className="team-note">No saved lineup found for this match.</p>
              )}
              {!isLoading &&
                isFixedRosterContest &&
                fixedRosterDisplayGroups.primary.map((entry, index) =>
                  renderPreviewEntry(entry, index, 'xi'),
                )}
              {!isLoading &&
                !isFixedRosterContest &&
                (previewXITeamGroups.length
                  ? previewXITeamGroups.map((group, groupIndex) => (
                      <section
                        className="team-preview-team-group"
                        key={`team-group-${group.teamCode}`}
                      >
                        <div className="team-preview-team-group-head">
                          <ScorePill
                            className="team-preview-team-pill"
                            suffix=""
                            tone="neutral"
                            variant={groupIndex % 2 === 0 ? 'team-a' : 'team-b'}
                            style={getIplTeamStyle(group.teamCode)}
                          >
                            {group.teamCode}
                          </ScorePill>
                          <ScorePill
                            className="team-preview-team-count-pill"
                            suffix=""
                            tone="muted"
                            variant="muted"
                          >
                            {`${group.entries.length} players`}
                          </ScorePill>
                        </div>
                        <div className="team-preview-team-group-list">
                          {group.entries.map((entry, index) =>
                            renderPreviewEntry(entry, index, `xi-${group.teamCode}`),
                          )}
                        </div>
                      </section>
                    ))
                  : sortedPreviewXI.map((entry, index) =>
                      renderPreviewEntry(entry, index, 'xi'),
                    ))}
            </div>
          </section>
          {!isLoading &&
            !!(
              isFixedRosterContest
                ? fixedRosterDisplayGroups.secondary
                : sortedPreviewBackups
            )?.length && (
              <section className="team-preview-section team-preview-section-backups">
                <div className="team-preview-section-head">
                  <h4>
                    {isFixedRosterContest ? 'Other owned players' : 'Backup Replacements'}
                  </h4>
                  {!isFixedRosterContest &&
                    renderInfoHint({
                      title:
                        'Reserve players are used when a picked XI player is not in the announced lineup. Promoted backups move into XI and replaced players move here.',
                      className: 'team-preview-section-info',
                      infoKey: 'backup-section-info',
                      dialogText:
                        'Reserve players are used when a picked XI player is not in the announced lineup. Promoted backups move into XI and replaced players move here.',
                      showIcon: true,
                      iconOnly: true,
                    })}
                </div>
                <div className="team-preview-list">
                  {(isFixedRosterContest
                    ? fixedRosterDisplayGroups.secondary
                    : sortedPreviewBackups
                  ).map((entry, index) => {
                    const name =
                      typeof entry === 'string'
                        ? entry
                        : entry?.name || `Backup ${index + 1}`
                    const lineupStatus =
                      typeof entry === 'object' ? resolveLineupStatus(entry) : ''
                    const rowKey = `backup-${name}-${index}`
                    return (
                      <div className="team-preview-entry" key={rowKey}>
                        <div className="player-row team-preview-row">
                          <div className="player-row-main">
                            {!isFixedRosterContest ? (
                              <span
                                className="backup-priority-badge"
                                title={`Backup priority ${index + 1}`}
                                aria-label={`Backup priority ${index + 1}`}
                              >
                                {index + 1}
                              </span>
                            ) : null}
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
                            {renderPlayerMeta(entry, name, rowKey)}
                          </div>
                          {renderPointCell(entry, rowKey)}
                        </div>
                        {renderExpandedOwnership(entry, rowKey)}
                        {renderExpandedBreakdown(entry, rowKey)}
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
