import { useEffect, useMemo, useState } from 'react'
import Button from '../../components/ui/Button.jsx'
import SelectField from '../../components/ui/SelectField.jsx'
import StickyTable from '../../components/ui/StickyTable.jsx'
import { fetchAdminTeamSquads, upsertAdminTeamSquad } from '../../lib/api.js'
import { getStoredUser } from '../../lib/auth.js'

const LEAGUE_MAP = {
  india: ['IPL', 'WPL'],
  australia: ['BBL', 'WBBL'],
  pakistan: ['PSL'],
  england: ['The Hundred', 'Vitality Blast'],
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
    name: (seed.name || '').toString(),
    country: (seed.country || '').toString(),
    role: (seed.role || '').toString().toUpperCase(),
    battingStyle: (seed.battingStyle || '').toString(),
    bowlingStyle: (seed.bowlingStyle || '').toString(),
    active: seed.active !== false,
  }
}

function SquadManagerPanel() {
  const currentUser = getStoredUser()
  const [rows, setRows] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [errorText, setErrorText] = useState('')
  const [notice, setNotice] = useState('')
  const [mode, setMode] = useState('manual')
  const [isSaving, setIsSaving] = useState(false)
  const [jsonPayload, setJsonPayload] = useState('')

  const [tournamentType, setTournamentType] = useState('international')
  const [country, setCountry] = useState('')
  const [league, setLeague] = useState('')
  const [team, setTeam] = useState('')
  const [newTeamCode, setNewTeamCode] = useState('')
  const [teamName, setTeamName] = useState('')
  const [players, setPlayers] = useState([buildPlayerRow(0)])
  const [playerSearch, setPlayerSearch] = useState('')

  const actorUserId = currentUser?.gameName || currentUser?.email || currentUser?.id || ''

  const loadSquads = async () => {
    try {
      setIsLoading(true)
      setErrorText('')
      const data = await fetchAdminTeamSquads()
      setRows(Array.isArray(data) ? data : [])
    } catch (error) {
      setErrorText(error.message || 'Failed to load squads')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    void loadSquads()
  }, [])

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
    return Object.keys(LEAGUE_MAP).map((item) => ({ value: item, label: item }))
  }, [rows, tournamentType])

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

  const teamOptions = useMemo(() => {
    const filtered = rows.filter((row) => {
      const rowType = (row.tournamentType || 'international').toString().toLowerCase()
      if (rowType !== tournamentType) return false
      if (country && (row.country || '').toString().toLowerCase() !== country.toLowerCase()) return false
      if (
        tournamentType === 'league' &&
        league &&
        (row.league || '').toString().toLowerCase() !== league.toLowerCase()
      ) {
        return false
      }
      return true
    })
    const unique = Array.from(new Map(filtered.map((row) => [row.teamCode, row])).values())
      .sort((a, b) => a.teamCode.localeCompare(b.teamCode))
      .map((row) => ({ value: row.teamCode, label: row.teamCode }))
    return [...unique, { value: NEW_TEAM_KEY, label: '+ New team' }]
  }, [rows, tournamentType, country, league])

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
    const existing = rows.find((row) => row.teamCode === code)
    if (!existing) {
      setTeamName('')
      setPlayers([buildPlayerRow(0)])
      return
    }
    setTeamName(existing.teamName || existing.teamCode)
    const squad = Array.isArray(existing.squad) ? existing.squad : []
    const mapped = squad.map((player, index) =>
      buildPlayerRow(index, {
        name: player?.name || '',
        country: player?.country || '',
        role: player?.role || '',
        battingStyle: player?.battingStyle || '',
        bowlingStyle: player?.bowlingStyle || '',
        active: player?.active !== false,
      }),
    )
    setPlayers(mapped.length ? mapped : [buildPlayerRow(0)])
  }, [team, newTeamCode, rows])

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
            battingStyle: (item.battingStyle || '').trim(),
            bowlingStyle: (item.bowlingStyle || '').trim(),
            active: item.active !== false,
          }))
          .filter((item) => item.name)
        if (!squad.length) {
          setErrorText('Add at least one player before saving squad.')
          return
        }
        await upsertAdminTeamSquad({
          teamCode: normalizedTeamCode,
          teamName: teamName || normalizedTeamCode,
          tournamentType,
          country,
          league: tournamentType === 'league' ? league : '',
          tournament: '',
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
                    setTeam('')
                    setNewTeamCode('')
                    setPlayers([buildPlayerRow(0)])
                  }}
                  options={[
                    { value: 'international', label: 'International' },
                    { value: 'league', label: 'League' },
                  ]}
                />
              </label>
              <label>
                Country
                <SelectField
                  value={country}
                  onChange={(event) => {
                    setCountry(event.target.value)
                    setLeague('')
                    setTeam('')
                    setNewTeamCode('')
                  }}
                  options={[{ value: '', label: 'Select country' }, ...countryOptions]}
                />
              </label>
              {tournamentType === 'league' && (
                <label>
                  League
                  <SelectField
                    value={league}
                    onChange={(event) => {
                      setLeague(event.target.value)
                      setTeam('')
                      setNewTeamCode('')
                    }}
                    options={[{ value: '', label: 'Select league' }, ...leagueOptions]}
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
                <Button
                  variant="ghost"
                  size="small"
                  onClick={() => setPlayers((prev) => [...prev, buildPlayerRow(prev.length)])}
                  disabled={!displayTeamCode}
                >
                  + Add player
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
