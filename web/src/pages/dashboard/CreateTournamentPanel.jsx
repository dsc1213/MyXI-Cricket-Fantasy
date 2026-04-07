import { useEffect, useMemo, useState } from 'react'
import Button from '../../components/ui/Button.jsx'
import DateTimeTimezoneField from '../../components/ui/DateTimeTimezoneField.jsx'
import JsonAssistantModal from '../../components/ui/JsonAssistantModal.jsx'
import SelectField from '../../components/ui/SelectField.jsx'
import StickyTable from '../../components/ui/StickyTable.jsx'
import {
  createAdminAuctionImport,
  createAdminTournament,
  fetchAdminTeamSquads,
  fetchTournamentCatalog,
} from '../../lib/api.js'
import { getStoredUser } from '../../lib/auth.js'

const LEAGUE_MAP = {
  india: ['IPL', 'WPL'],
  australia: ['BBL', 'WBBL'],
  pakistan: ['PSL'],
  england: ['The Hundred', 'Vitality Blast'],
}
const TOURNAMENT_JSON_EXAMPLE = `{
  "name": "IPL 2026",
  "season": "2026",
  "tournamentId": "ipl-2026-custom",
  "source": "json",
  "tournamentType": "league",
  "country": "india",
  "league": "IPL",
  "selectedTeams": ["RCB", "SRH", "MI", "CSK"],
  "matches": [
    {
      "id": "m1",
      "matchNo": 1,
      "home": "RCB",
      "away": "SRH",
      "startAt": "2026-03-10T14:00",
      "timezone": "Asia/Kolkata",
      "location": "Bengaluru",
      "venue": "M. Chinnaswamy Stadium"
    },
    {
      "id": "m2",
      "matchNo": 2,
      "home": "MI",
      "away": "CSK",
      "startAt": "2026-03-11T14:00",
      "timezone": "Asia/Kolkata",
      "location": "Mumbai",
      "venue": "Wankhede Stadium"
    }
  ]
}`

const buildAuctionJsonExample = (tournamentId = 'ipl-2026-custom') => `{
  "tournamentId": "${tournamentId}",
  "contestName": "NWMSU-IPL-AUCTION",
  "participants": [
    {
      "userId": "captain-a",
      "name": "Captain A",
      "roster": ["Ruturaj Gaikwad", "Tilak Varma", "Harshal Patel"]
    },
    {
      "userId": "draker",
      "name": "Draker",
      "roster": ["Heinrich Klaasen", "Rajat Patidar", "Yash Dayal"]
    }
  ]
}`

function emptyMatchRow(matchNo = 1) {
  return {
    id: `m${matchNo}`,
    home: '',
    away: '',
    startAt: '',
    timezone: 'UTC',
    location: '',
    venue: '',
    squadA: [],
    squadB: [],
    matchNo,
  }
}

function CreateTournamentPanel({ onCreated }) {
  const currentUser = getStoredUser()
  const [inputType, setInputType] = useState('manual')
  const [manualStep, setManualStep] = useState('teams')
  const [name, setName] = useState('')
  const [season, setSeason] = useState('2026')
  const [jsonPayload, setJsonPayload] = useState('')
  const [auctionPayload, setAuctionPayload] = useState('')
  const [rows, setRows] = useState([emptyMatchRow(1), emptyMatchRow(2)])
  const [isSaving, setIsSaving] = useState(false)
  const [errorText, setErrorText] = useState('')
  const [notice, setNotice] = useState('')
  const [squadRows, setSquadRows] = useState([])
  const [tournamentType, setTournamentType] = useState('international')
  const [country, setCountry] = useState('')
  const [league, setLeague] = useState('')
  const [selectedTeams, setSelectedTeams] = useState([])
  const [createdTournament, setCreatedTournament] = useState(null)
  const [tournamentCatalog, setTournamentCatalog] = useState([])
  const [isGeneratedJsonModalOpen, setIsGeneratedJsonModalOpen] = useState(false)
  const [generatedJsonText, setGeneratedJsonText] = useState('')
  const [generatedJsonKind, setGeneratedJsonKind] = useState('tournament')
  const [copyButtonLabel, setCopyButtonLabel] = useState('Copy JSON')
  const [copyPromptButtonLabel, setCopyPromptButtonLabel] = useState('Copy AI Prompt')

  useEffect(() => {
    let active = true
    const loadSquads = async () => {
      try {
        const data = await fetchAdminTeamSquads()
        const tournaments = await fetchTournamentCatalog()
        if (!active) return
        setSquadRows(Array.isArray(data) ? data : [])
        setTournamentCatalog(Array.isArray(tournaments) ? tournaments : [])
      } catch {
        if (!active) return
        setSquadRows([])
        setTournamentCatalog([])
      }
    }
    void loadSquads()
    return () => {
      active = false
    }
  }, [])

  useEffect(() => {
    if (inputType !== 'manual') setManualStep('teams')
  }, [inputType])

  const preferredAuctionTournamentId = useMemo(() => {
    if (createdTournament?.id && createdTournament?.kind !== 'auction') {
      return createdTournament.id
    }
    const catalogRows = Array.isArray(tournamentCatalog) ? tournamentCatalog : []
    const nonSeedRows = catalogRows.filter(
      (item) => (item?.source || '').toString().trim().toLowerCase() !== 'seed',
    )
    return nonSeedRows.at(-1)?.id || catalogRows.at(-1)?.id || 'ipl-2026-custom'
  }, [createdTournament, tournamentCatalog])

  const leagueOptions = useMemo(
    () => (LEAGUE_MAP[country] || []).map((value) => ({ value, label: value })),
    [country],
  )

  const availableTeams = useMemo(() => {
    return (squadRows || [])
      .filter((row) => {
        const rowType = (row.tournamentType || 'international').toLowerCase()
        if (rowType !== tournamentType) return false
        if (tournamentType === 'league') {
          if (!country) return false
          if ((row.country || '').toLowerCase() !== country.toLowerCase()) return false
          if (!league) return false
          if ((row.league || '').toLowerCase() !== league.toLowerCase()) return false
        }
        return true
      })
      .sort((a, b) => a.teamCode.localeCompare(b.teamCode))
  }, [squadRows, tournamentType, country, league])

  useEffect(() => {
    const valid = new Set(availableTeams.map((row) => row.teamCode))
    setSelectedTeams((prev) => prev.filter((code) => valid.has(code)))
  }, [availableTeams])

  const selectedTeamSet = useMemo(() => new Set(selectedTeams), [selectedTeams])
  const allVisibleTeamsSelected =
    availableTeams.length > 0 &&
    availableTeams.every((row) => selectedTeamSet.has(row.teamCode))
  const teamOptions = useMemo(
    () =>
      availableTeams
        .filter((row) => selectedTeamSet.has(row.teamCode))
        .map((row) => ({ value: row.teamCode, label: row.teamCode })),
    [availableTeams, selectedTeamSet],
  )

  useEffect(() => {
    const allowed = new Set(teamOptions.map((item) => item.value))
    setRows((prev) =>
      prev.map((row) => {
        const nextHome = allowed.has(row.home) ? row.home : ''
        const nextAway = allowed.has(row.away) ? row.away : ''
        if (nextHome === row.home && nextAway === row.away) return row
        return {
          ...row,
          home: nextHome,
          away: nextAway,
          squadA: nextHome ? row.squadA : [],
          squadB: nextAway ? row.squadB : [],
        }
      }),
    )
  }, [teamOptions])

  const teamTableColumns = [
    {
      key: 'enabled',
      headerClassName: 'select-all-header',
      label: (
        <label className="table-head-check">
          <input
            type="checkbox"
            checked={allVisibleTeamsSelected}
            onChange={(event) => {
              if (event.target.checked) {
                setSelectedTeams(availableTeams.map((row) => row.teamCode))
              } else {
                setSelectedTeams([])
              }
            }}
          />
          <span>Select all</span>
        </label>
      ),
      sortable: false,
      render: (row) => (
        <input
          type="checkbox"
          checked={selectedTeamSet.has(row.teamCode)}
          onChange={(event) =>
            setSelectedTeams((prev) =>
              event.target.checked
                ? prev.includes(row.teamCode)
                  ? prev
                  : [...prev, row.teamCode]
                : prev.filter((item) => item !== row.teamCode),
            )
          }
        />
      ),
    },
    { key: 'teamCode', label: 'Code' },
    { key: 'teamName', label: 'Team' },
    { key: 'activePlayersCount', label: 'Players' },
  ]

  const onMatchTeamChange = (index, key, value) => {
    const normalized = (value || '').toUpperCase()
    const squadKey = key === 'home' ? 'squadA' : 'squadB'
    const squad =
      (availableTeams.find((row) => row.teamCode === normalized)?.squad || [])
        .filter((item) => item?.active !== false)
        .map((item) => item?.name)
        .filter(Boolean) || []
    setRows((prev) =>
      prev.map((row, i) =>
        i === index ? { ...row, [key]: normalized, [squadKey]: squad } : row,
      ),
    )
  }

  const matchTableColumns = [
    {
      key: 'matchNo',
      label: '#',
      sortable: false,
      headerClassName: 'match-no-col',
      cellClassName: 'match-no-col',
      render: (_, index) => <span className="match-no-readonly">{index + 1}</span>,
    },
    {
      key: 'home',
      label: 'Team A',
      sortable: false,
      render: (row, index) => (
        <SelectField
          value={row.home}
          onChange={(event) => onMatchTeamChange(index, 'home', event.target.value)}
          options={[
            { value: '', label: 'Select Team A' },
            ...teamOptions.filter((item) => item.value !== row.away),
          ]}
        />
      ),
    },
    {
      key: 'away',
      label: 'Team B',
      sortable: false,
      render: (row, index) => (
        <SelectField
          value={row.away}
          onChange={(event) => onMatchTeamChange(index, 'away', event.target.value)}
          options={[
            { value: '', label: 'Select Team B' },
            ...teamOptions.filter((item) => item.value !== row.home),
          ]}
        />
      ),
    },
    {
      key: 'startAt',
      label: 'Match Start',
      sortable: false,
      render: (row, index) => (
        <DateTimeTimezoneField
          value={row.startAt}
          timezone={row.timezone || 'UTC'}
          onChange={({ value, timezone }) =>
            setRows((prev) =>
              prev.map((item, i) =>
                i === index ? { ...item, startAt: value, timezone } : item,
              ),
            )
          }
        />
      ),
    },
    {
      key: 'location',
      label: 'Location',
      sortable: false,
      render: (row, index) => (
        <input
          type="text"
          placeholder="Optional"
          value={row.location}
          onChange={(event) =>
            setRows((prev) =>
              prev.map((item, i) =>
                i === index ? { ...item, location: event.target.value } : item,
              ),
            )
          }
        />
      ),
    },
    {
      key: 'venue',
      label: 'Stadium',
      sortable: false,
      render: (row, index) => (
        <input
          type="text"
          placeholder="Optional"
          value={row.venue}
          onChange={(event) =>
            setRows((prev) =>
              prev.map((item, i) =>
                i === index ? { ...item, venue: event.target.value } : item,
              ),
            )
          }
        />
      ),
    },
  ]

  const onSave = async () => {
    try {
      setErrorText('')
      setNotice('')
      setCreatedTournament(null)
      setIsSaving(true)
      if (inputType === 'manual' && !name.trim()) {
        setErrorText('Tournament name is required')
        return
      }
      const actorUserId =
        currentUser?.gameName || currentUser?.email || currentUser?.id || ''
      const knownTournamentIds = new Set(
        (tournamentCatalog || []).map((item) =>
          (item.id || '').toString().trim().toLowerCase(),
        ),
      )
      let response
      if (inputType === 'auction') {
        const parsed = JSON.parse(auctionPayload || '{}')
        response = await createAdminAuctionImport({
          ...parsed,
          actorUserId,
        })
      } else if (inputType === 'json') {
        const parsed = JSON.parse(jsonPayload || '{}')
        const requestedId = (
          parsed?.tournamentId || `${parsed?.name || ''}-${parsed?.season || ''}`
        )
          .toString()
          .trim()
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/^-+|-+$/g, '')
        if (requestedId && knownTournamentIds.has(requestedId)) {
          setErrorText(`Tournament already exists: ${parsed?.name || requestedId}`)
          return
        }
        response = await createAdminTournament({
          ...parsed,
          source: 'json',
          actorUserId,
        })
      } else {
        const requestedId = `${name}-${season}`
          .toString()
          .trim()
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/^-+|-+$/g, '')
        if (requestedId && knownTournamentIds.has(requestedId)) {
          setErrorText(`Tournament already exists: ${name}`)
          return
        }
        const matches = rows
          .map((row, index) => ({
            id: row.id || `m${index + 1}`,
            matchNo: index + 1,
            home: (row.home || '').toUpperCase(),
            away: (row.away || '').toUpperCase(),
            startAt: row.startAt,
            date: row.startAt ? row.startAt.slice(0, 10) : '',
            timezone: row.timezone || 'UTC',
            location: row.location || '',
            venue: row.venue || '',
            squadA: row.squadA || [],
            squadB: row.squadB || [],
          }))
          .filter((row) => row.home && row.away && row.startAt)
        response = await createAdminTournament({
          name,
          season,
          source: 'manual',
          tournamentType,
          country: tournamentType === 'league' ? country : '',
          league: tournamentType === 'league' ? league : '',
          selectedTeams,
          matches,
          actorUserId,
        })
      }
      const createdId =
        response?.contest?.id ||
        response?.tournament?.id ||
        response?.tournamentId ||
        response?.id ||
        ''
      const createdName =
        response?.contest?.name ||
        response?.tournament?.name ||
        response?.name ||
        name ||
        'Tournament'
      const createdMatchesCount =
        Number(response?.tournament?.matchesCount) ||
        Number(response?.matchesCount) ||
        (inputType === 'auction'
          ? Number(response?.participantsImported || 0)
          : inputType === 'json'
            ? Array.isArray(response?.tournament?.matches)
              ? response.tournament.matches.length
              : Array.isArray(JSON.parse(jsonPayload || '{}')?.matches)
                ? JSON.parse(jsonPayload || '{}').matches.length
                : 0
            : rows.filter((row) => row.home && row.away && row.startAt).length)
      setCreatedTournament(
        createdId
          ? {
              id: createdId,
              name: createdName,
              matchesCount: createdMatchesCount,
              kind: inputType,
            }
          : null,
      )
      setNotice(
        inputType === 'auction'
          ? `Auction imported: ${createdName}`
          : `Tournament created: ${createdName}`,
      )
      if (inputType === 'auction') {
        setAuctionPayload('')
      } else if (inputType === 'json') {
        setJsonPayload('')
      }
      if (inputType !== 'auction') {
        setTournamentCatalog((prev) => {
          const next = Array.isArray(prev) ? [...prev] : []
          if (!next.some((item) => item.id === createdId)) {
            next.push({ id: createdId, name: createdName })
          }
          return next
        })
      }
      onCreated?.({ tournamentId: createdId, tournamentName: createdName })
    } catch (error) {
      setErrorText(error.message || 'Failed to create tournament')
    } finally {
      setIsSaving(false)
    }
  }

  const onGenerateTournamentJson = () => {
    setGeneratedJsonKind('tournament')
    setGeneratedJsonText(TOURNAMENT_JSON_EXAMPLE)
    setIsGeneratedJsonModalOpen(true)
    setCopyButtonLabel('Copy JSON')
    setErrorText('')
    setNotice('Tournament JSON template generated. Copy and paste into JSON payload.')
  }

  const onGenerateAuctionJson = () => {
    setGeneratedJsonKind('auction')
    setGeneratedJsonText(buildAuctionJsonExample(preferredAuctionTournamentId))
    setIsGeneratedJsonModalOpen(true)
    setCopyButtonLabel('Copy JSON')
    setErrorText('')
    setNotice(
      'Auction JSON template generated. Copy and paste into Auction JSON payload.',
    )
  }

  const onCloseGeneratedJsonModal = () => {
    setIsGeneratedJsonModalOpen(false)
    setCopyButtonLabel('Copy JSON')
    setCopyPromptButtonLabel('Copy AI Prompt')
  }

  const onCopyGeneratedJson = async () => {
    if (!generatedJsonText) return
    try {
      await navigator.clipboard.writeText(generatedJsonText)
      setCopyButtonLabel('Copied')
      window.setTimeout(() => setCopyButtonLabel('Copy JSON'), 1200)
    } catch {
      setCopyButtonLabel('Copy failed')
      window.setTimeout(() => setCopyButtonLabel('Copy JSON'), 1600)
    }
  }

  const generatedJsonAiPromptText = useMemo(() => {
    const templateJson = generatedJsonText || '{\n}\n'
    if (generatedJsonKind === 'auction') {
      return [
        'Convert source notes into the exact JSON format used by /admin/auctions/import.',
        '',
        'Rules:',
        '- Return valid JSON only.',
        '- Do not include markdown, code fences, or explanations.',
        '- Keep top-level shape as {"tournamentId": "...", "contestName": "...", "participants": [...]}',
        '- Each participant must include userId, name, and roster array.',
        '- roster must include valid player names as strings.',
        '',
        'Template JSON:',
        templateJson,
        '',
        'Source auction notes:',
        'PASTE_AUCTION_NOTES_HERE',
      ].join('\n')
    }
    return [
      'Convert source notes into the exact JSON format used by /admin/tournaments.',
      '',
      'Rules:',
      '- Return valid JSON only.',
      '- Do not include markdown, code fences, or explanations.',
      '- Keep top-level keys compatible with tournament import payload.',
      '- Include: name, season, tournamentId, source, tournamentType, selectedTeams, matches.',
      '- Each match should include id, matchNo, home, away, startAt, timezone and optional venue/location.',
      '',
      'Template JSON:',
      templateJson,
      '',
      'Source tournament notes:',
      'PASTE_TOURNAMENT_NOTES_HERE',
    ].join('\n')
  }, [generatedJsonKind, generatedJsonText])

  const onCopyGeneratedJsonPrompt = async () => {
    if (!generatedJsonAiPromptText) return
    try {
      await navigator.clipboard.writeText(generatedJsonAiPromptText)
      setCopyPromptButtonLabel('Copied')
      window.setTimeout(() => setCopyPromptButtonLabel('Copy AI Prompt'), 1200)
    } catch {
      setCopyPromptButtonLabel('Copy failed')
      window.setTimeout(() => setCopyPromptButtonLabel('Copy AI Prompt'), 1600)
    }
  }

  return (
    <section className="dashboard-section create-tournament-section">
      <div className="admin-card dashboard-panel-card create-tournament-card">
        <div className="create-tournament-top">
          <div className="contest-section-head">
            <h3>Create tournament</h3>
            <div className="top-actions">
              {(inputType === 'json' || inputType === 'auction') && (
                <Button
                  variant="secondary"
                  size="small"
                  onClick={
                    inputType === 'auction'
                      ? onGenerateAuctionJson
                      : onGenerateTournamentJson
                  }
                  disabled={isSaving}
                >
                  Generate JSON
                </Button>
              )}
              {inputType === 'manual' && manualStep === 'matches' && (
                <Button
                  variant="ghost"
                  size="small"
                  onClick={() =>
                    setRows((prev) => [...prev, emptyMatchRow(prev.length + 1)])
                  }
                >
                  + Add match
                </Button>
              )}
              {(inputType === 'json' ||
                inputType === 'auction' ||
                manualStep === 'matches') && (
                <Button
                  variant="primary"
                  size="small"
                  onClick={onSave}
                  disabled={isSaving}
                >
                  {isSaving
                    ? 'Saving...'
                    : inputType === 'auction'
                      ? 'Import auction'
                      : 'Save tournament'}
                </Button>
              )}
            </div>
          </div>

          {!!errorText && (
            <div className="error-text create-tournament-inline-error" role="alert">
              {errorText}
            </div>
          )}
          {!!notice && <p className="success-text">{notice}</p>}
          {isSaving && inputType === 'auction' && (
            <div className="create-tournament-loading" role="status" aria-live="polite">
              <strong>Importing auction data...</strong>
              <span>Validating tournament, players, and participant rosters.</span>
            </div>
          )}
          {createdTournament && (
            <div className="create-tournament-success" role="status" aria-live="polite">
              <div className="create-tournament-success-copy">
                <strong>
                  {createdTournament.kind === 'auction'
                    ? 'Auction saved successfully.'
                    : 'Tournament saved successfully.'}
                </strong>
                <span>
                  {createdTournament.name}
                  {createdTournament.kind === 'auction'
                    ? ` • ${createdTournament.matchesCount} participants imported`
                    : createdTournament.matchesCount
                      ? ` • ${createdTournament.matchesCount} matches imported`
                      : ''}
                </span>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="small"
                onClick={() => onCreated?.({ ...createdTournament, openAdmin: true })}
              >
                Open Tournament Manager
              </Button>
            </div>
          )}

          <div
            className="create-tournament-input-tabs"
            role="tablist"
            aria-label="Tournament input type"
          >
            <Button
              type="button"
              variant="ghost"
              role="tab"
              aria-selected={inputType === 'manual'}
              className={`create-tournament-input-tab ${inputType === 'manual' ? 'active' : ''}`.trim()}
              onClick={() => setInputType('manual')}
            >
              Manual
            </Button>
            <Button
              type="button"
              variant="ghost"
              role="tab"
              aria-selected={inputType === 'json'}
              className={`create-tournament-input-tab ${inputType === 'json' ? 'active' : ''}`.trim()}
              onClick={() => setInputType('json')}
            >
              JSON
            </Button>
            <Button
              type="button"
              variant="ghost"
              role="tab"
              aria-selected={inputType === 'auction'}
              className={`create-tournament-input-tab ${inputType === 'auction' ? 'active' : ''}`.trim()}
              onClick={() => setInputType('auction')}
            >
              Auction
            </Button>
          </div>
        </div>

        {inputType === 'auction' ? (
          <label>
            Auction JSON payload
            <span className="field-help-text auction-json-help">
              Accepted shape: <code>tournamentId</code>, <code>contestName</code>, and{' '}
              <code>participants</code> with <code>userId</code>, <code>name</code>, and{' '}
              <code>roster</code>. This matches the output from{' '}
              <code>api/scripts/build_auction_import.py</code>.
            </span>
            <textarea
              className="dashboard-json-textarea"
              rows={14}
              value={auctionPayload}
              onChange={(event) => setAuctionPayload(event.target.value)}
              placeholder={buildAuctionJsonExample(preferredAuctionTournamentId)}
            />
          </label>
        ) : inputType === 'json' ? (
          <label>
            JSON payload
            <textarea
              className="dashboard-json-textarea"
              rows={14}
              value={jsonPayload}
              onChange={(event) => setJsonPayload(event.target.value)}
              placeholder={TOURNAMENT_JSON_EXAMPLE}
            />
          </label>
        ) : (
          <>
            <p className="team-note breadcrumb-note">
              Create Tournament / {manualStep === 'teams' ? 'Teams' : 'Matches'}
            </p>
            {manualStep === 'teams' ? (
              <>
                <div
                  className={`manual-scope-row create-tournament-teams-primary-fields ${tournamentType === 'league' ? 'league-mode' : 'international-mode'}`.trim()}
                >
                  <label>
                    Type
                    <SelectField
                      className="dashboard-text-input"
                      value={tournamentType}
                      onChange={(event) => {
                        const next = event.target.value
                        setTournamentType(next)
                        setCountry('')
                        setLeague('')
                        setSelectedTeams([])
                      }}
                      options={[
                        { value: 'international', label: 'International' },
                        { value: 'league', label: 'League' },
                      ]}
                    />
                  </label>
                  <label>
                    Tournament name
                    <input
                      className="dashboard-text-input"
                      type="text"
                      value={name}
                      onChange={(event) => setName(event.target.value)}
                    />
                  </label>
                  <label>
                    Season
                    <input
                      className="dashboard-text-input"
                      type="text"
                      value={season}
                      onChange={(event) => setSeason(event.target.value)}
                    />
                  </label>
                </div>

                {tournamentType === 'league' ? (
                  <div className="manual-scope-row create-tournament-teams-secondary-fields league-mode">
                    <label>
                      Country
                      <SelectField
                        className="dashboard-text-input"
                        value={country}
                        onChange={(event) => {
                          setCountry(event.target.value)
                          setLeague('')
                          setSelectedTeams([])
                        }}
                        options={[
                          { value: '', label: 'Select country' },
                          ...Object.keys(LEAGUE_MAP).map((value) => ({
                            value,
                            label: value,
                          })),
                        ]}
                      />
                    </label>
                    <label>
                      League
                      <SelectField
                        className="dashboard-text-input"
                        value={league}
                        onChange={(event) => {
                          setLeague(event.target.value)
                          setSelectedTeams([])
                        }}
                        options={[
                          { value: '', label: 'Select league' },
                          ...leagueOptions,
                        ]}
                      />
                    </label>
                  </div>
                ) : null}

                <div className="create-contest-field">
                  <span>Available teams</span>
                  <StickyTable
                    columns={teamTableColumns}
                    rows={availableTeams}
                    rowKey={(row) => row.teamCode}
                    emptyText="No teams available"
                    wrapperClassName="catalog-table-wrap create-tournament-teams-table"
                    tableClassName="catalog-table"
                  />
                </div>
                <div className="top-actions">
                  <Button
                    variant="secondary"
                    size="small"
                    disabled={selectedTeams.length < 2}
                    onClick={() => setManualStep('matches')}
                  >
                    Next
                  </Button>
                </div>
              </>
            ) : (
              <>
                <div className="top-actions">
                  <Button
                    variant="ghost"
                    size="small"
                    onClick={() => setManualStep('teams')}
                  >
                    Back
                  </Button>
                </div>
                <div className="create-contest-field">
                  <span>Matches</span>
                  <StickyTable
                    columns={matchTableColumns}
                    rows={rows}
                    rowKey={(row, index) => `${row.id}-${index}`}
                    emptyText="No rows"
                    wrapperClassName="catalog-table-wrap create-tournament-matches-table"
                    tableClassName="catalog-table"
                  />
                </div>
              </>
            )}
          </>
        )}
      </div>

      <JsonAssistantModal
        open={isGeneratedJsonModalOpen}
        ariaLabel={
          generatedJsonKind === 'auction'
            ? 'Generated Auction JSON'
            : 'Generated Tournament JSON'
        }
        title={
          generatedJsonKind === 'auction'
            ? 'Generated Auction JSON'
            : 'Generated Tournament JSON'
        }
        description="Copy this template, then paste it into the corresponding JSON textarea."
        jsonLabel="JSON Template"
        jsonText={generatedJsonText}
        jsonFallback="{\n}\n"
        onCopyJson={onCopyGeneratedJson}
        copyJsonLabel={copyButtonLabel}
        disableCopyJson={!generatedJsonText}
        promptLabel={
          generatedJsonKind === 'auction'
            ? 'AI Prompt For Auction JSON'
            : 'AI Prompt For Tournament JSON'
        }
        promptText={generatedJsonAiPromptText}
        onCopyPrompt={onCopyGeneratedJsonPrompt}
        copyPromptLabel={copyPromptButtonLabel}
        disableCopyPrompt={!generatedJsonAiPromptText}
        footerActions={[
          {
            label: 'Close',
            variant: 'secondary',
            onClick: onCloseGeneratedJsonModal,
            disabled: false,
          },
        ]}
      />
    </section>
  )
}

export default CreateTournamentPanel
