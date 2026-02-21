import { useEffect, useMemo, useState } from 'react'
import Button from '../../components/ui/Button.jsx'
import DateTimeTimezoneField from '../../components/ui/DateTimeTimezoneField.jsx'
import SelectField from '../../components/ui/SelectField.jsx'
import StickyTable from '../../components/ui/StickyTable.jsx'
import { createAdminTournament, fetchAdminTeamSquads } from '../../lib/api.js'
import { getStoredUser } from '../../lib/auth.js'

const LEAGUE_MAP = {
  india: ['IPL', 'WPL'],
  australia: ['BBL', 'WBBL'],
  pakistan: ['PSL'],
  england: ['The Hundred', 'Vitality Blast'],
}
const TOURNAMENT_JSON_EXAMPLE = `{
  "name": "Pakistan Super League 2026",
  "season": "2026",
  "tournamentId": "psl-2026-custom",
  "source": "json",
  "tournamentType": "league",
  "country": "pakistan",
  "league": "PSL",
  "selectedTeams": ["KAR", "LAH", "ISL", "QUE"],
  "matches": [
    {
      "id": "m1",
      "matchNo": 1,
      "home": "KAR",
      "away": "LAH",
      "startAt": "2026-03-10T14:00",
      "timezone": "Asia/Kolkata",
      "location": "Karachi",
      "venue": "National Stadium"
    },
    {
      "id": "m2",
      "matchNo": 2,
      "home": "ISL",
      "away": "QUE",
      "startAt": "2026-03-11T14:00",
      "timezone": "Asia/Kolkata",
      "location": "Lahore",
      "venue": "Gaddafi Stadium"
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
  const [rows, setRows] = useState([emptyMatchRow(1), emptyMatchRow(2)])
  const [isSaving, setIsSaving] = useState(false)
  const [errorText, setErrorText] = useState('')
  const [notice, setNotice] = useState('')
  const [squadRows, setSquadRows] = useState([])
  const [tournamentType, setTournamentType] = useState('international')
  const [country, setCountry] = useState('')
  const [league, setLeague] = useState('')
  const [selectedTeams, setSelectedTeams] = useState([])

  useEffect(() => {
    let active = true
    const loadSquads = async () => {
      try {
        const data = await fetchAdminTeamSquads()
        if (!active) return
        setSquadRows(Array.isArray(data) ? data : [])
      } catch {
        if (!active) return
        setSquadRows([])
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
    availableTeams.length > 0 && availableTeams.every((row) => selectedTeamSet.has(row.teamCode))
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
      prev.map((row, i) => (i === index ? { ...row, [key]: normalized, [squadKey]: squad } : row)),
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
              prev.map((item, i) => (i === index ? { ...item, startAt: value, timezone } : item)),
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
              prev.map((item, i) => (i === index ? { ...item, location: event.target.value } : item)),
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
              prev.map((item, i) => (i === index ? { ...item, venue: event.target.value } : item)),
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
      setIsSaving(true)
      if (inputType === 'manual' && !name.trim()) {
        setErrorText('Tournament name is required')
        return
      }
      const actorUserId = currentUser?.gameName || currentUser?.email || currentUser?.id || ''
      if (inputType === 'json') {
        const parsed = JSON.parse(jsonPayload || '{}')
        await createAdminTournament({
          ...parsed,
          source: 'json',
          actorUserId,
        })
      } else {
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
        await createAdminTournament({
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
      setNotice('Tournament created')
      onCreated?.()
    } catch (error) {
      setErrorText(error.message || 'Failed to create tournament')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <section className="dashboard-section">
      <div className="admin-card dashboard-panel-card">
        <div className="contest-section-head">
          <h3>Create tournament</h3>
          <div className="top-actions">
            {inputType === 'manual' && manualStep === 'matches' && (
              <Button variant="ghost" size="small" onClick={() => setRows((prev) => [...prev, emptyMatchRow(prev.length + 1)])}>
                + Add match
              </Button>
            )}
            {(inputType === 'json' || manualStep === 'matches') && (
              <Button variant="primary" size="small" onClick={onSave} disabled={isSaving}>
                {isSaving ? 'Saving...' : 'Save tournament'}
              </Button>
            )}
          </div>
        </div>

        {!!errorText && <p className="error-text">{errorText}</p>}
        {!!notice && <p className="success-text">{notice}</p>}

        <div className="upload-tab-row" role="tablist" aria-label="Tournament input type">
          <Button
            type="button"
            role="tab"
            aria-selected={inputType === 'manual'}
            className={`upload-tab-btn ${inputType === 'manual' ? 'active' : ''}`.trim()}
            onClick={() => setInputType('manual')}
          >
            Manual
          </Button>
          <Button
            type="button"
            role="tab"
            aria-selected={inputType === 'json'}
            className={`upload-tab-btn ${inputType === 'json' ? 'active' : ''}`.trim()}
            onClick={() => setInputType('json')}
          >
            JSON
          </Button>
        </div>

        {inputType === 'json' ? (
          <label>
            JSON payload
            <textarea
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
                <div className="manual-scope-row">
                  <label>
                    Type
                    <SelectField
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
                  {tournamentType === 'league' && (
                    <>
                      <label>
                        Country
                        <SelectField
                          value={country}
                          onChange={(event) => {
                            setCountry(event.target.value)
                            setLeague('')
                            setSelectedTeams([])
                          }}
                          options={[{ value: '', label: 'Select country' }, ...Object.keys(LEAGUE_MAP).map((value) => ({ value, label: value }))]}
                        />
                      </label>
                      <label>
                        League
                        <SelectField
                          value={league}
                          onChange={(event) => {
                            setLeague(event.target.value)
                            setSelectedTeams([])
                          }}
                          options={[{ value: '', label: 'Select league' }, ...leagueOptions]}
                        />
                      </label>
                    </>
                  )}
                </div>

                <div className="manual-scope-row">
                  <label>
                    Tournament name
                    <input type="text" value={name} onChange={(event) => setName(event.target.value)} />
                  </label>
                  <label>
                    Season
                    <input type="text" value={season} onChange={(event) => setSeason(event.target.value)} />
                  </label>
                </div>

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
                  <Button variant="secondary" size="small" disabled={selectedTeams.length < 2} onClick={() => setManualStep('matches')}>
                    Next
                  </Button>
                </div>
              </>
            ) : (
              <>
                <div className="top-actions">
                  <Button variant="ghost" size="small" onClick={() => setManualStep('teams')}>
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
    </section>
  )
}

export default CreateTournamentPanel
