import { useEffect, useMemo, useState } from 'react'
import Button from '../../components/ui/Button.jsx'
import PlayerIdentity from '../../components/ui/PlayerIdentity.jsx'
import SelectField from '../../components/ui/SelectField.jsx'
import StickyTable from '../../components/ui/StickyTable.jsx'
import { createAdminPlayer, deleteAdminPlayer, fetchPlayers } from '../../lib/api.js'
import { getStoredUser } from '../../lib/auth.js'

const PLAYER_ROLE_OPTIONS = ['', 'BAT', 'BOWL', 'AR', 'WK']

function PlayerManagerPanel() {
  const currentUser = getStoredUser()
  const actorUserId = currentUser?.gameName || currentUser?.email || currentUser?.id || ''
  const [players, setPlayers] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [errorText, setErrorText] = useState('')
  const [notice, setNotice] = useState('')
  const [filterText, setFilterText] = useState('')
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

  const filteredPlayers = useMemo(() => {
    const q = filterText.toString().trim().toLowerCase()
    if (!q) return players
    return players.filter((row) => {
      const searchText = [
        row.displayName || row.name || '',
        row.country || '',
        row.role || '',
      ]
        .join(' ')
        .toLowerCase()
      return searchText.includes(q)
    })
  }, [filterText, players])

  const onCreatePlayer = async () => {
    try {
      setIsSaving(true)
      setErrorText('')
      setNotice('')
      await createAdminPlayer({
        ...form,
        actorUserId,
      })
      setNotice('Player saved')
      setForm({
        name: '',
        country: '',
        role: '',
        imageUrl: '',
      })
      await loadPlayers()
    } catch (error) {
      setErrorText(error.message || 'Failed to save player')
    } finally {
      setIsSaving(false)
    }
  }

  const onDeletePlayer = async (id) => {
    try {
      setErrorText('')
      setNotice('')
      await deleteAdminPlayer({ id, actorUserId })
      setNotice('Player deleted')
      await loadPlayers()
    } catch (error) {
      setErrorText(error.message || 'Failed to delete player')
    }
  }

  const columns = [
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
    },
    {
      key: 'role',
      label: 'Role',
    },
    {
      key: 'actions',
      label: 'Delete',
      sortable: false,
      render: (row) => (
        <Button
          type="button"
          variant="danger"
          size="small"
          onClick={() => onDeletePlayer(row.id)}
        >
          Delete
        </Button>
      ),
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
          <div className="top-actions">
            <input
              type="text"
              placeholder="Filter players"
              value={filterText}
              onChange={(event) => setFilterText(event.target.value)}
            />
          </div>
        </div>

        {!!errorText && <p className="error-text">{errorText}</p>}
        {!!notice && <p className="success-text">{notice}</p>}

        <div className="catalog-card player-manager-card">
          <div className="catalog-table-shell">
            <div className="catalog-table-tools player-manager-tools">
              <div className="player-manager-tools-copy">
                <strong>Players ({filteredPlayers.length})</strong>
                <small>Create once here, then link from Squad Manager.</small>
              </div>
            </div>

            <div className="manual-scope-row player-manager-form">
              <label>
                Name
                <input
                  type="text"
                  value={form.name}
                  onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
                  placeholder="Dewald Brevis"
                />
              </label>
              <label>
                Country
                <input
                  type="text"
                  value={form.country}
                  onChange={(event) => setForm((prev) => ({ ...prev, country: event.target.value }))}
                  placeholder="south africa"
                />
              </label>
              <label>
                Role
                <SelectField
                  value={form.role}
                  onChange={(event) => setForm((prev) => ({ ...prev, role: event.target.value }))}
                  options={PLAYER_ROLE_OPTIONS.map((item) => ({
                    value: item,
                    label: item || 'Select role',
                  }))}
                />
              </label>
              <label>
                Image URL
                <input
                  type="url"
                  value={form.imageUrl}
                  onChange={(event) => setForm((prev) => ({ ...prev, imageUrl: event.target.value }))}
                  placeholder="https://..."
                />
              </label>
              <div className="player-manager-actions">
                <Button
                  type="button"
                  variant="primary"
                  size="small"
                  onClick={onCreatePlayer}
                  disabled={!form.name.trim() || isSaving}
                >
                  Add player
                </Button>
              </div>
            </div>

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
    </section>
  )
}

export default PlayerManagerPanel
