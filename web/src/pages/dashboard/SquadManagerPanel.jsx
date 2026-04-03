import { useEffect, useMemo, useState } from 'react'
import Button from '../../components/ui/Button.jsx'
import SelectField from '../../components/ui/SelectField.jsx'
import StickyTable from '../../components/ui/StickyTable.jsx'
import {
  fetchPlayers,
  fetchAdminTeamSquads,
  fetchTournamentCatalog,
  upsertAdminTeamSquad,
} from '../../lib/api.js'
import { getStoredUser } from '../../lib/auth.js'

const LEAGUE_MAP = {
  india: ['IPL', 'WPL'],
  australia: ['BBL', 'WBBL'],
  pakistan: ['PSL'],
  england: ['The Hundred', 'Vitality Blast'],
}
const LEAGUE_TEAM_MAP = {
  IPL: {
    CSK: 'Chennai Super Kings',
    DC: 'Delhi Capitals',
    GT: 'Gujarat Titans',
    KKR: 'Kolkata Knight Riders',
    LSG: 'Lucknow Super Giants',
    MI: 'Mumbai Indians',
    PBKS: 'Punjab Kings',
    RR: 'Rajasthan Royals',
    RCB: 'Royal Challengers Bengaluru',
    SRH: 'Sunrisers Hyderabad',
  },
  WPL: {
    DCW: 'Delhi Capitals Women',
    GG: 'Gujarat Giants',
    MIW: 'Mumbai Indians Women',
    RCBW: 'Royal Challengers Bengaluru Women',
    UPW: 'UP Warriorz',
  },
  PSL: {
    IU: 'Islamabad United',
    KK: 'Karachi Kings',
    LQ: 'Lahore Qalandars',
    MS: 'Multan Sultans',
    PZ: 'Peshawar Zalmi',
    QG: 'Quetta Gladiators',
  },
  BBL: {},
  WBBL: {},
  'The Hundred': {},
  'Vitality Blast': {},
}

const NEW_TEAM_KEY = '__new__'
const PLAYER_ROLE_OPTIONS = ['', 'BAT', 'BOWL', 'AR', 'WK']
const SQUAD_JSON_EXAMPLE = `{
  "teamCode": "CSK",
  "teamName": "Chennai Super Kings",
  "tournamentType": "league",
  "country": "india",
  "league": "IPL",
  "tournament": "IPL 2026",
  "source": "json",
  "squad": [
    {
      "name": "MS Dhoni",
      "country": "india",
      "role": "WK",
      "imageUrl": "https://cdn.example.com/ms-dhoni.png",
      "battingStyle": "Right-hand bat",
      "bowlingStyle": "",
      "active": true
    },
    {
      "name": "Ruturaj Gaikwad",
      "country": "india",
      "role": "BAT",
      "battingStyle": "Right-hand bat",
      "bowlingStyle": "Right-arm offbreak",
      "active": true
    }
  ]
}`
const buildTeamCodeFromName = (value = '') => {
  const words = value
    .toString()
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9 ]+/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
  if (!words.length) return ''
  const initials = words.map((part) => part[0]).join('')
  return (initials || words.join('')).slice(0, 6)
}
const formatCountryLabel = (value = '') =>
  value
    .toString()
    .trim()
    .split(/\s+/)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(' ')

function buildPlayerRow(index, seed = {}) {
  return {
    id: `player-${Date.now()}-${index + 1}`,
    canonicalPlayerId: seed.canonicalPlayerId || seed.playerRowId || seed.id || '',
    sourceKey: (seed.sourceKey || '').toString(),
    playerId: (seed.playerId || '').toString(),
    name: (seed.name || '').toString(),
    country: (seed.country || '').toString(),
    role: (seed.role || '').toString().toUpperCase(),
    imageUrl: (seed.imageUrl || '').toString(),
    battingStyle: (seed.battingStyle || '').toString(),
    bowlingStyle: (seed.bowlingStyle || '').toString(),
    active: seed.active !== false,
  }
}

function SquadManagerPanel() {
  const currentUser = getStoredUser()
  const [rows, setRows] = useState([])
  const [tournamentRows, setTournamentRows] = useState([])
  const [playerCatalog, setPlayerCatalog] = useState([])
  const [, setIsLoading] = useState(true)
  const [errorText, setErrorText] = useState('')
  const [notice, setNotice] = useState('')
  const [mode, setMode] = useState('manual')
  const [isSaving, setIsSaving] = useState(false)
  const [jsonPayload, setJsonPayload] = useState('')

  const [tournamentType, setTournamentType] = useState('international')
  const [country, setCountry] = useState('')
  const [league, setLeague] = useState('')
  const [tournamentId, setTournamentId] = useState('')
  const [team, setTeam] = useState('')
  const [newTeamCode, setNewTeamCode] = useState('')
  const [teamName, setTeamName] = useState('')
  const [players, setPlayers] = useState([])
  const [playerSearch, setPlayerSearch] = useState('')
  const [existingPlayerQuery, setExistingPlayerQuery] = useState('')
  const [selectedExistingPlayerId, setSelectedExistingPlayerId] = useState('')

  const actorUserId = currentUser?.gameName || currentUser?.email || currentUser?.id || ''

  const loadSquads = async () => {
    try {
      setIsLoading(true)
      setErrorText('')
      const data = await fetchAdminTeamSquads({
        tournamentId: tournamentType === 'tournament' ? tournamentId : '',
      })
      setRows(Array.isArray(data) ? data : [])
      const tournaments = await fetchTournamentCatalog()
      setTournamentRows(Array.isArray(tournaments) ? tournaments : [])
      const catalog = await fetchPlayers()
      setPlayerCatalog(Array.isArray(catalog) ? catalog : [])
    } catch (error) {
      setErrorText(error.message || 'Failed to load squads')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    void loadSquads()
  }, [tournamentType, tournamentId])

  const countryOptions = useMemo(() => {
    if (tournamentType === 'international') {
      const list = Array.from(
        new Set(
          rows
            .filter((row) => (row.tournamentType || 'international') === 'international')
            .map((row) => (row.country || row.teamCode || '').toString().trim())
            .filter(Boolean),
        ),
      ).sort((a, b) => a.localeCompare(b))
      return list.map((item) => ({ value: item, label: item }))
    }
    if (tournamentType === 'league') {
      return Object.keys(LEAGUE_MAP).map((item) => ({ value: item, label: item }))
    }
    return []
  }, [rows, tournamentType])

  const tournamentOptions = useMemo(
    () =>
      (tournamentRows || [])
        .sort((a, b) => (a.name || '').localeCompare(b.name || ''))
        .map((item) => ({
          value: item.id,
          label: item.name || item.id,
        })),
    [tournamentRows],
  )
  const selectedTournament = useMemo(
    () => tournamentRows.find((item) => item.id === tournamentId) || null,
    [tournamentRows, tournamentId],
  )
  const selectedTournamentName = (selectedTournament?.name || '').toString().trim().toLowerCase()

  const leagueOptions = useMemo(
    () => (LEAGUE_MAP[country] || []).map((item) => ({ value: item, label: item })),
    [country],
  )
  const playerCountryOptions = useMemo(() => {
    const known = new Set(
      rows
        .map((item) => (item.country || '').toString().trim().toLowerCase())
        .filter(Boolean),
    )
    Object.keys(LEAGUE_MAP).forEach((item) => known.add(item.toLowerCase()))
    if (country) known.add(country.toLowerCase())
    return [...known]
      .sort((a, b) => a.localeCompare(b))
      .map((item) => ({ value: item, label: formatCountryLabel(item) }))
  }, [rows, country])

  const matchesCurrentScope = (row) => {
    const rowType = (row.tournamentType || 'international').toString().toLowerCase()
    if (rowType !== tournamentType) return false
    if (tournamentType === 'tournament') {
      const rowTournamentId = (row.tournamentId || '').toString().trim()
      const rowTournamentName = (row.tournament || '').toString().trim().toLowerCase()
      if (tournamentId && rowTournamentId) return String(rowTournamentId) === String(tournamentId)
      if (tournamentId && selectedTournamentName) return rowTournamentName === selectedTournamentName
      return true
    }
    if (country && (row.country || '').toString().toLowerCase() !== country.toLowerCase()) return false
    if (
      tournamentType === 'league' &&
      league &&
      (row.league || '').toString().toLowerCase() !== league.toLowerCase()
    ) {
      return false
    }
    return true
  }

  const teamOptions = useMemo(() => {
    const filtered = rows.filter((row) => matchesCurrentScope(row))
    const savedTeams = Array.from(new Map(filtered.map((row) => [row.teamCode, row])).values())
      .sort((a, b) => a.teamCode.localeCompare(b.teamCode))
      .map((row) => ({
        value: row.teamCode,
        label: row.teamName ? `${row.teamCode} · ${row.teamName}` : row.teamCode,
      }))
    const canonicalLeagueTeams =
      tournamentType === 'league'
        ? LEAGUE_TEAM_MAP[league] || {}
        : tournamentType === 'tournament'
          ? (LEAGUE_TEAM_MAP[selectedTournament?.league || ''] || {})
          : {}
    const tournamentTeamCodes =
      tournamentType === 'tournament'
        ? Array.isArray(selectedTournament?.selectedTeams) && selectedTournament.selectedTeams.length
          ? selectedTournament.selectedTeams
          : Array.isArray(selectedTournament?.teamCodes)
            ? selectedTournament.teamCodes
            : []
        : []
    const missingCanonicalTeams = Object.entries(canonicalLeagueTeams)
      .filter(([teamCode]) =>
        (tournamentType !== 'tournament' || tournamentTeamCodes.includes(teamCode)) &&
        !savedTeams.some((item) => item.value === teamCode),
      )
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([teamCode, teamLabel]) => ({
        value: teamCode,
        label: `${teamCode} · ${teamLabel}`,
      }))
    const missingTournamentTeams =
      tournamentType === 'tournament'
        ? tournamentTeamCodes
            .filter(
              (teamCode) =>
                !savedTeams.some((item) => item.value === teamCode) &&
                !missingCanonicalTeams.some((item) => item.value === teamCode),
            )
            .sort((a, b) => a.localeCompare(b))
            .map((teamCode) => ({ value: teamCode, label: teamCode }))
        : []
    const unique = [...savedTeams, ...missingCanonicalTeams, ...missingTournamentTeams]
    return [...unique, { value: NEW_TEAM_KEY, label: '+ New team' }]
  }, [rows, tournamentType, country, league, tournamentId, selectedTournamentName])

  useEffect(() => {
    if (tournamentType !== 'international') return
    if (!country) {
      setTeam('')
      setNewTeamCode('')
      return
    }
    const options = teamOptions.filter((item) => item.value !== NEW_TEAM_KEY)
    if (!options.length) {
      setTeam('')
      return
    }
    const found = options.find((item) => item.value === team)
    if (!found) {
      setTeam(options[0].value)
    }
  }, [tournamentType, country, teamOptions, team])

  useEffect(() => {
    if (!team) return
    const code = team === NEW_TEAM_KEY ? newTeamCode : team
    if (!code) return
    const existing = rows.find((row) => row.teamCode === code && matchesCurrentScope(row))
    if (!existing) {
      const canonicalName =
        tournamentType === 'league' && league
          ? LEAGUE_TEAM_MAP[league]?.[code] || LEAGUE_TEAM_MAP[selectedTournament?.league || '']?.[code] || ''
          : ''
      setTeamName(canonicalName)
      setPlayers([])
      return
    }
    setTeamName(existing.teamName || existing.teamCode)
    const squad = Array.isArray(existing.squad) ? existing.squad : []
    const mapped = squad.map((player, index) =>
      buildPlayerRow(index, {
        name: player?.name || '',
        canonicalPlayerId: player?.canonicalPlayerId || player?.id || player?.playerRowId || '',
        sourceKey: player?.sourceKey || '',
        playerId: player?.playerId || '',
        country: player?.country || '',
        role: player?.role || '',
        imageUrl: player?.imageUrl || '',
        battingStyle: player?.battingStyle || '',
        bowlingStyle: player?.bowlingStyle || '',
        active: player?.active !== false,
      }),
    )
    setPlayers(mapped)
  }, [team, newTeamCode, rows, tournamentType, tournamentId, selectedTournamentName, country, league])

  const displayTeamCode = team === NEW_TEAM_KEY ? newTeamCode : team

  const updatePlayerById = (playerId, patch) => {
    setPlayers((prev) => prev.map((item) => (item.id === playerId ? { ...item, ...patch } : item)))
  }

  const removePlayerById = (playerId) => {
    setPlayers((prev) => prev.filter((item) => item.id !== playerId))
  }

  const filteredPlayers = useMemo(() => {
    const q = (playerSearch || '').toString().trim().toLowerCase()
    if (!q) return players
    return players.filter((item) => {
      const searchText = [
        item.name || '',
        item.country || '',
        item.role || '',
        item.battingStyle || '',
        item.bowlingStyle || '',
      ]
        .join(' ')
        .toLowerCase()
      return searchText.includes(q)
    })
  }, [players, playerSearch])

  const existingPlayerOptions = useMemo(() => {
    const selectedIds = new Set(
      players
        .map((item) => String(item.canonicalPlayerId || item.sourceKey || item.playerId || item.name || ''))
        .filter(Boolean),
    )
    const query = (existingPlayerQuery || '').toString().trim().toLowerCase()
    return (playerCatalog || [])
      .filter((item) => {
        const key = String(item.id || item.sourceKey || item.playerId || '')
        if (selectedIds.has(key)) return false
        const name = (
          item.displayName ||
          item.name ||
          [item.firstName, item.lastName].filter(Boolean).join(' ')
        )
          .toString()
          .trim()
        const haystack = [name, item.country || '', item.role || ''].join(' ').toLowerCase()
        return !query || haystack.includes(query)
      })
      .slice(0, 100)
      .map((item) => {
        const name = (
          item.displayName ||
          item.name ||
          [item.firstName, item.lastName].filter(Boolean).join(' ')
        )
          .toString()
          .trim()
        return {
          value: String(item.id || item.sourceKey || item.playerId || name),
          label: `${name}${item.country ? ` · ${formatCountryLabel(item.country)}` : ''}${item.role ? ` · ${item.role}` : ''}`,
          player: item,
        }
      })
  }, [existingPlayerQuery, playerCatalog, players])

  const linkExistingPlayer = () => {
    const selected = existingPlayerOptions.find((item) => item.value === selectedExistingPlayerId)?.player
    if (!selected) return
    setPlayers((prev) => [
      ...prev,
      buildPlayerRow(prev.length, {
        canonicalPlayerId: selected.id,
        sourceKey: selected.sourceKey || '',
        playerId: selected.playerId || '',
        name:
          selected.displayName ||
          selected.name ||
          [selected.firstName, selected.lastName].filter(Boolean).join(' ').trim(),
        country: selected.country || '',
        role: selected.role || '',
        imageUrl: selected.imageUrl || '',
        battingStyle: selected.battingStyle || '',
        bowlingStyle: selected.bowlingStyle || '',
        active: selected.active !== false,
      }),
    ])
    setSelectedExistingPlayerId('')
    setExistingPlayerQuery('')
  }

  const playerColumns = [
    {
      key: 'id',
      label: '#',
      headerClassName: 'match-no-col',
      cellClassName: 'match-no-col',
      render: (row) => <span className="match-no-readonly">{players.findIndex((p) => p.id === row.id) + 1}</span>,
    },
    {
      key: 'name',
      label: 'Player Name',
      render: (row) => (
        <input
          type="text"
          value={row.name}
          placeholder="Player name"
          onChange={(event) => updatePlayerById(row.id, { name: event.target.value })}
        />
      ),
    },
    {
      key: 'country',
      label: 'Country',
      render: (row) => (
        <SelectField
          value={(row.country || '').toString().toLowerCase()}
          onChange={(event) => updatePlayerById(row.id, { country: event.target.value })}
          options={[{ value: '', label: 'Select country' }, ...playerCountryOptions]}
        />
      ),
    },
    {
      key: 'role',
      label: 'Role',
      sortable: false,
      render: (row) => (
        <SelectField
          value={row.role || ''}
          onChange={(event) => updatePlayerById(row.id, { role: event.target.value })}
          options={PLAYER_ROLE_OPTIONS.map((item) => ({
            value: item,
            label: item || 'Select role',
          }))}
        />
      ),
    },
    {
      key: 'imageUrl',
      label: 'Image URL',
      sortable: false,
      render: (row) => (
        <input
          type="url"
          value={row.imageUrl || ''}
          placeholder="https://..."
          onChange={(event) => updatePlayerById(row.id, { imageUrl: event.target.value })}
        />
      ),
    },
    {
      key: 'active',
      label: 'Active',
      sortable: false,
      render: (row) => (
        <input
          type="checkbox"
          checked={row.active !== false}
          onChange={(event) => updatePlayerById(row.id, { active: event.target.checked })}
        />
      ),
    },
    {
      key: 'actions',
      label: 'Actions',
      sortable: false,
      render: (row) => (
        <Button
          type="button"
          variant="ghost"
          size="small"
          onClick={() => removePlayerById(row.id)}
        >
          Delete
        </Button>
      ),
    },
  ]

  const onSave = async () => {
    try {
      setIsSaving(true)
      setErrorText('')
      setNotice('')
      if (mode === 'json') {
        const parsed = JSON.parse(jsonPayload || '{}')
        await upsertAdminTeamSquad({ ...parsed, actorUserId })
      } else {
        const normalizedTeamCode = (displayTeamCode || buildTeamCodeFromName(teamName)).toUpperCase()
        if (!normalizedTeamCode) {
          setErrorText('Team code is required. Enter team code or team name.')
          return
        }
        const squad = players
          .map((item) => ({
            name: (item.name || '').trim(),
            country: (item.country || '').trim(),
            role: (item.role || '').trim().toUpperCase(),
            imageUrl: (item.imageUrl || '').trim(),
            battingStyle: (item.battingStyle || '').trim(),
            bowlingStyle: (item.bowlingStyle || '').trim(),
            active: item.active !== false,
            canonicalPlayerId: item.canonicalPlayerId || '',
            sourceKey: (item.sourceKey || '').trim(),
            playerId: (item.playerId || '').trim(),
          }))
          .filter((item) => item.name)
        if (!squad.length) {
          setErrorText('Add at least one player before saving squad.')
          return
        }
        await upsertAdminTeamSquad({
          teamCode: normalizedTeamCode,
          teamName: teamName || normalizedTeamCode,
          tournamentType:
            tournamentType === 'tournament'
              ? 'tournament'
              : tournamentType,
          country:
            tournamentType === 'tournament'
              ? (selectedTournament?.country || '').toString().trim().toLowerCase()
              : country,
          league:
            tournamentType === 'league'
              ? league
              : tournamentType === 'tournament'
                ? (selectedTournament?.league || '').toString().trim()
                : '',
          tournament:
            tournamentType === 'tournament'
              ? (selectedTournament?.name || '').toString().trim()
              : '',
          tournamentId: tournamentType === 'tournament' ? tournamentId : '',
          squad,
          source: 'manual',
          actorUserId,
        })
        setNewTeamCode(normalizedTeamCode)
        setTeam(normalizedTeamCode)
      }
      setNotice('Squad saved')
      await loadSquads()
    } catch (error) {
      setErrorText(error.message || 'Failed to save squad')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <section className="dashboard-section">
      <div className="admin-card dashboard-panel-card">
        <div className="contest-section-head">
          <h3>Squad Manager</h3>
          <div className="top-actions">
            <Button variant="ghost" size="small" onClick={() => void loadSquads()}>
              Refresh squads
            </Button>
            <Button variant="primary" size="small" disabled={isSaving} onClick={onSave}>
              {isSaving ? 'Saving...' : 'Save squad'}
            </Button>
          </div>
        </div>

        {!!errorText && <p className="error-text">{errorText}</p>}
        {!!notice && <p className="success-text">{notice}</p>}

        <div className="upload-tab-row" role="tablist" aria-label="Squad input type tabs">
          <Button
            type="button"
            role="tab"
            aria-selected={mode === 'manual'}
            className={`upload-tab-btn ${mode === 'manual' ? 'active' : ''}`.trim()}
            onClick={() => setMode('manual')}
          >
            Manual
          </Button>
          <Button
            type="button"
            role="tab"
            aria-selected={mode === 'json'}
            className={`upload-tab-btn ${mode === 'json' ? 'active' : ''}`.trim()}
            onClick={() => setMode('json')}
          >
            JSON
          </Button>
        </div>

        {mode === 'json' ? (
          <label>
            JSON payload
            <textarea
              className="dashboard-json-textarea"
              rows={10}
              value={jsonPayload}
              onChange={(event) => setJsonPayload(event.target.value)}
              placeholder={SQUAD_JSON_EXAMPLE}
            />
          </label>
        ) : (
          <>
            <div className="manual-scope-row">
              <label>
                Type
                <SelectField
                  value={tournamentType}
                  onChange={(event) => {
                    setTournamentType(event.target.value)
                    setCountry('')
                    setLeague('')
                    setTournamentId('')
                    setTeam('')
                    setNewTeamCode('')
                    setPlayers([])
                  }}
                  options={[
                    { value: 'international', label: 'International' },
                    { value: 'league', label: 'League' },
                    { value: 'tournament', label: 'Tournament' },
                  ]}
                />
              </label>
              {tournamentType !== 'tournament' && (
                <label>
                  Country
                  <SelectField
                    value={country}
                    onChange={(event) => {
                      setCountry(event.target.value)
                      setLeague('')
                      setTournamentId('')
                      setTeam('')
                      setNewTeamCode('')
                    }}
                    options={[{ value: '', label: 'Select country' }, ...countryOptions]}
                  />
                </label>
              )}
              {tournamentType === 'league' && (
                <label>
                  League
                  <SelectField
                    value={league}
                    onChange={(event) => {
                      setLeague(event.target.value)
                      setTournamentId('')
                      setTeam('')
                      setNewTeamCode('')
                    }}
                    options={[{ value: '', label: 'Select league' }, ...leagueOptions]}
                  />
                </label>
              )}
              {tournamentType === 'tournament' && (
                <label>
                  Tournament
                  <SelectField
                    value={tournamentId}
                    onChange={(event) => {
                      setTournamentId(event.target.value)
                      setCountry('')
                      setLeague('')
                      setTeam('')
                      setNewTeamCode('')
                    }}
                    options={[{ value: '', label: 'Select tournament' }, ...tournamentOptions]}
                  />
                </label>
              )}
              {tournamentType === 'league' && country && league && (
                <label>
                  Team
                  <SelectField
                    value={team}
                    onChange={(event) => {
                      setTeam(event.target.value)
                      if (event.target.value !== NEW_TEAM_KEY) setNewTeamCode('')
                    }}
                    options={[{ value: '', label: 'Select team' }, ...teamOptions]}
                  />
                </label>
              )}
              {tournamentType === 'tournament' && tournamentId && (
                <label>
                  Team
                  <SelectField
                    value={team}
                    onChange={(event) => {
                      setTeam(event.target.value)
                      if (event.target.value !== NEW_TEAM_KEY) setNewTeamCode('')
                    }}
                    options={[{ value: '', label: 'Select team' }, ...teamOptions]}
                  />
                </label>
              )}
              {tournamentType === 'international' && country && (
                <label>
                  Team (auto)
                  <input type="text" value={displayTeamCode} disabled />
                </label>
              )}
              {team === NEW_TEAM_KEY && (
                <>
                  <label>
                    Team code
                    <input
                      type="text"
                      value={newTeamCode}
                      onChange={(event) => setNewTeamCode(event.target.value.toUpperCase())}
                      placeholder="CSK"
                    />
                  </label>
                  <label>
                    Team name
                    <input
                      type="text"
                      value={teamName}
                      onChange={(event) => setTeamName(event.target.value)}
                      placeholder="Chennai Super Kings"
                    />
                  </label>
                </>
              )}
            </div>

            <div className="contest-section-head">
              <h3>{displayTeamCode ? `${displayTeamCode} Squad` : 'Team Squad'}</h3>
              <div className="top-actions">
                <input
                  type="text"
                  placeholder="Filter player name"
                  value={playerSearch}
                  onChange={(event) => setPlayerSearch(event.target.value)}
                />
                <input
                  type="text"
                  placeholder="Search player catalog"
                  value={existingPlayerQuery}
                  onChange={(event) => setExistingPlayerQuery(event.target.value)}
                  disabled={!displayTeamCode}
                />
                <SelectField
                  value={selectedExistingPlayerId}
                  onChange={(event) => setSelectedExistingPlayerId(event.target.value)}
                  options={[
                    { value: '', label: 'Select player' },
                    ...existingPlayerOptions.map((item) => ({
                      value: item.value,
                      label: item.label,
                    })),
                  ]}
                />
                <Button
                  variant="ghost"
                  size="small"
                  onClick={linkExistingPlayer}
                  disabled={!displayTeamCode || !selectedExistingPlayerId}
                >
                  Add player
                </Button>
              </div>
            </div>

            <StickyTable
              columns={playerColumns}
              rows={filteredPlayers}
              rowKey={(row) => row.id}
              emptyText="No players"
              wrapperClassName="catalog-table-wrap"
              tableClassName="catalog-table"
            />
          </>
        )}
      </div>
    </section>
  )
}

export default SquadManagerPanel
