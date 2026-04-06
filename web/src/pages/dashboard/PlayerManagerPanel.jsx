import { useEffect, useMemo, useState } from 'react'
import Button from '../../components/ui/Button.jsx'
import Modal from '../../components/ui/Modal.jsx'
import PlayerIdentity from '../../components/ui/PlayerIdentity.jsx'
import SelectField from '../../components/ui/SelectField.jsx'
import StickyTable from '../../components/ui/StickyTable.jsx'
import {
  createAdminPlayer,
  deleteAdminPlayersBulk,
  fetchPlayers,
  importAdminPlayers,
} from '../../lib/api.js'
import { getStoredUser } from '../../lib/auth.js'

const PLAYER_ROLE_OPTIONS = ['', 'BAT', 'BOWL', 'AR', 'WK']
const PLAYER_COUNTRY_OPTIONS = [
  '',
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

const formatCountryLabel = (value = '') => {
  const normalized = value.toString().trim().toLowerCase()
  if (COUNTRY_LABEL_OVERRIDES[normalized]) return COUNTRY_LABEL_OVERRIDES[normalized]
  return normalized
    .split(/\s+/)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}

const resolvePlayerCountry = (row = {}) =>
  (row.country || row.nationality || row.playerCountry || '').toString().trim()

function PlayerManagerPanel() {
  const currentUser = getStoredUser()
  const canManagePlayers = ['admin', 'master_admin'].includes(currentUser?.role || '')
  const actorUserId = currentUser?.gameName || currentUser?.email || currentUser?.id || ''
  const [players, setPlayers] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [isEditMode, setIsEditMode] = useState(false)
  const [errorText, setErrorText] = useState('')
  const [notice, setNotice] = useState('')
  const [filterText, setFilterText] = useState('')
  const [formErrorText, setFormErrorText] = useState('')
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showImportModal, setShowImportModal] = useState(false)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [importJson, setImportJson] = useState('')
  const [selectedPlayerIds, setSelectedPlayerIds] = useState([])
  const [form, setForm] = useState({
    name: '',
    country: '',
    role: '',
    imageUrl: '',
  })

  const loadPlayers = async () => {
    try {
      setIsLoading(true)
      setErrorText('')
      const rows = await fetchPlayers()
      setPlayers(Array.isArray(rows) ? rows : [])
    } catch (error) {
      setErrorText(error.message || 'Failed to load players')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    void loadPlayers()
  }, [])

  useEffect(() => {
    const availableIds = new Set((players || []).map((row) => String(row.id)))
    setSelectedPlayerIds((prev) => prev.filter((id) => availableIds.has(String(id))))
  }, [players])

  useEffect(() => {
    if (isEditMode) return
    setSelectedPlayerIds([])
    setShowDeleteModal(false)
  }, [isEditMode])

  const filteredPlayers = useMemo(() => {
    const q = filterText.toString().trim().toLowerCase()
    if (!q) return players
    return players.filter((row) => {
      const searchText = [
        row.displayName || row.name || '',
        resolvePlayerCountry(row),
        row.role || '',
      ]
        .join(' ')
        .toLowerCase()
      return searchText.includes(q)
    })
  }, [filterText, players])

  const countryOptions = useMemo(() => {
    const known = new Set(PLAYER_COUNTRY_OPTIONS.filter(Boolean))
    ;(players || []).forEach((row) => {
      const country = resolvePlayerCountry(row).toLowerCase()
      if (country) known.add(country)
    })
    return [
      { value: '', label: 'Select country' },
      ...[...known]
        .sort((a, b) => a.localeCompare(b))
        .map((item) => ({
          value: item,
          label: formatCountryLabel(item),
        })),
    ]
  }, [players])

  const onCreatePlayer = async () => {
    const name = form.name.toString().trim()
    const country = form.country.toString().trim()
    const role = form.role.toString().trim()
    if (!name || !country || !role) {
      setFormErrorText('Name, country, and role are required.')
      setErrorText('')
      setNotice('')
      return
    }
    try {
      setIsSaving(true)
      setErrorText('')
      setNotice('')
      setFormErrorText('')
      await createAdminPlayer({
        ...form,
        name,
        country,
        role,
        actorUserId,
      })
      setNotice('Player saved')
      setForm({
        name: '',
        country: '',
        role: '',
        imageUrl: '',
      })
      setShowCreateModal(false)
      await loadPlayers()
    } catch (error) {
      setErrorText(error.message || 'Failed to save player')
    } finally {
      setIsSaving(false)
    }
  }

  const closeCreateModal = () => {
    setShowCreateModal(false)
    setFormErrorText('')
  }

  const closeImportModal = () => {
    setShowImportModal(false)
  }

  const onImportPlayers = async () => {
    try {
      setIsSaving(true)
      setErrorText('')
      setNotice('')
      setFormErrorText('')
      const parsed = JSON.parse(importJson || '{}')
      const result = await importAdminPlayers({
        ...(parsed || {}),
        actorUserId,
      })
      setNotice(`Imported ${Number(result?.importedCount || 0)} players`)
      setShowImportModal(false)
      setImportJson('')
      await loadPlayers()
    } catch (error) {
      setErrorText(error.message || 'Failed to import players')
    } finally {
      setIsSaving(false)
    }
  }

  const selectedPlayers = useMemo(() => {
    const selectedSet = new Set(selectedPlayerIds.map((id) => String(id)))
    return (players || []).filter((row) => selectedSet.has(String(row.id)))
  }, [players, selectedPlayerIds])

  const selectedPlayerCount = selectedPlayerIds.length
  const allFilteredSelected =
    filteredPlayers.length > 0 &&
    filteredPlayers.every((row) => selectedPlayerIds.includes(String(row.id)))

  const togglePlayerSelected = (id) => {
    const key = String(id)
    setSelectedPlayerIds((prev) =>
      prev.includes(key) ? prev.filter((item) => item !== key) : [...prev, key],
    )
  }

  const toggleAllFilteredSelected = () => {
    const filteredKeys = filteredPlayers.map((row) => String(row.id))
    if (!filteredKeys.length) return
    if (allFilteredSelected) {
      setSelectedPlayerIds((prev) => prev.filter((id) => !filteredKeys.includes(id)))
      return
    }
    setSelectedPlayerIds((prev) => Array.from(new Set([...prev, ...filteredKeys])))
  }

  const closeDeleteModal = () => {
    setShowDeleteModal(false)
  }

  const onDeleteSelectedPlayers = async () => {
    try {
      setIsSaving(true)
      setErrorText('')
      setNotice('')
      setFormErrorText('')
      const result = await deleteAdminPlayersBulk({
        ids: selectedPlayerIds,
        actorUserId,
      })
      const removedCount = Number(result?.removedCount || selectedPlayerIds.length || 0)
      const missingCount = Number((result?.missingIds || []).length || 0)
      setNotice(
        missingCount > 0
          ? `Deleted ${removedCount} players (${missingCount} already missing).`
          : `Deleted ${removedCount} players.`,
      )
      setSelectedPlayerIds([])
      closeDeleteModal()
      await loadPlayers()
    } catch (error) {
      setErrorText(error.message || 'Failed to delete player')
    } finally {
      setIsSaving(false)
    }
  }

  const columns = [
    ...(isEditMode
      ? [
          {
            key: 'select',
            label: (
              <input
                type="checkbox"
                aria-label="Select all filtered players"
                checked={allFilteredSelected}
                onChange={toggleAllFilteredSelected}
              />
            ),
            sortable: false,
            width: '48px',
            render: (row) => {
              const checked = selectedPlayerIds.includes(String(row.id))
              const label = row.displayName || row.name || 'player'
              return (
                <input
                  type="checkbox"
                  aria-label={`Select player ${label}`}
                  checked={checked}
                  onChange={() => togglePlayerSelected(row.id)}
                />
              )
            },
          },
        ]
      : []),
    {
      key: 'player',
      label: 'Player',
      sortValue: (row) => row.displayName || row.name || '',
      render: (row) => (
        <PlayerIdentity
          name={row.displayName || row.name || ''}
          imageUrl={row.imageUrl || ''}
          size="xs"
          dense
        />
      ),
    },
    {
      key: 'country',
      label: 'Country',
      sortValue: (row) => resolvePlayerCountry(row),
      render: (row) => {
        const country = resolvePlayerCountry(row)
        return country ? formatCountryLabel(country) : '—'
      },
    },
    {
      key: 'role',
      label: 'Role',
    },
  ]

  return (
    <section className="dashboard-section">
      <div className="admin-card dashboard-panel-card player-manager-panel">
        <div className="contest-section-head">
          <div>
            <h3>Player Manager</h3>
            <small>Manage the global player catalog used by squad links.</small>
          </div>
          <div className="top-actions player-manager-head-actions">
            <input
              className="dashboard-text-input"
              type="text"
              placeholder="Filter players"
              value={filterText}
              onChange={(event) => setFilterText(event.target.value)}
            />
            {canManagePlayers && (
              <Button
                type="button"
                variant={isEditMode ? 'primary' : 'ghost'}
                size="small"
                onClick={() => setIsEditMode((prev) => !prev)}
                disabled={isSaving}
              >
                {isEditMode ? 'Done' : 'Edit'}
              </Button>
            )}
            {canManagePlayers && isEditMode && (
              <>
                <Button
                  type="button"
                  variant="danger"
                  size="small"
                  onClick={() => setShowDeleteModal(true)}
                  disabled={!selectedPlayerCount || isSaving}
                >
                  {selectedPlayerCount > 0
                    ? `Delete selected (${selectedPlayerCount})`
                    : 'Delete selected'}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="small"
                  onClick={() => setShowImportModal(true)}
                  disabled={isSaving}
                >
                  JSON import
                </Button>
                <Button
                  type="button"
                  variant="primary"
                  size="small"
                  onClick={() => setShowCreateModal(true)}
                  disabled={isSaving}
                >
                  Add player
                </Button>
              </>
            )}
          </div>
        </div>

        {!!errorText && <p className="error-text">{errorText}</p>}
        {!!notice && <p className="success-text">{notice}</p>}
        {!!formErrorText && <p className="error-text">{formErrorText}</p>}

        <div className="catalog-card player-manager-card">
          <div className="player-manager-topbar">
            <div className="player-manager-tools-copy">
              <strong>Players ({filteredPlayers.length})</strong>
              <small>
                {isEditMode && canManagePlayers
                  ? 'Create once here, then link from Squad Manager.'
                  : 'Catalog is read-only by default. Admins can enter edit mode to manage players.'}
              </small>
            </div>
          </div>

          <div className="catalog-table-shell">
            <StickyTable
              columns={columns}
              rows={filteredPlayers}
              rowKey={(row) => row.id}
              emptyText={isLoading ? 'Loading players…' : 'No players found'}
              wrapperClassName="catalog-table-wrap"
              tableClassName="catalog-table player-manager-table"
            />
          </div>
        </div>
      </div>
      <Modal
        open={showCreateModal}
        onClose={closeCreateModal}
        title="Add Player"
        size="lg"
        className="player-manager-create-modal"
        footer={
          <>
            <Button type="button" variant="ghost" size="small" onClick={closeCreateModal}>
              Cancel
            </Button>
            <Button
              type="button"
              variant="primary"
              size="small"
              onClick={onCreatePlayer}
              disabled={isSaving}
            >
              Add player
            </Button>
          </>
        }
      >
        <div className="manual-scope-row player-manager-form">
          <label>
            Name
            <input
              className="dashboard-text-input"
              type="text"
              value={form.name}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, name: event.target.value }))
              }
              placeholder="Dewald Brevis"
            />
          </label>
          <label>
            Country
            <SelectField
              className="dashboard-text-input"
              value={form.country}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, country: event.target.value }))
              }
              options={countryOptions}
            />
          </label>
          <label>
            Role
            <SelectField
              className="dashboard-text-input"
              value={form.role}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, role: event.target.value }))
              }
              options={PLAYER_ROLE_OPTIONS.map((item) => ({
                value: item,
                label: item || 'Select role',
              }))}
            />
          </label>
          <label className="player-manager-form-span-2">
            Image URL
            <input
              className="dashboard-text-input"
              type="url"
              value={form.imageUrl}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, imageUrl: event.target.value }))
              }
              placeholder="https://..."
            />
          </label>
        </div>
      </Modal>
      <Modal
        open={showImportModal}
        onClose={closeImportModal}
        title="Import Players JSON"
        size="lg"
        className="player-manager-import-modal"
        footer={
          <>
            <Button type="button" variant="ghost" size="small" onClick={closeImportModal}>
              Cancel
            </Button>
            <Button
              type="button"
              variant="primary"
              size="small"
              onClick={onImportPlayers}
              disabled={isSaving}
            >
              Import players
            </Button>
          </>
        }
      >
        <div className="player-manager-import-layout">
          <label className="player-manager-import-field">
            JSON payload
            <textarea
              className="dashboard-json-textarea"
              rows={12}
              value={importJson}
              onChange={(event) => setImportJson(event.target.value)}
              placeholder={`{\n  "players": [\n    {\n      "id": "02e239d1-c27b-48f4-af45-9c6f45f4fdb3",\n      "name": "Shubham Dubey",\n      "nationality": "india",\n      "role": "BAT",\n      "player_img": "https://h.cricapi.com/img/icon512.png",\n      "base_price": 25\n    }\n  ]\n}`}
            />
          </label>
        </div>
      </Modal>
      <Modal
        open={showDeleteModal}
        onClose={closeDeleteModal}
        title="Delete selected players"
        size="md"
        className="player-manager-delete-modal"
        footer={
          <>
            <Button type="button" variant="ghost" size="small" onClick={closeDeleteModal}>
              Cancel
            </Button>
            <Button
              type="button"
              variant="danger"
              size="small"
              onClick={onDeleteSelectedPlayers}
              disabled={!selectedPlayerCount || isSaving}
            >
              Delete players
            </Button>
          </>
        }
      >
        <div className="player-manager-delete-layout">
          <p className="team-note">
            You are deleting {selectedPlayerCount} player
            {selectedPlayerCount === 1 ? '' : 's'}.
          </p>
          <ul className="player-manager-delete-list">
            {selectedPlayers.map((row) => (
              <li key={row.id}>{row.displayName || row.name || `Player ${row.id}`}</li>
            ))}
          </ul>
        </div>
      </Modal>
    </section>
  )
}

export default PlayerManagerPanel
