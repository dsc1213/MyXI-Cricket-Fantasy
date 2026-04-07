import { useEffect, useMemo, useState } from 'react'
import Button from '../../components/ui/Button.jsx'
import { CountryText } from '../../components/ui/CountryFlag.jsx'
import PlayerIdentity from '../../components/ui/PlayerIdentity.jsx'
import SelectField from '../../components/ui/SelectField.jsx'
import StickyTable from '../../components/ui/StickyTable.jsx'
import { getCountryFlag } from '../../components/ui/countryFlagUtils.js'
import {
  getPlayerDisplayRoleRank,
  sortPlayersByDisplayRole,
} from '../../lib/playerRoleSort.js'

function UploadPanel({
  forcedMatchOpsTab = '',
  hideMatchOpsTabs = false,
  uploadTab,
  setUploadTab,
  uploadPayloadText,
  setUploadPayloadText,
  scoreJsonUnmatchedDetails,
  lineupPayloadText,
  setLineupPayloadText,
  manualScoreContext,
  manualTournamentId,
  setManualTournamentId,
  manualMatchId,
  setManualMatchId,
  manualTeamPool,
  manualPlayerStats,
  manualPlayingXi,
  onToggleManualPlayingXi,
  onSaveManualLineups,
  onGenerateLineupsJson,
  onSaveLineupsFromJson,
  isGeneratedLineupJsonOpen,
  generatedLineupJsonText,
  onCloseGeneratedLineupJson,
  isLineupPreviewOpen,
  lineupPreviewPayload,
  onCloseLineupPreview,
  onConfirmLineupPreviewSave,
  onReplaceManualBackups,
  onManualStatChange,
  onSaveManualScores,
  onResetManualScores,
  isLoadingManualPool,
  onSaveScores,
  onGenerateScoreJson,
  isGeneratedScoreJsonOpen,
  generatedScoreJsonText,
  onCloseGeneratedScoreJson,
  isSavingScores,
}) {
  const [activeMatchOpsTab, setActiveMatchOpsTab] = useState(
    forcedMatchOpsTab || 'lineups',
  )
  const [lineupUploadTab, setLineupUploadTab] = useState('manual')
  const [copyButtonLabel, setCopyButtonLabel] = useState('Copy JSON')
  const [lineupCopyButtonLabel, setLineupCopyButtonLabel] = useState('Copy JSON')

  useEffect(() => {
    if (!forcedMatchOpsTab) return
    setActiveMatchOpsTab(forcedMatchOpsTab)
  }, [forcedMatchOpsTab])
  const calculateStrikeRate = (runs, ballsFaced) => {
    const parsedRuns = Number(runs || 0)
    const parsedBalls = Number(ballsFaced || 0)
    if (!parsedBalls || parsedBalls <= 0) return '0.00'
    return ((parsedRuns / parsedBalls) * 100).toFixed(2)
  }
  const calculateEconomy = (overs, runsConceded) => {
    const parsedOvers = Number(overs || 0)
    const parsedRuns = Number(runsConceded || 0)
    if (!parsedOvers || parsedOvers <= 0) return '0.00'
    return (parsedRuns / parsedOvers).toFixed(2)
  }
  const categoryColumns = {
    batting: [
      { key: 'runs', label: 'R' },
      { key: 'ballsFaced', label: 'B' },
      { key: 'fours', label: '4s' },
      { key: 'sixes', label: '6s' },
      { key: 'strikeRate', label: 'SR', derived: true },
      { key: 'dismissed', label: 'Out', type: 'checkbox' },
    ],
    bowling: [
      { key: 'overs', label: 'O', inputMode: 'decimal' },
      { key: 'maidens', label: 'M' },
      { key: 'runsConceded', label: 'R' },
      { key: 'wickets', label: 'Wkts' },
      { key: 'noBalls', label: 'NB' },
      { key: 'wides', label: 'WD' },
      { key: 'economy', label: 'ECO', derived: true },
    ],
    fielding: [
      { key: 'catches', label: 'Catches' },
      { key: 'stumpings', label: 'Stumpings' },
      { key: 'runoutDirect', label: 'Runout Direct' },
      { key: 'runoutIndirect', label: 'Runout Assist' },
    ],
  }
  const manualTeamTabs = [
    {
      key: 'teamA',
      name: manualTeamPool?.teamAName || 'Team A',
      players: manualTeamPool?.teamAPlayers || [],
    },
    {
      key: 'teamB',
      name: manualTeamPool?.teamBName || 'Team B',
      players: manualTeamPool?.teamBPlayers || [],
    },
  ]
  const sortedManualTeamTabs = useMemo(
    () =>
      manualTeamTabs.map((team) => ({
        ...team,
        players: sortPlayersByDisplayRole(team.players || []),
      })),
    [
      manualTeamPool?.teamAName,
      manualTeamPool?.teamAPlayers,
      manualTeamPool?.teamBName,
      manualTeamPool?.teamBPlayers,
    ],
  )
  const manualCategoryTabs = [
    { key: 'batting', label: 'Bat' },
    { key: 'bowling', label: 'Bowl' },
    { key: 'fielding', label: 'Field' },
  ]
  const manualLineupTeams = [
    {
      key: 'teamA',
      name: manualTeamPool?.teamAName || 'Team A',
      players: manualTeamPool?.teamAPlayers || [],
      selected: manualPlayingXi?.teamA || [],
    },
    {
      key: 'teamB',
      name: manualTeamPool?.teamBName || 'Team B',
      players: manualTeamPool?.teamBPlayers || [],
      selected: manualPlayingXi?.teamB || [],
    },
  ]
  const sortedManualLineupTeams = useMemo(
    () =>
      manualLineupTeams.map((team) => ({
        ...team,
        players: sortPlayersByDisplayRole(team.players || []),
      })),
    [
      manualPlayingXi?.teamA,
      manualPlayingXi?.teamB,
      manualTeamPool?.teamAName,
      manualTeamPool?.teamAPlayers,
      manualTeamPool?.teamBName,
      manualTeamPool?.teamBPlayers,
    ],
  )
  const manualPlayersCount =
    (manualTeamPool?.teamAPlayers?.length || 0) +
    (manualTeamPool?.teamBPlayers?.length || 0)
  const hasManualPlayers = manualPlayersCount > 0
  const isScorecardsTab = activeMatchOpsTab === 'scores'
  const isManualScorecards = isScorecardsTab && uploadTab === 'manual'
  const isJsonScorecards = isScorecardsTab && uploadTab === 'json'
  const isScoreActionDisabled =
    isSavingScores ||
    !manualTournamentId ||
    !manualMatchId ||
    (isManualScorecards && isLoadingManualPool)
  const isLineupActionDisabled =
    isSavingScores || !manualTournamentId || !manualMatchId || isLoadingManualPool
  const [activeManualCategory, setActiveManualCategory] = useState('batting')
  const activeColumns = categoryColumns[activeManualCategory] || categoryColumns.batting
  const onCopyGeneratedJson = async () => {
    if (!generatedScoreJsonText) return
    try {
      await navigator.clipboard.writeText(generatedScoreJsonText)
      setCopyButtonLabel('Copied')
      window.setTimeout(() => setCopyButtonLabel('Copy JSON'), 1200)
    } catch {
      setCopyButtonLabel('Copy failed')
      window.setTimeout(() => setCopyButtonLabel('Copy JSON'), 1600)
    }
  }

  const onCopyGeneratedLineupJson = async () => {
    if (!generatedLineupJsonText) return
    try {
      await navigator.clipboard.writeText(generatedLineupJsonText)
      setLineupCopyButtonLabel('Copied')
      window.setTimeout(() => setLineupCopyButtonLabel('Copy JSON'), 1200)
    } catch {
      setLineupCopyButtonLabel('Copy failed')
      window.setTimeout(() => setLineupCopyButtonLabel('Copy JSON'), 1600)
    }
  }

  const getMatchOptionLabel = (item) => {
    const rawLabel = item.label || item.name || ''
    const normalized = rawLabel.includes(':')
      ? rawLabel.split(':').slice(1).join(':').trim()
      : rawLabel
    const split = normalized.split(/\s+vs\s+/i)
    if (split.length !== 2) return rawLabel
    const left = split[0].trim()
    const right = split[1].trim()
    const leftFlag = getCountryFlag(left)
    const rightFlag = getCountryFlag(right)
    return `${left}${leftFlag ? ` ${leftFlag}` : ''} vs ${right}${rightFlag ? ` ${rightFlag}` : ''}`
  }

  const manualColumns = [
    {
      key: 'player',
      label: 'Player',
      headerClassName: 'manual-col-player',
      cellClassName: 'manual-col-player',
      sortValue: (row) => row.name || '',
      render: (row) => (
        <PlayerIdentity
          name={row.name}
          imageUrl={row.imageUrl || ''}
          className="manual-player-identity dense"
          size="sm"
        />
      ),
    },
    {
      key: 'role',
      label: 'Role',
      headerClassName: 'manual-col-role',
      cellClassName: 'manual-col-role manual-player-role',
      sortValue: (row) =>
        `${String(getPlayerDisplayRoleRank(row.role)).padStart(2, '0')}:${row.role || ''}`,
      render: (row) => row.role,
    },
    ...activeColumns.map((column) => ({
      key: column.key,
      label: column.label,
      headerClassName: 'manual-col-metric',
      cellClassName: 'manual-col-metric',
      sortValue: (row) => {
        const value = (manualPlayerStats[row.id] || {})[column.key]
        if (column.type === 'checkbox') return value ? 1 : 0
        return Number(value || 0)
      },
      render: (row) => {
        const value = manualPlayerStats[row.id] || {}
        if (column.derived) {
          if (column.key === 'strikeRate') {
            return (
              <span className="manual-derived-stat">
                {calculateStrikeRate(value.runs, value.ballsFaced)}
              </span>
            )
          }
          return (
            <span className="manual-derived-stat">
              {calculateEconomy(value.overs, value.runsConceded)}
            </span>
          )
        }
        if (column.type === 'checkbox') {
          return (
            <input
              type="checkbox"
              checked={Boolean(value[column.key])}
              onChange={(event) =>
                onManualStatChange(row.id, column.key, event.target.checked)
              }
            />
          )
        }
        return (
          <input
            type="number"
            min="0"
            step={column.inputMode === 'decimal' ? '0.1' : '1'}
            inputMode={column.inputMode === 'decimal' ? 'decimal' : 'numeric'}
            value={value[column.key] ?? 0}
            onFocus={(event) => {
              event.target.select()
            }}
            onChange={(event) =>
              onManualStatChange(row.id, column.key, event.target.value)
            }
          />
        )
      },
    })),
  ]
  const excelPreviewColumns = [
    { key: 'playerId', label: 'Player' },
    { key: 'runs', label: 'Runs' },
    { key: 'wickets', label: 'Wkts' },
    { key: 'catches', label: 'Catches' },
    { key: 'fours', label: '4s' },
    { key: 'sixes', label: '6s' },
  ]

  const renderManualTeamTable = (title, players) => (
    <article className="manual-team-card">
      <div className="manual-team-head">
        <h4>
          <CountryText value={title} />
        </h4>
        <span className="manual-team-meta">{`${players.length} players`}</span>
      </div>
      <StickyTable
        columns={manualColumns}
        rows={players}
        rowKey={(row) => row.id}
        emptyText="No players"
        wrapperClassName="manual-team-table-wrap"
        tableClassName={`manual-team-table manual-category-${activeManualCategory}`}
      />
    </article>
  )

  const renderLineupTeamCard = (team) => {
    const selectedNames = new Set(team.selected || [])
    const lineupColumns = [
      {
        key: 'player',
        label: 'Player',
        headerClassName: 'manual-col-player',
        cellClassName: 'manual-col-player',
        sortValue: (row) => row.name || '',
        render: (row) => (
          <PlayerIdentity
            name={row.name}
            imageUrl={row.imageUrl || ''}
            className="manual-player-identity manual-lineup-player-identity dense"
            size="sm"
          />
        ),
      },
      {
        key: 'role',
        label: 'Role',
        headerClassName: 'manual-col-role',
        cellClassName: 'manual-col-role manual-player-role',
        sortValue: (row) =>
          `${String(getPlayerDisplayRoleRank(row.role)).padStart(2, '0')}:${row.role || ''}`,
        render: (row) => row.role || 'ALL',
      },
      {
        key: 'playing',
        label: 'Playing',
        headerClassName: 'manual-col-metric',
        cellClassName: 'manual-col-metric',
        sortValue: (row) => selectedNames.has(row.name),
        render: (row) => (
          <input
            type="checkbox"
            checked={selectedNames.has(row.name)}
            onChange={() => onToggleManualPlayingXi(team.key, row.name)}
            disabled={!selectedNames.has(row.name) && selectedNames.size >= 12}
            aria-label={`${row.name} playing`}
          />
        ),
      },
    ]
    return (
      <article className="manual-team-card manual-lineup-card" key={team.key}>
        <div className="manual-lineup-head">
          <div className="manual-team-head-copy">
            <h4>
              <CountryText value={team.name} />
            </h4>
            <span className="manual-team-meta">{`${team.players.length} players`}</span>
          </div>
          <span
            className={`manual-lineup-count ${selectedNames.size >= 11 && selectedNames.size <= 12 ? 'ready' : ''}`.trim()}
          >
            {selectedNames.size}/12
          </span>
        </div>
        <StickyTable
          columns={lineupColumns}
          rows={team.players}
          rowKey={(row) => row.id}
          rowClassName={(row) => (selectedNames.has(row.name) ? 'active' : '')}
          emptyText="No players"
          wrapperClassName="manual-team-table-wrap"
          tableClassName="manual-team-table manual-lineup-table"
        />
      </article>
    )
  }

  return (
    <section className="dashboard-section match-scores-section">
      <div className="admin-card dashboard-panel-card match-scores-panel">
        <div className="match-upload-form">
          <div className="upload-tab-head">
            <div className="upload-tab-groups">
              {!hideMatchOpsTabs && (
                <div className="upload-tab-group upload-tab-group-primary">
                  <span className="upload-tab-group-label">Mode</span>
                  <div
                    className="upload-tab-row match-ops-row"
                    role="tablist"
                    aria-label="Match operations"
                  >
                    <Button
                      type="button"
                      role="tab"
                      aria-selected={activeMatchOpsTab === 'lineups'}
                      className={`upload-tab-btn ${activeMatchOpsTab === 'lineups' ? 'active' : ''}`.trim()}
                      onClick={() => setActiveMatchOpsTab('lineups')}
                    >
                      Playing XI
                    </Button>
                    <Button
                      type="button"
                      role="tab"
                      aria-selected={activeMatchOpsTab === 'scores'}
                      className={`upload-tab-btn ${activeMatchOpsTab === 'scores' ? 'active' : ''}`.trim()}
                      onClick={() => setActiveMatchOpsTab('scores')}
                    >
                      Scorecards
                    </Button>
                  </div>
                </div>
              )}
              <div className="upload-tab-group upload-tab-group-secondary">
                <span className="upload-tab-group-label">
                  {activeMatchOpsTab === 'lineups'
                    ? 'Playing XI Entry'
                    : 'Scorecard Entry'}
                </span>
                <div className="upload-tab-row" role="tablist" aria-label="Upload type">
                  {activeMatchOpsTab === 'lineups' ? (
                    <>
                      <Button
                        type="button"
                        role="tab"
                        aria-selected={lineupUploadTab === 'manual'}
                        className={`upload-tab-btn ${lineupUploadTab === 'manual' ? 'active' : ''}`.trim()}
                        onClick={() => setLineupUploadTab('manual')}
                      >
                        Manual Entry
                      </Button>
                      <Button
                        type="button"
                        role="tab"
                        aria-selected={lineupUploadTab === 'json'}
                        className={`upload-tab-btn ${lineupUploadTab === 'json' ? 'active' : ''}`.trim()}
                        onClick={() => setLineupUploadTab('json')}
                      >
                        JSON Upload
                      </Button>
                    </>
                  ) : (
                    <>
                      <Button
                        type="button"
                        role="tab"
                        aria-selected={uploadTab === 'manual'}
                        className={`upload-tab-btn ${uploadTab === 'manual' ? 'active' : ''}`.trim()}
                        onClick={() => setUploadTab('manual')}
                      >
                        Manual Entry
                      </Button>
                      <Button
                        type="button"
                        role="tab"
                        aria-selected={uploadTab === 'json'}
                        className={`upload-tab-btn ${uploadTab === 'json' ? 'active' : ''}`.trim()}
                        onClick={() => setUploadTab('json')}
                      >
                        JSON Upload
                      </Button>
                    </>
                  )}
                </div>
              </div>
            </div>
            {activeMatchOpsTab === 'lineups' && lineupUploadTab === 'manual' && (
              <div className="top-actions upload-head-actions upload-actions-row">
                <Button
                  type="button"
                  variant="secondary"
                  size="small"
                  onClick={onReplaceManualBackups}
                  disabled={isLineupActionDisabled}
                >
                  Force Backups
                </Button>
                <Button
                  type="button"
                  variant="primary"
                  size="small"
                  className="upload-action-btn"
                  onClick={onSaveManualLineups}
                  disabled={
                    isSavingScores ||
                    !manualTournamentId ||
                    !manualMatchId ||
                    isLoadingManualPool ||
                    !sortedManualLineupTeams.every((team) => {
                      const count = (team.selected || []).length
                      return count >= 11 && count <= 12
                    })
                  }
                >
                  {isSavingScores ? 'Saving...' : 'Save Playing XI'}
                </Button>
              </div>
            )}
            {activeMatchOpsTab === 'lineups' && lineupUploadTab === 'json' && (
              <div className="top-actions upload-head-actions upload-actions-row">
                <Button
                  type="button"
                  variant="secondary"
                  size="small"
                  className="upload-action-btn"
                  onClick={onGenerateLineupsJson}
                  disabled={isSavingScores || !manualTournamentId || !manualMatchId}
                >
                  Generate JSON
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  size="small"
                  onClick={onReplaceManualBackups}
                  disabled={isLineupActionDisabled}
                >
                  Force Backups
                </Button>
                <Button
                  type="button"
                  variant="primary"
                  size="small"
                  className="upload-action-btn"
                  onClick={onSaveLineupsFromJson}
                  disabled={isSavingScores || !manualTournamentId || !manualMatchId}
                >
                  {isSavingScores ? 'Processing...' : 'Save Playing XI JSON'}
                </Button>
              </div>
            )}
            {isScorecardsTab && (
              <div className="top-actions upload-head-actions upload-actions-row">
                {isJsonScorecards && (
                  <Button
                    type="button"
                    variant="secondary"
                    size="small"
                    className="upload-action-btn"
                    onClick={onGenerateScoreJson}
                    disabled={isScoreActionDisabled}
                  >
                    Generate JSON
                  </Button>
                )}
                <Button
                  type="button"
                  variant="danger"
                  size="small"
                  onClick={onResetManualScores}
                  disabled={isScoreActionDisabled}
                >
                  Reset Scores
                </Button>
                <Button
                  type="button"
                  variant="primary"
                  size="small"
                  className="upload-action-btn"
                  onClick={isManualScorecards ? onSaveManualScores : onSaveScores}
                  disabled={isScoreActionDisabled}
                >
                  {isSavingScores
                    ? isJsonScorecards
                      ? 'Uploading...'
                      : 'Saving...'
                    : isJsonScorecards
                      ? 'Upload JSON'
                      : 'Save'}
                </Button>
              </div>
            )}
          </div>
          <div
            className={`manual-scope-row ${activeMatchOpsTab === 'lineups' ? 'compact-two' : ''}`.trim()}
          >
            <label>
              Tournament
              <SelectField
                value={manualTournamentId}
                onChange={(event) => {
                  setManualTournamentId(event.target.value)
                  setLineupPayloadText('')
                }}
              >
                <option value="">Select tournament</option>
                {(manualScoreContext?.tournaments || []).map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </SelectField>
            </label>
            <label>
              Match
              <SelectField
                value={manualMatchId}
                onChange={(event) => {
                  setManualMatchId(event.target.value)
                  setLineupPayloadText('')
                }}
              >
                <option value="">Select match</option>
                {(manualScoreContext?.matches || []).map((item) => (
                  <option key={item.id} value={item.id}>
                    {getMatchOptionLabel(item)}
                  </option>
                ))}
              </SelectField>
            </label>
          </div>
          {activeMatchOpsTab === 'scores' && uploadTab === 'manual' && (
            <div className="manual-category-row">
              <div
                className="manual-category-inline"
                role="tablist"
                aria-label="Manual score category"
              >
                {manualCategoryTabs.map((item) => (
                  <a
                    key={item.key}
                    href="#"
                    role="tab"
                    aria-selected={activeManualCategory === item.key}
                    className={`manual-category-link ${activeManualCategory === item.key ? 'active' : ''}`.trim()}
                    onClick={(event) => {
                      event.preventDefault()
                      setActiveManualCategory(item.key)
                    }}
                  >
                    {item.label}
                  </a>
                ))}
              </div>
            </div>
          )}

          {activeMatchOpsTab === 'lineups' ? (
            lineupUploadTab === 'manual' ? (
              <div
                className={`manual-entry-layout ${hasManualPlayers ? '' : 'empty'}`.trim()}
              >
                {isLoadingManualPool ? (
                  <p className="team-note">Loading playing XI...</p>
                ) : !hasManualPlayers ? (
                  <div className="manual-empty-state">
                    <strong>No player rows yet</strong>
                    <span>Select tournament and match to load playing XI.</span>
                  </div>
                ) : (
                  <div className="manual-entry-grid manual-lineup-layout">
                    {sortedManualLineupTeams.map((team) => renderLineupTeamCard(team))}
                  </div>
                )}
              </div>
            ) : (
              <div className="match-upload-grid json-mode lineup-json-mode">
                <label className="match-upload-json">
                  Lineup JSON schema
                  <textarea
                    rows="10"
                    value={lineupPayloadText}
                    onChange={(event) => setLineupPayloadText(event.target.value)}
                    placeholder={`{
  "lineups": {
    "${manualTeamPool?.teamAName || 'MI'}": {
      "playingXI": ["Player 1", "Player 2"],
      "bench": ["Player 13"]
    },
    "${manualTeamPool?.teamBName || 'KKR'}": {
      "playingXI": ["Player A", "Player B"],
      "bench": ["Player M"]
    }
  }
}`}
                    className="dashboard-json-textarea"
                  />
                </label>
              </div>
            )
          ) : uploadTab === 'manual' ? (
            <div
              className={`manual-entry-layout ${hasManualPlayers ? '' : 'empty'}`.trim()}
            >
              {isLoadingManualPool ? (
                <p className="team-note">Loading playing XI...</p>
              ) : !hasManualPlayers ? (
                <div className="manual-empty-state">
                  <strong>No player rows yet</strong>
                  <span>Select tournament and match to load playing XI.</span>
                </div>
              ) : (
                <>
                  <div className="manual-entry-grid">
                    {sortedManualTeamTabs.map((team) =>
                      renderManualTeamTable(team.name, team.players),
                    )}
                  </div>
                </>
              )}
            </div>
          ) : (
            <div className="match-upload-grid json-mode">
              <label className="match-upload-json">
                JSON schema
                <textarea
                  rows="10"
                  value={uploadPayloadText}
                  onChange={(event) => setUploadPayloadText(event.target.value)}
                  placeholder={`{
  "playerStats": [
    {
      "playerId": "p1",
      "runs": 30,
      "wickets": 2,
      "catches": 1,
      "fours": 4,
      "sixes": 1
    }
  ]
}`}
                />
              </label>
              {Array.isArray(scoreJsonUnmatchedDetails) &&
                scoreJsonUnmatchedDetails.length > 0 && (
                  <div className="json-upload-diagnostics" role="alert">
                    <h5>Unmatched Players</h5>
                    <p>
                      These player names could not be mapped to the selected match teams.
                    </p>
                    <ul>
                      {scoreJsonUnmatchedDetails.map((entry, index) => {
                        const input =
                          (entry?.input || '').toString().trim() || 'unknown-player'
                        const normalizedInput =
                          (entry?.normalizedInput || '').toString().trim() ||
                          input.toLowerCase()
                        const suggestions = Array.isArray(entry?.suggestions)
                          ? entry.suggestions
                          : []
                        return (
                          <li key={`${input}-${index}`}>
                            <strong>{input}</strong>
                            <span>{`normalized: ${normalizedInput}`}</span>
                            <span>
                              {suggestions.length
                                ? `suggestions: ${suggestions.join(', ')}`
                                : 'suggestions: none'}
                            </span>
                          </li>
                        )
                      })}
                    </ul>
                  </div>
                )}
            </div>
          )}
        </div>
      </div>

      {isGeneratedScoreJsonOpen && (
        <div className="score-preview-modal-backdrop" role="presentation">
          <div
            className="score-preview-modal"
            role="dialog"
            aria-modal="true"
            aria-label="Generated score JSON"
          >
            <div className="score-preview-modal-head">
              <h4>Generated Score JSON</h4>
              <p>
                Built from saved Playing XI/XII for this match. Copy it, update with AI,
                then paste into JSON Upload.
              </p>
            </div>
            <textarea
              className="score-preview-textarea"
              value={generatedScoreJsonText || '{\n  "playerStats": []\n}'}
              readOnly
            />
            <div className="score-preview-modal-actions">
              <Button
                type="button"
                variant="ghost"
                size="small"
                onClick={onCopyGeneratedJson}
                disabled={isSavingScores || !generatedScoreJsonText}
              >
                {copyButtonLabel}
              </Button>
              <Button
                type="button"
                variant="secondary"
                size="small"
                onClick={onCloseGeneratedScoreJson}
                disabled={isSavingScores}
              >
                Close
              </Button>
            </div>
          </div>
        </div>
      )}

      {isGeneratedLineupJsonOpen && (
        <div className="score-preview-modal-backdrop" role="presentation">
          <div
            className="score-preview-modal"
            role="dialog"
            aria-modal="true"
            aria-label="Generated Playing XI JSON"
          >
            <div className="score-preview-modal-head">
              <h4>Generated Playing XI JSON</h4>
              <p>
                Built from current squads and selected Playing XI/XII. Copy it, then paste
                into JSON Upload.
              </p>
            </div>
            <textarea
              className="score-preview-textarea"
              value={generatedLineupJsonText || '{\n  "lineups": {},\n  "meta": {}\n}'}
              readOnly
            />
            <div className="score-preview-modal-actions">
              <Button
                type="button"
                variant="ghost"
                size="small"
                onClick={onCopyGeneratedLineupJson}
                disabled={isSavingScores || !generatedLineupJsonText}
              >
                {lineupCopyButtonLabel}
              </Button>
              <Button
                type="button"
                variant="secondary"
                size="small"
                onClick={onCloseGeneratedLineupJson}
                disabled={isSavingScores}
              >
                Close
              </Button>
            </div>
          </div>
        </div>
      )}

      {isLineupPreviewOpen && (
        <div className="score-preview-modal-backdrop" role="presentation">
          <div
            className="score-preview-modal"
            role="dialog"
            aria-modal="true"
            aria-label="Processed lineup JSON preview"
          >
            <div className="score-preview-modal-head">
              <h4>Processed Playing XI JSON</h4>
              <p>
                Review this normalized lineup payload. Confirm save to write it to the
                database.
              </p>
            </div>
            <textarea
              className="score-preview-textarea"
              value={JSON.stringify({ lineups: lineupPreviewPayload || {} }, null, 2)}
              readOnly
            />
            <div className="score-preview-modal-actions">
              <Button
                type="button"
                variant="secondary"
                size="small"
                onClick={onCloseLineupPreview}
                disabled={isSavingScores}
              >
                Cancel
              </Button>
              <Button
                type="button"
                variant="primary"
                size="small"
                className="upload-action-btn"
                onClick={onConfirmLineupPreviewSave}
                disabled={isSavingScores}
              >
                {isSavingScores ? 'Saving...' : 'Confirm Save'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </section>
  )
}

export default UploadPanel
