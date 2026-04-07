import { useEffect, useMemo, useState } from 'react'
import Button from '../../components/ui/Button.jsx'
import { CountryText } from '../../components/ui/CountryFlag.jsx'
import JsonAssistantModal from '../../components/ui/JsonAssistantModal.jsx'
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
  const [copyAiPromptLabel, setCopyAiPromptLabel] = useState('Copy AI Prompt')
  const [lineupCopyButtonLabel, setLineupCopyButtonLabel] = useState('Copy JSON')
  const [lineupPromptCopyButtonLabel, setLineupPromptCopyButtonLabel] =
    useState('Copy AI Prompt')
  const [lineupPreviewCopyButtonLabel, setLineupPreviewCopyButtonLabel] =
    useState('Copy JSON')

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

  const scoreAiPromptText = useMemo(() => {
    const templateJson = generatedScoreJsonText || '{\n  "playerStats": []\n}'
    return [
      'Convert the provided scorecard into the exact JSON format used by /match-scores/save.',
      '',
      'Rules:',
      '- Return valid JSON only.',
      '- Do not include markdown, code fences, or any explanations.',
      '- Keep top-level shape exactly as {"playerStats": [...]}.',
      '- Use only players already present in the template JSON.',
      '- Keep playerId and playerName exactly as provided in template.',
      '- Fill batting stats: runs, ballsFaced, fours, sixes, dismissed.',
      '- Fill bowling stats: overs, maidens, runsConceded, wickets, noBalls, wides.',
      '- Fill fielding stats when known else keep 0: catches, stumpings, runoutDirect, runoutIndirect.',
      '- dismissed should be true when batter is out, else false for not out/DNB.',
      '- Keep missing numeric stats as 0.',
      '',
      'Template JSON:',
      templateJson,
      '',
      'Scorecard JSON:',
      'PASTE_SCORECARD_JSON_HERE',
    ].join('\n')
  }, [generatedScoreJsonText])

  const onCopyScoreAiPrompt = async () => {
    if (!scoreAiPromptText) return
    try {
      await navigator.clipboard.writeText(scoreAiPromptText)
      setCopyAiPromptLabel('Copied')
      window.setTimeout(() => setCopyAiPromptLabel('Copy AI Prompt'), 1200)
    } catch {
      setCopyAiPromptLabel('Copy failed')
      window.setTimeout(() => setCopyAiPromptLabel('Copy AI Prompt'), 1600)
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

  const lineupAiPromptText = useMemo(() => {
    const templateJson = generatedLineupJsonText || '{\n  "lineups": {},\n  "meta": {}\n}'
    return [
      'Convert source lineup notes into the exact JSON format used by /admin/match-lineups/upsert.',
      '',
      'Rules:',
      '- Return valid JSON only.',
      '- Do not include markdown, code fences, or explanations.',
      '- Keep top-level shape as {"lineups": {...}, "meta": {...}}.',
      '- Keep team names exactly as in template lineups keys.',
      '- Include squad, playingXI, and bench arrays for each team.',
      '- Use player names exactly from known squad names.',
      '- playingXI must contain 11 or 12 unique players.',
      '- captain and viceCaptain are optional but must be in playingXI when present.',
      '',
      'Template JSON:',
      templateJson,
      '',
      'Source lineup notes:',
      'PASTE_LINEUP_SOURCE_HERE',
    ].join('\n')
  }, [generatedLineupJsonText])

  const onCopyGeneratedLineupPrompt = async () => {
    if (!lineupAiPromptText) return
    try {
      await navigator.clipboard.writeText(lineupAiPromptText)
      setLineupPromptCopyButtonLabel('Copied')
      window.setTimeout(() => setLineupPromptCopyButtonLabel('Copy AI Prompt'), 1200)
    } catch {
      setLineupPromptCopyButtonLabel('Copy failed')
      window.setTimeout(() => setLineupPromptCopyButtonLabel('Copy AI Prompt'), 1600)
    }
  }

  const lineupPreviewJsonText = useMemo(
    () => JSON.stringify({ lineups: lineupPreviewPayload || {} }, null, 2),
    [lineupPreviewPayload],
  )

  const onCopyLineupPreviewJson = async () => {
    if (!lineupPreviewJsonText) return
    try {
      await navigator.clipboard.writeText(lineupPreviewJsonText)
      setLineupPreviewCopyButtonLabel('Copied')
      window.setTimeout(() => setLineupPreviewCopyButtonLabel('Copy JSON'), 1200)
    } catch {
      setLineupPreviewCopyButtonLabel('Copy failed')
      window.setTimeout(() => setLineupPreviewCopyButtonLabel('Copy JSON'), 1600)
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
              <div className="top-actions upload-head-actions upload-actions-row upload-sub-actions">
                <Button
                  type="button"
                  variant="primary"
                  size="small"
                  className="upload-action-btn upload-sub-btn upload-sub-btn-primary"
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
              <div className="top-actions upload-head-actions upload-actions-row upload-sub-actions is-json-actions">
                <Button
                  type="button"
                  variant="secondary"
                  size="small"
                  className="upload-action-btn upload-sub-btn"
                  onClick={onGenerateLineupsJson}
                  disabled={isSavingScores || !manualTournamentId || !manualMatchId}
                >
                  Generate JSON
                </Button>
                <Button
                  type="button"
                  variant="primary"
                  size="small"
                  className="upload-action-btn upload-sub-btn upload-sub-btn-primary"
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
                      ? 'Save'
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

      <JsonAssistantModal
        open={isGeneratedScoreJsonOpen}
        ariaLabel="Generated score JSON"
        title="Generated Score JSON"
        description="Built from saved Playing XI/XII for this match. Copy it, update with AI, then paste into JSON Upload."
        jsonLabel="JSON Template"
        jsonText={generatedScoreJsonText}
        jsonFallback={'{\n  "playerStats": []\n}'}
        onCopyJson={onCopyGeneratedJson}
        copyJsonLabel={copyButtonLabel}
        disableCopyJson={isSavingScores || !generatedScoreJsonText}
        promptLabel="AI Prompt For Live Scoring"
        promptText={scoreAiPromptText}
        onCopyPrompt={onCopyScoreAiPrompt}
        copyPromptLabel={copyAiPromptLabel}
        disableCopyPrompt={isSavingScores}
        footerActions={[
          {
            label: 'Close',
            variant: 'secondary',
            onClick: onCloseGeneratedScoreJson,
            disabled: isSavingScores,
          },
        ]}
      />

      <JsonAssistantModal
        open={isGeneratedLineupJsonOpen}
        ariaLabel="Generated Playing XI JSON"
        title="Generated Playing XI JSON"
        description="Built from current squads and selected Playing XI/XII. Copy it, update with AI if needed, then paste into JSON Upload."
        jsonLabel="JSON Template"
        jsonText={generatedLineupJsonText}
        jsonFallback={'{\n  "lineups": {},\n  "meta": {}\n}'}
        onCopyJson={onCopyGeneratedLineupJson}
        copyJsonLabel={lineupCopyButtonLabel}
        disableCopyJson={isSavingScores || !generatedLineupJsonText}
        promptLabel="AI Prompt For Playing XI JSON"
        promptText={lineupAiPromptText}
        onCopyPrompt={onCopyGeneratedLineupPrompt}
        copyPromptLabel={lineupPromptCopyButtonLabel}
        disableCopyPrompt={isSavingScores}
        footerActions={[
          {
            label: 'Close',
            variant: 'secondary',
            onClick: onCloseGeneratedLineupJson,
            disabled: isSavingScores,
          },
        ]}
      />

      <JsonAssistantModal
        open={isLineupPreviewOpen}
        ariaLabel="Processed lineup JSON preview"
        title="Processed Playing XI JSON"
        description="Review this normalized lineup payload. Confirm save to write it to the database."
        jsonLabel="Processed JSON"
        jsonText={lineupPreviewJsonText}
        jsonFallback={'{\n  "lineups": {}\n}'}
        onCopyJson={onCopyLineupPreviewJson}
        copyJsonLabel={lineupPreviewCopyButtonLabel}
        disableCopyJson={isSavingScores}
        promptText=""
        footerActions={[
          {
            label: 'Cancel',
            variant: 'secondary',
            onClick: onCloseLineupPreview,
            disabled: isSavingScores,
          },
          {
            label: isSavingScores ? 'Saving...' : 'Confirm Save',
            variant: 'primary',
            className: 'upload-action-btn',
            onClick: onConfirmLineupPreviewSave,
            disabled: isSavingScores,
          },
        ]}
      />
    </section>
  )
}

export default UploadPanel
