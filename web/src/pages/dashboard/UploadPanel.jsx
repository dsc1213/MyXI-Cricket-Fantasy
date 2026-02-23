import { useState } from 'react'
import Button from '../../components/ui/Button.jsx'
import { CountryText } from '../../components/ui/CountryFlag.jsx'
import SelectField from '../../components/ui/SelectField.jsx'
import StickyTable from '../../components/ui/StickyTable.jsx'
import { getCountryFlag } from '../../components/ui/countryFlagUtils.js'

function UploadPanel({
  uploadTab,
  setUploadTab,
  manualGameType,
  setManualGameType,
  manualGameOptions,
  uploadPayloadText,
  setUploadPayloadText,
  manualScoreContext,
  manualTournamentId,
  setManualTournamentId,
  manualMatchId,
  setManualMatchId,
  manualTeamPool,
  manualPlayerStats,
  onManualStatChange,
  onSaveManualScores,
  isLoadingManualPool,
  uploadFileName,
  setUploadFileName,
  isDragOver,
  setIsDragOver,
  onProcessExcel,
  isProcessingExcel,
  excelPreviewRows,
  excelPreviewMeta,
  onSaveScores,
  isSavingScores,
}) {
  const categoryColumns = {
    batting: [
      { key: 'runs', label: 'Runs' },
      { key: 'fours', label: '4s' },
      { key: 'sixes', label: '6s' },
      { key: 'dismissed', label: 'Out', type: 'checkbox' },
    ],
    bowling: [
      { key: 'wickets', label: 'Wkts' },
      { key: 'maidens', label: 'Maidens' },
      { key: 'wides', label: 'Wides/NB' },
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
  const manualCategoryTabs = [
    { key: 'batting', label: 'Bat' },
    { key: 'bowling', label: 'Bowl' },
    { key: 'fielding', label: 'Field' },
  ]
  const manualPlayersCount =
    (manualTeamPool?.teamAPlayers?.length || 0) + (manualTeamPool?.teamBPlayers?.length || 0)
  const hasManualPlayers = manualPlayersCount > 0
  const [activeManualCategory, setActiveManualCategory] = useState('batting')
  const activeColumns = categoryColumns[activeManualCategory] || categoryColumns.batting
  const getMatchOptionLabel = (item) => {
    const rawLabel = item.label || item.name || ''
    const normalized = rawLabel.includes(':') ? rawLabel.split(':').slice(1).join(':').trim() : rawLabel
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
      render: (row) => <span className="manual-player-name">{row.name}</span>,
    },
    {
      key: 'role',
      label: 'Role',
      headerClassName: 'manual-col-role',
      cellClassName: 'manual-col-role manual-player-role',
      sortValue: (row) => row.role || '',
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
            value={value[column.key] ?? 0}
            onChange={(event) => onManualStatChange(row.id, column.key, event.target.value)}
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
      <h4>
        <CountryText value={title} />
      </h4>
      <StickyTable
        columns={manualColumns}
        rows={players}
        rowKey={(row) => row.id}
        emptyText="No players"
        wrapperClassName="manual-team-table-wrap"
        tableClassName="manual-team-table"
      />
    </article>
  )

  return (
    <section className="dashboard-section match-scores-section">
      <div className="admin-card dashboard-panel-card match-scores-panel">
        <div className="match-upload-form">
          <div className="upload-tab-head">
            <div className="upload-tab-row" role="tablist" aria-label="Score upload type">
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
              <Button
                type="button"
                role="tab"
                aria-selected={uploadTab === 'excel'}
                className={`upload-tab-btn ${uploadTab === 'excel' ? 'active' : ''}`.trim()}
                disabled
                title="Excel upload is disabled for MVP. Use JSON or Manual."
                onClick={() => setUploadTab('excel')}
              >
                Excel Upload
              </Button>
            </div>
            <p className="team-note">Excel upload is disabled for now. Use Manual or JSON.</p>
            {uploadTab === 'manual' && (
              <div className="top-actions upload-head-actions">
                <Button
                  type="button"
                  className="cta small upload-action-btn primary"
                  onClick={onSaveManualScores}
                  disabled={
                    isSavingScores ||
                    !manualTournamentId ||
                    !manualMatchId ||
                    isLoadingManualPool
                  }
                >
                  {isSavingScores ? 'Saving...' : 'Save'}
                </Button>
              </div>
            )}
          </div>

          <div className="manual-scope-row">
            <label>
              Type
              <SelectField
                value={manualGameType}
                onChange={(event) => setManualGameType(event.target.value)}
              >
                {(manualGameOptions || []).map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </SelectField>
            </label>
            <label>
              Tournament
              <SelectField
                value={manualTournamentId}
                onChange={(event) => setManualTournamentId(event.target.value)}
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
                onChange={(event) => setManualMatchId(event.target.value)}
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
          {uploadTab === 'manual' && (
            <div className="manual-category-row">
              <div className="manual-category-inline" role="tablist" aria-label="Manual score category">
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

          {uploadTab === 'manual' ? (
            <div className={`manual-entry-layout ${hasManualPlayers ? '' : 'empty'}`.trim()}>
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
                    {manualTeamTabs.map((team) =>
                      renderManualTeamTable(team.name, team.players),
                    )}
                  </div>
                </>
              )}
            </div>
          ) : uploadTab === 'json' ? (
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
              <div className="top-actions upload-actions upload-actions-full">
                <Button
                  type="button"
                  className="cta small upload-action-btn primary"
                  onClick={onSaveScores}
                  disabled={
                    isSavingScores ||
                    !manualTournamentId ||
                    !manualMatchId
                  }
                >
                  {isSavingScores ? 'Saving...' : 'Save'}
                </Button>
              </div>
            </div>
          ) : (
            <div className="excel-upload-layout">
              <div className="excel-left">
                <label className="upload-field">
                  Excel Upload
                  <input
                    id="excel-upload"
                    type="file"
                    accept=".xlsx,.xls,.csv"
                    className="native-file-input"
                    onChange={(event) => {
                      const file = event.target.files?.[0]
                      setUploadFileName(file ? file.name : 'No file selected')
                    }}
                  />
                  <label
                    htmlFor="excel-upload"
                    className={`upload-dropzone ${isDragOver ? 'dragover' : ''}`.trim()}
                    onDragOver={(event) => {
                      event.preventDefault()
                      setIsDragOver(true)
                    }}
                    onDragLeave={() => setIsDragOver(false)}
                    onDrop={(event) => {
                      event.preventDefault()
                      setIsDragOver(false)
                      const file = event.dataTransfer.files?.[0]
                      setUploadFileName(file ? file.name : 'No file selected')
                    }}
                  >
                    <strong>Drop Excel here</strong>
                    <span>or click to upload (.xlsx, .xls, .csv)</span>
                    <em>{uploadFileName}</em>
                  </label>
                </label>
                <div className="excel-actions">
                  <Button
                    type="button"
                    className="cta small upload-action-btn"
                    onClick={onProcessExcel}
                    disabled={isProcessingExcel}
                  >
                    {isProcessingExcel ? 'Processing...' : 'Process Excel'}
                  </Button>
                  <Button
                    type="button"
                    className="cta small upload-action-btn primary"
                    onClick={onSaveScores}
                    disabled={
                      isSavingScores ||
                      !excelPreviewRows.length ||
                      !manualTournamentId ||
                      !manualMatchId
                    }
                  >
                    {isSavingScores ? 'Saving...' : 'Save'}
                  </Button>
                </div>
              </div>

              <div className="excel-right">
                <div className="excel-preview-head">
                  <h4>Processed Preview</h4>
                  <p>
                    {excelPreviewMeta
                      ? `${excelPreviewMeta.processedRows} rows from ${excelPreviewMeta.fileName}`
                      : 'Upload and process an Excel file to preview data'}
                  </p>
                </div>
                {!!excelPreviewRows.length && (
                  <div className="excel-preview-table-wrap">
                    <StickyTable
                      columns={excelPreviewColumns}
                      rows={excelPreviewRows}
                      rowKey={(row) => row.playerId}
                      tableClassName="excel-preview-table"
                      emptyText="No preview rows"
                    />
                  </div>
                )}
              </div>
            </div>
          )}

        </div>
      </div>
    </section>
  )
}

export default UploadPanel
