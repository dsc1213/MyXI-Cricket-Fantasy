import { useEffect, useMemo, useState } from 'react'
import Button from '../../components/ui/Button.jsx'
import Modal from '../../components/ui/Modal.jsx'
import PlayerIdentity from '../../components/ui/PlayerIdentity.jsx'
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

const PLAYER_COUNTRY_OPTIONS = [
  'afghanistan',
  'australia',
  'bangladesh',
  'canada',
  'england',
  'hong kong',
  'india',
  'ireland',
  'namibia',
  'nepal',
  'netherlands',
  'new zealand',
  'oman',
  'pakistan',
  'scotland',
  'singapore',
  'south africa',
  'sri lanka',
  'uae',
  'usa',
  'west indies',
  'zimbabwe',
]
const COUNTRY_LABEL_OVERRIDES = {
  uae: 'UAE',
  usa: 'USA',
}
const SQUAD_JSON_EXAMPLE = `{
  "tournamentId": "ipl-2026",
  "tournament": "IPL 2026",
  "country": "india",
  "league": "IPL",
  "teamSquads": [
    {
      "teamCode": "CSK",
      "teamName": "Chennai Super Kings",
      "tournamentType": "tournament",
      "source": "json",
      "squad": [
        {
          "canonicalPlayerId": "player-uuid-1",
          "name": "MS Dhoni",
          "country": "india",
          "role": "WK",
          "imageUrl": "https://cdn.example.com/ms-dhoni.png",
          "active": true
        }
      ]
    }
  ]
}`
const formatCountryLabel = (value = '') =>
  (() => {
    const normalized = value.toString().trim().toLowerCase()
    if (COUNTRY_LABEL_OVERRIDES[normalized]) return COUNTRY_LABEL_OVERRIDES[normalized]
    return normalized
      .split(/\s+/)
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
      .join(' ')
  })()

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
  const canManageSquads = ['admin', 'master_admin'].includes(currentUser?.role || '')
  const [rows, setRows] = useState([])
  const [tournamentRows, setTournamentRows] = useState([])
  const [playerCatalog, setPlayerCatalog] = useState([])
  const [, setIsLoading] = useState(true)
  const [errorText, setErrorText] = useState('')
  const [notice, setNotice] = useState('')
  const [mode, setMode] = useState('manual')
  const [isSaving, setIsSaving] = useState(false)
  const [isEditMode, setIsEditMode] = useState(false)
  const [jsonPayload, setJsonPayload] = useState('')

  const [tournamentId, setTournamentId] = useState('')
  const [team, setTeam] = useState('')
  const [teamName, setTeamName] = useState('')
  const [players, setPlayers] = useState([])
  const [playerSearch, setPlayerSearch] = useState('')
  const [showAddPlayerModal, setShowAddPlayerModal] = useState(false)
  const [existingPlayerQuery, setExistingPlayerQuery] = useState('')
  const [existingPlayerCountryFilter, setExistingPlayerCountryFilter] = useState('')
  const [selectedExistingPlayerIds, setSelectedExistingPlayerIds] = useState([])

  const actorUserId = currentUser?.gameName || currentUser?.email || currentUser?.id || ''

  const loadSquads = async () => {
    try {
      setIsLoading(true)
      setErrorText('')
      const data = await fetchAdminTeamSquads({
        tournamentId,
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
  }, [tournamentId])

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

  const matchesCurrentScope = (row) => {
    const rowTournamentId = (row.tournamentId || '').toString().trim()
    const rowTournamentName = (row.tournament || '').toString().trim().toLowerCase()
    if (tournamentId && rowTournamentId) return String(rowTournamentId) === String(tournamentId)
    if (tournamentId && selectedTournamentName) return rowTournamentName === selectedTournamentName
    return !tournamentId
  }

  const teamOptions = useMemo(() => {
    const filtered = rows.filter((row) => matchesCurrentScope(row))
    const savedTeams = Array.from(new Map(filtered.map((row) => [row.teamCode, row])).values())
      .sort((a, b) => a.teamCode.localeCompare(b.teamCode))
      .map((row) => ({
        value: row.teamCode,
        label: row.teamName ? `${row.teamCode} · ${row.teamName}` : row.teamCode,
      }))
    const tournamentTeamCodes =
      Array.isArray(selectedTournament?.selectedTeams) && selectedTournament.selectedTeams.length
        ? selectedTournament.selectedTeams
        : Array.isArray(selectedTournament?.teamCodes)
          ? selectedTournament.teamCodes
          : []
    const missingTournamentTeams = tournamentTeamCodes
      .filter((teamCode) => !savedTeams.some((item) => item.value === teamCode))
      .sort((a, b) => a.localeCompare(b))
      .map((teamCode) => ({ value: teamCode, label: teamCode }))
    return [...savedTeams, ...missingTournamentTeams]
  }, [rows, selectedTournament, tournamentId, selectedTournamentName])

  useEffect(() => {
    if (!tournamentId) {
      setTeam('')
      return
    }
    const options = teamOptions
    if (!options.length) {
      setTeam('')
      return
    }
    const found = options.find((item) => item.value === team)
    if (!found) {
      setTeam(options[0].value)
    }
  }, [tournamentId, teamOptions, team])

  useEffect(() => {
    if (!team) return
    const code = team
    if (!code) return
    const existing = rows.find((row) => row.teamCode === code && matchesCurrentScope(row))
    if (!existing) {
      setTeamName(code)
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
  }, [team, rows, tournamentId, selectedTournamentName])

  const displayTeamCode = team

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
    const selectedCountry = existingPlayerCountryFilter.toString().trim().toLowerCase()
    const query = (existingPlayerQuery || '').toString().trim().toLowerCase()
    return (playerCatalog || [])
      .filter((item) => {
        const key = String(item.id || item.sourceKey || item.playerId || '')
        if (selectedIds.has(key)) return false
        const itemCountry = (item.country || '').toString().trim().toLowerCase()
        if (selectedCountry && itemCountry !== selectedCountry) return false
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
  }, [existingPlayerCountryFilter, existingPlayerQuery, playerCatalog, players])

  const existingPlayerCountryOptions = useMemo(() => {
    const selectedIds = new Set(
      players
        .map((item) => String(item.canonicalPlayerId || item.sourceKey || item.playerId || item.name || ''))
        .filter(Boolean),
    )
    const countries = new Set(PLAYER_COUNTRY_OPTIONS)
    ;(playerCatalog || []).forEach((item) => {
      const key = String(item.id || item.sourceKey || item.playerId || '')
      if (selectedIds.has(key)) return
      const itemCountry = (item.country || '').toString().trim().toLowerCase()
      if (itemCountry) countries.add(itemCountry)
    })
    return [...countries]
      .sort((a, b) => a.localeCompare(b))
      .map((item) => ({ value: item, label: formatCountryLabel(item) }))
  }, [playerCatalog, players])

  const selectedExistingPlayers = useMemo(() => {
    const selectedSet = new Set(selectedExistingPlayerIds)
    return (playerCatalog || [])
      .filter((item) => {
        const key = String(
          item.id ||
            item.sourceKey ||
            item.playerId ||
            item.displayName ||
            item.name ||
            '',
        )
        return selectedSet.has(key)
      })
      .map((player) => ({
        value: String(
          player.id ||
            player.sourceKey ||
            player.playerId ||
            player.displayName ||
            player.name ||
            '',
        ),
        player,
      }))
  }, [playerCatalog, selectedExistingPlayerIds])

  const linkExistingPlayers = () => {
    if (!selectedExistingPlayers.length) return
    setPlayers((prev) => [
      ...prev,
      ...selectedExistingPlayers.map((item, index) =>
        buildPlayerRow(prev.length + index, {
          canonicalPlayerId: item.player.id,
          sourceKey: item.player.sourceKey || '',
          playerId: item.player.playerId || '',
          name:
            item.player.displayName ||
            item.player.name ||
            [item.player.firstName, item.player.lastName].filter(Boolean).join(' ').trim(),
          country: item.player.country || '',
          role: item.player.role || '',
          imageUrl: item.player.imageUrl || '',
          battingStyle: item.player.battingStyle || '',
          bowlingStyle: item.player.bowlingStyle || '',
          active: item.player.active !== false,
        }),
      ),
    ])
    setSelectedExistingPlayerIds([])
    setExistingPlayerQuery('')
    setShowAddPlayerModal(false)
  }

  const toggleExistingPlayerSelection = (value) => {
    setSelectedExistingPlayerIds((prev) =>
      prev.includes(value) ? prev.filter((item) => item !== value) : [...prev, value],
    )
  }

  const closeAddPlayerModal = () => {
    setShowAddPlayerModal(false)
    setExistingPlayerQuery('')
    setExistingPlayerCountryFilter('')
    setSelectedExistingPlayerIds([])
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
      cellClassName: 'squad-manager-player-cell',
      render: (row) => (
        <PlayerIdentity
          name={row.name || ''}
          imageUrl={row.imageUrl || ''}
          subtitle={[
            row.country ? formatCountryLabel(row.country) : '',
            row.role || '',
          ]
            .filter(Boolean)
            .join(' · ')}
          size="xs"
          className="squad-manager-player-identity"
        />
      ),
    },
    {
      key: 'country',
      label: 'Country',
      cellClassName: 'squad-manager-meta-cell',
      render: (row) => formatCountryLabel(row.country || ''),
    },
    {
      key: 'role',
      label: 'Role',
      cellClassName: 'squad-manager-meta-cell',
      render: (row) => row.role || 'NA',
    },
    {
      key: 'active',
      label: 'Active',
      cellClassName: 'squad-manager-meta-cell',
      render: (row) => (row.active !== false ? 'Yes' : 'No'),
    },
    ...(isEditMode
      ? [
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
                Remove
              </Button>
            ),
          },
        ]
      : []),
  ]

  const onSave = async () => {
    try {
      setIsSaving(true)
      setErrorText('')
      setNotice('')
      if (mode === 'json') {
        const parsed = JSON.parse(jsonPayload || '{}')
        await upsertAdminTeamSquad({ ...parsed, actorUserId })
        setJsonPayload('')
      } else {
        const normalizedTeamCode = (displayTeamCode || '').toUpperCase()
        if (!normalizedTeamCode) {
          setErrorText('Select a team before saving squad.')
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
          tournamentType: 'tournament',
          country: (selectedTournament?.country || '').toString().trim().toLowerCase(),
          league: (selectedTournament?.league || '').toString().trim(),
          tournament: (selectedTournament?.name || '').toString().trim(),
          tournamentId,
          squad,
          source: 'manual',
          actorUserId,
        })
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
            {canManageSquads && (
              <Button
                variant={isEditMode ? 'primary' : 'ghost'}
                size="small"
                disabled={isSaving}
                onClick={() => setIsEditMode((prev) => !prev)}
              >
                {isEditMode ? 'Done' : 'Edit squad'}
              </Button>
            )}
            {canManageSquads && isEditMode && (
              <Button variant="primary" size="small" disabled={isSaving} onClick={onSave}>
                {isSaving ? 'Saving...' : 'Save squad'}
              </Button>
            )}
          </div>
        </div>

        {!!errorText && (
          <p className="error-text squad-manager-error" role="alert">
            {errorText}
          </p>
        )}
        {!!notice && <p className="success-text squad-manager-success">{notice}</p>}

        {canManageSquads && isEditMode && (
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
        )}

        {canManageSquads && isEditMode && mode === 'json' ? (
          <label className="squad-manager-json-field">
            JSON payload
            <textarea
              className="dashboard-json-textarea squad-manager-json-textarea"
              rows={16}
              value={jsonPayload}
              onChange={(event) => setJsonPayload(event.target.value)}
              placeholder={SQUAD_JSON_EXAMPLE}
            />
          </label>
        ) : (
          <>
            <div className="manual-scope-row">
              <label>
                Tournament
                <SelectField
                  value={tournamentId}
                  onChange={(event) => {
                    setTournamentId(event.target.value)
                    setTeam('')
                    setPlayers([])
                  }}
                  options={[{ value: '', label: 'Select tournament' }, ...tournamentOptions]}
                />
              </label>
              {tournamentId && (
                <label>
                  Team
                  <SelectField
                    value={team}
                    onChange={(event) => setTeam(event.target.value)}
                    options={[{ value: '', label: 'Select team' }, ...teamOptions]}
                  />
                </label>
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
                {canManageSquads && isEditMode && (
                  <Button
                    variant="ghost"
                    size="small"
                    onClick={() => setShowAddPlayerModal(true)}
                    disabled={!displayTeamCode}
                  >
                    Add player
                  </Button>
                )}
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
      <Modal
        open={showAddPlayerModal}
        onClose={closeAddPlayerModal}
        title="Add Players"
        size="lg"
        className="squad-player-picker-modal"
        footer={
          <>
            <Button type="button" variant="ghost" size="small" onClick={closeAddPlayerModal}>
              Cancel
            </Button>
            <Button
              type="button"
              variant="primary"
              size="small"
              onClick={linkExistingPlayers}
              disabled={!selectedExistingPlayers.length}
            >
              Add selected players
            </Button>
          </>
        }
      >
        <div className="squad-player-picker">
          <div className="squad-player-picker-head">
            <div className="squad-player-picker-filters">
              <label>
                Country
                <SelectField
                  value={existingPlayerCountryFilter}
                  onChange={(event) => setExistingPlayerCountryFilter(event.target.value)}
                  options={[{ value: '', label: 'All countries' }, ...existingPlayerCountryOptions]}
                />
              </label>
              <label>
                Search player catalog
                <input
                  className="squad-player-picker-search"
                  type="text"
                  placeholder="Search player catalog"
                  value={existingPlayerQuery}
                  onChange={(event) => setExistingPlayerQuery(event.target.value)}
                />
              </label>
            </div>
            <small>
              Selected: {selectedExistingPlayers.length ? selectedExistingPlayers.map((item) => item.player.displayName || item.player.name || [item.player.firstName, item.player.lastName].filter(Boolean).join(' ').trim()).join(', ') : 'None'}
            </small>
          </div>
          <div className="squad-player-picker-list" role="list">
            {existingPlayerOptions.length ? (
              existingPlayerOptions.map((item) => {
                const checked = selectedExistingPlayerIds.includes(item.value)
                const playerName =
                  item.player.displayName ||
                  item.player.name ||
                  [item.player.firstName, item.player.lastName].filter(Boolean).join(' ').trim()
                return (
                  <label key={item.value} className={`squad-player-picker-row ${checked ? 'is-selected' : ''}`.trim()}>
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleExistingPlayerSelection(item.value)}
                    />
                    <span className="squad-player-picker-name">{playerName}</span>
                    <span className="squad-player-picker-meta">
                      {formatCountryLabel(item.player.country || '')}
                      {item.player.role ? ` · ${item.player.role}` : ''}
                    </span>
                  </label>
                )
              })
            ) : (
              <p className="squad-player-picker-empty">No unadded players found.</p>
            )}
          </div>
        </div>
      </Modal>
    </section>
  )
}

export default SquadManagerPanel
