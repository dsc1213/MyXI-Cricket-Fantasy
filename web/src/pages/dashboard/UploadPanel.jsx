import { useEffect, useMemo, useState } from 'react'
import Button from '../../components/ui/Button.jsx'
import { CountryText } from '../../components/ui/CountryFlag.jsx'
import JsonAssistantModal from '../../components/ui/JsonAssistantModal.jsx'
import JsonTextareaField from '../../components/ui/JsonTextareaField.jsx'
import PlayerIdentity from '../../components/ui/PlayerIdentity.jsx'
import PlayingXiModalLink from '../../components/ui/PlayingXiModalLink.jsx'
import SelectField from '../../components/ui/SelectField.jsx'
import StickyTable from '../../components/ui/StickyTable.jsx'
import { formatCompactMatchLabel } from '../../lib/matchLabels.js'
import {
  getPlayerDisplayRoleRank,
  sortPlayersByDisplayRole,
} from '../../lib/playerRoleSort.js'
import { normalizeLooseKey } from './utils.js'
import {
  buildLineupJsonSchemaTemplate,
  LINEUP_AI_PROMPT_TEXT,
  LINEUP_JSON_FALLBACK,
  SCORE_AI_PROMPT_TEXT,
  SCORE_JSON_FALLBACK,
  SCORE_JSON_SCHEMA_TEMPLATE,
} from './templates/jsonTemplates.js'

function UploadPanel({
  forcedMatchOpsTab = '',
  hideMatchOpsTabs = false,
  uploadTab,
  setUploadTab,
  uploadPayloadText,
  setUploadPayloadText,
  scoreJsonUnmatchedDetails,
  lineupJsonUnmatchedDetails,
  lineupPayloadText,
  setLineupPayloadText,
  manualScoreContext,
  manualTournamentId,
  setManualTournamentId,
  manualMatchId,
  setManualMatchId,
  manualTeamPool,
  manualPlayerStats,
  pointsRules,
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
    const id = window.setTimeout(() => {
      setActiveMatchOpsTab(forcedMatchOpsTab)
    }, 0)
    return () => window.clearTimeout(id)
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
      { key: 'hatTrick', label: 'HT' },
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
  const sortedManualTeamTabs = manualTeamTabs.map((team) => ({
    ...team,
    players: sortPlayersByDisplayRole(team.players || []),
  }))
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
  const sortedManualLineupTeams = manualLineupTeams.map((team) => ({
    ...team,
    players: sortPlayersByDisplayRole(team.players || []),
  }))
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

  const scoreAiPromptText = SCORE_AI_PROMPT_TEXT

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

  const lineupAiPromptText = LINEUP_AI_PROMPT_TEXT

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

  const processedLineupPreviewTeams = useMemo(
    () =>
      Object.entries(lineupPreviewPayload || {}).map(([teamName, teamPayload]) => ({
        name: teamName,
        players: Array.isArray(teamPayload?.playingXI) ? teamPayload.playingXI : [],
      })),
    [lineupPreviewPayload],
  )

  const getRuleValue = (rows = [], id, fallback = 0) => {
    const entry = (Array.isArray(rows) ? rows : []).find((item) => item?.id === id)
    return typeof entry?.value === 'number' ? entry.value : fallback
  }

  const calculateFantasyPoints = (stats = {}) => {
    const rules = {
      run: getRuleValue(pointsRules?.batting, 'run', 1),
      four: getRuleValue(pointsRules?.batting, 'four', 1),
      six: getRuleValue(pointsRules?.batting, 'six', 2),
      thirty: getRuleValue(pointsRules?.batting, 'thirty', 0),
      fifty: getRuleValue(pointsRules?.batting, 'fifty', 0),
      seventyFive: getRuleValue(pointsRules?.batting, 'seventyFive', 0),
      century: getRuleValue(pointsRules?.batting, 'century', 0),
      oneFifty: getRuleValue(pointsRules?.batting, 'oneFifty', 0),
      twoHundred: getRuleValue(pointsRules?.batting, 'twoHundred', 0),
      duck: getRuleValue(pointsRules?.batting, 'duck', 0),
      strikeRate150: getRuleValue(pointsRules?.batting, 'strikeRate150', 0),
      strikeRate200: getRuleValue(pointsRules?.batting, 'strikeRate200', 0),
      strikeRate250: getRuleValue(pointsRules?.batting, 'strikeRate250', 0),
      strikeRateBelow80: getRuleValue(pointsRules?.batting, 'strikeRateBelow80', 0),
      wicket: getRuleValue(pointsRules?.bowling, 'wicket', 20),
      maiden: getRuleValue(pointsRules?.bowling, 'maiden', 0),
      threew: getRuleValue(pointsRules?.bowling, 'threew', 0),
      fourw: getRuleValue(pointsRules?.bowling, 'fourw', 0),
      fivew: getRuleValue(pointsRules?.bowling, 'fivew', 0),
      wide: getRuleValue(pointsRules?.bowling, 'wide', 0),
      economyBelow3: getRuleValue(pointsRules?.bowling, 'economyBelow3', 0),
      economyBelow5: getRuleValue(pointsRules?.bowling, 'economyBelow5', 0),
      economyBelow6: getRuleValue(pointsRules?.bowling, 'economyBelow6', 0),
      economyAbove10: getRuleValue(pointsRules?.bowling, 'economyAbove10', 0),
      economyAbove12: getRuleValue(pointsRules?.bowling, 'economyAbove12', 0),
      hatTrick: getRuleValue(pointsRules?.bowling, 'hatTrick', 0),
      catch: getRuleValue(pointsRules?.fielding, 'catch', 10),
      threeCatch: getRuleValue(pointsRules?.fielding, 'threeCatch', 0),
      stumping: getRuleValue(pointsRules?.fielding, 'stumping', 0),
      twoStumping: getRuleValue(pointsRules?.fielding, 'twoStumping', 0),
      runoutDirect: getRuleValue(pointsRules?.fielding, 'runout-direct', 0),
      runoutIndirect: getRuleValue(pointsRules?.fielding, 'runout-indirect', 0),
    }

    const runs = Number(stats?.runs || 0)
    const wickets = Number(stats?.wickets || 0)
    const catches = Number(stats?.catches || 0)
    const fours = Number(stats?.fours || 0)
    const sixes = Number(stats?.sixes || 0)
    const ballsFaced = Number(stats?.ballsFaced || 0)
    const overs = Number(stats?.overs || 0)
    const runsConceded = Number(stats?.runsConceded || 0)
    const maidens = Number(stats?.maidens || 0)
    const wides = Number(stats?.wides || 0)
    const noBalls = Number(stats?.noBalls || 0)
    const stumpings = Number(stats?.stumpings || 0)
    const runoutDirect = Number(stats?.runoutDirect || 0)
    const runoutIndirect = Number(stats?.runoutIndirect || 0)
    const hatTrick = Number(stats?.hatTrick || 0)

    let total = 0
    total += runs * rules.run
    total += wickets * rules.wicket
    total += catches * rules.catch
    total += fours * rules.four
    total += sixes * rules.six
    total += maidens * rules.maiden
    total += (wides + noBalls) * rules.wide
    total += stumpings * rules.stumping
    total += runoutDirect * rules.runoutDirect
    total += runoutIndirect * rules.runoutIndirect
    total += hatTrick * rules.hatTrick

    if (runs >= 200) total += rules.twoHundred
    else if (runs >= 150) total += rules.oneFifty
    else if (runs >= 100) total += rules.century
    else if (runs >= 75) total += rules.seventyFive
    else if (runs >= 50) total += rules.fifty
    else if (runs >= 30) total += rules.thirty

    if (runs === 0 && ballsFaced > 0 && stats?.dismissed === true) total += rules.duck
    if (wickets >= 5) total += rules.fivew
    else if (wickets >= 4) total += rules.fourw
    else if (wickets >= 3) total += rules.threew
    if (catches >= 3) total += rules.threeCatch
    if (stumpings >= 2) total += rules.twoStumping
    if (ballsFaced >= 15) {
      const strikeRate = (runs / ballsFaced) * 100
      if (strikeRate >= 250) total += rules.strikeRate250
      else if (strikeRate >= 200) total += rules.strikeRate200
      else if (strikeRate >= 150) total += rules.strikeRate150
      else if (strikeRate < 80) total += rules.strikeRateBelow80
    }
    if (overs >= 2) {
      const economy = runsConceded / overs
      if (economy <= 3) total += rules.economyBelow3
      else if (economy <= 5) total += rules.economyBelow5
      else if (economy <= 6) total += rules.economyBelow6
      else if (economy >= 12) total += rules.economyAbove12
      else if (economy >= 10) total += rules.economyAbove10
    }

    return total
  }

  const renderManualScoreSummary = (player = {}) => {
    const stats = manualPlayerStats?.[player.id] || {}
    const total = calculateFantasyPoints(stats)
    return Number.isFinite(total) ? `${total} pts` : ''
  }

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

  const renderManualTeamTable = (title, players) => (
    <article className="manual-team-card">
      <div className="manual-team-head">
        <h4>
          <CountryText value={title} />
        </h4>
        <span className="manual-team-meta">{`${players.length} players`}</span>
      </div>
      {(() => {
        const side = title === (manualTeamPool?.teamAName || 'Team A') ? 'teamA' : 'teamB'
        const selectedNameKeys = new Set(
          (manualPlayingXi?.[side] || []).map((name) => normalizeLooseKey(name)),
        )
        const scoreColumns = [
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
                className={`manual-player-identity dense ${selectedNameKeys.has(normalizeLooseKey(row.name)) ? 'is-playing-xi' : ''}`.trim()}
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
          {
            key: 'playing',
            label: 'XI',
            headerClassName: 'manual-col-metric',
            cellClassName: 'manual-col-metric manual-playing-indicator',
            sortValue: (row) => selectedNameKeys.has(normalizeLooseKey(row.name)),
            render: (row) =>
              selectedNameKeys.has(normalizeLooseKey(row.name)) ? 'Yes' : '—',
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
        return (
          <StickyTable
            columns={scoreColumns}
            rows={players}
            rowKey={(row) => row.id}
            rowClassName={(row) =>
              selectedNameKeys.has(normalizeLooseKey(row.name)) ? 'active' : ''
            }
            emptyText="No players"
            wrapperClassName="manual-team-table-wrap"
            tableClassName={`manual-team-table manual-scorecard-table manual-category-${activeManualCategory}`}
          />
        )
      })()}
    </article>
  )

  const renderLineupTeamCard = (team) => {
    const selectedNameKeys = new Set(
      (team.selected || []).map((name) => normalizeLooseKey(name)),
    )
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
        sortValue: (row) => selectedNameKeys.has(normalizeLooseKey(row.name)),
        render: (row) => (
          <input
            type="checkbox"
            checked={selectedNameKeys.has(normalizeLooseKey(row.name))}
            onChange={() => onToggleManualPlayingXi(team.key, row.name)}
            disabled={
              !selectedNameKeys.has(normalizeLooseKey(row.name)) &&
              selectedNameKeys.size >= 12
            }
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
            className={`manual-lineup-count ${selectedNameKeys.size >= 11 && selectedNameKeys.size <= 12 ? 'ready' : ''}`.trim()}
          >
            {selectedNameKeys.size}/12
          </span>
        </div>
        <StickyTable
          columns={lineupColumns}
          rows={team.players}
          rowKey={(row) => row.id}
          rowClassName={(row) =>
            selectedNameKeys.has(normalizeLooseKey(row.name)) ? 'active' : ''
          }
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
                    {formatCompactMatchLabel(item)}
                  </option>
                ))}
              </SelectField>
            </label>
          </div>
          <div className="playing-xi-link-row">
            <PlayingXiModalLink
              tournamentId={manualTournamentId}
              matchId={manualMatchId}
              teams={{
                teamA: {
                  name: manualTeamPool?.teamAName || 'Team A',
                  players: manualTeamPool?.teamAPlayers || [],
                  lineup: {
                    ...(manualTeamPool?.teamALineup || {}),
                    playingXI: manualPlayingXi?.teamA || [],
                  },
                },
                teamB: {
                  name: manualTeamPool?.teamBName || 'Team B',
                  players: manualTeamPool?.teamBPlayers || [],
                  lineup: {
                    ...(manualTeamPool?.teamBLineup || {}),
                    playingXI: manualPlayingXi?.teamB || [],
                  },
                },
              }}
              renderScore={renderManualScoreSummary}
              disabled={isLoadingManualPool}
            />
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
                <JsonTextareaField
                  wrapperClassName="match-upload-json"
                  label="Lineup JSON schema"
                  rows={10}
                  value={lineupPayloadText}
                  onChange={(event) => setLineupPayloadText(event.target.value)}
                  placeholder={buildLineupJsonSchemaTemplate(
                    manualTeamPool?.teamAName || 'MI',
                    manualTeamPool?.teamBName || 'KKR',
                  )}
                  onClear={() => setLineupPayloadText('')}
                  clearDisabled={!lineupPayloadText.trim()}
                />
                {Array.isArray(lineupJsonUnmatchedDetails) &&
                  lineupJsonUnmatchedDetails.length > 0 && (
                    <div className="json-upload-diagnostics" role="alert">
                      <h5>Unmatched Lineup Names</h5>
                      <p>
                        These names are not part of the selected match squads. Use the
                        suggestions and retry save.
                      </p>
                      <ul>
                        {lineupJsonUnmatchedDetails.map((entry, index) => {
                          const input =
                            (entry?.input || '').toString().trim() || 'unknown-player'
                          const team = (entry?.team || '').toString().trim() || '-'
                          const field = (entry?.field || '').toString().trim() || '-'
                          const suggestions = Array.isArray(entry?.suggestions)
                            ? entry.suggestions
                            : []
                          return (
                            <li key={`${team}-${field}-${input}-${index}`}>
                              <strong>{input}</strong>
                              <span>{`team: ${team} • field: ${field}`}</span>
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
              <JsonTextareaField
                wrapperClassName="match-upload-json"
                label="JSON schema"
                rows={10}
                value={uploadPayloadText}
                onChange={(event) => setUploadPayloadText(event.target.value)}
                placeholder={SCORE_JSON_SCHEMA_TEMPLATE}
                onClear={() => setUploadPayloadText('')}
                clearDisabled={!uploadPayloadText.trim()}
              />
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
        onClose={onCloseGeneratedScoreJson}
        ariaLabel="Generated score JSON"
        title="Generated Score JSON"
        description="Built from saved Playing XI/XII for this match. Copy it, update with AI, then paste into JSON Upload."
        jsonLabel="JSON Template"
        jsonText={generatedScoreJsonText}
        jsonFallback={SCORE_JSON_FALLBACK}
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
        onClose={onCloseGeneratedLineupJson}
        ariaLabel="Generated Playing XI JSON"
        title="Generated Playing XI JSON"
        description="Built from current squads and selected Playing XI/XII. Copy it, update with AI if needed, then paste into JSON Upload."
        jsonLabel="JSON Template"
        jsonText={generatedLineupJsonText}
        jsonFallback={LINEUP_JSON_FALLBACK}
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
        onClose={onCloseLineupPreview}
        ariaLabel="Processed lineup JSON preview"
        title="Processed Playing XI JSON"
        description="Review this normalized lineup payload. Confirm save to write it to the database."
        jsonLabel="Processed JSON"
        jsonText={lineupPreviewJsonText}
        jsonFallback={LINEUP_JSON_FALLBACK}
        jsonPreviewContent={
          <div className="processed-lineup-grid">
            {processedLineupPreviewTeams.map((team) => (
              <section key={team.name} className="processed-lineup-card">
                <header className="processed-lineup-card-head">
                  <h5>{team.name}</h5>
                  <span>{`${team.players.length} selected`}</span>
                </header>
                {team.players.length ? (
                  <ol className="processed-lineup-list">
                    {team.players.map((playerName, index) => (
                      <li key={`${team.name}-${playerName}-${index}`}>{playerName}</li>
                    ))}
                  </ol>
                ) : (
                  <p className="team-note">No Playing XI found.</p>
                )}
              </section>
            ))}
          </div>
        }
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
