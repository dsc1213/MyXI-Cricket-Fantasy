import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import Button from '../../components/ui/Button.jsx'
import Modal from '../../components/ui/Modal.jsx'
import StickyTable from '../../components/ui/StickyTable.jsx'
import {
  createAdminTournament,
  deleteAdminUser,
  deleteAdminTournament,
  fetchContestCatalog,
  disableTournaments,
  enableTournaments,
  fetchAdminUsers,
  fetchTournamentCatalog,
  syncContestSelections,
  updateAdminUser,
} from '../../lib/api.js'
import { getStoredUser } from '../../lib/auth.js'

function AdminManagerPanel() {
  const currentUser = getStoredUser()
  const isMasterUser = currentUser?.role === 'master_admin'
  const [tab, setTab] = useState('users')
  const [isLoadingUsers, setIsLoadingUsers] = useState(true)
  const [isLoadingTournaments, setIsLoadingTournaments] = useState(true)
  const [isLoadingContests, setIsLoadingContests] = useState(true)
  const [users, setUsers] = useState([])
  const [userDrafts, setUserDrafts] = useState({})
  const [tournamentCatalog, setTournamentCatalog] = useState([])
  const [pendingEnableIds, setPendingEnableIds] = useState([])
  const [pendingDisableIds, setPendingDisableIds] = useState([])
  const [contestCatalog, setContestCatalog] = useState([])
  const [selectedContestTournamentId, setSelectedContestTournamentId] = useState('')
  const [selectedContestIds, setSelectedContestIds] = useState([])
  const [errorText, setErrorText] = useState('')
  const [notice, setNotice] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [isSavingUserRoles, setIsSavingUserRoles] = useState(false)
  const [showDisableModal, setShowDisableModal] = useState(false)
  const [showCreateTournamentModal, setShowCreateTournamentModal] = useState(false)
  const [tournamentCreateMode, setTournamentCreateMode] = useState('manual')
  const [isCreatingTournament, setIsCreatingTournament] = useState(false)
  const [createTournamentForm, setCreateTournamentForm] = useState({
    name: '',
    season: '2026',
    source: 'manual',
  })
  const [createTournamentMatches, setCreateTournamentMatches] = useState([
    { matchNo: 1, home: '', away: '', date: '', startAt: '', venue: '' },
  ])
  const [createTournamentJson, setCreateTournamentJson] = useState('')

  const loadUsers = useCallback(async () => {
    try {
      setIsLoadingUsers(true)
      const rows = await fetchAdminUsers()
      setUsers(rows || [])
      setUserDrafts(
        (rows || []).reduce((acc, row) => {
          acc[row.id] = {
            role: row.role,
            contestManagerContestId: row.contestManagerContestId || '',
            dirty: false,
          }
          return acc
        }, {}),
      )
    } catch (error) {
      setErrorText(error.message || 'Failed to load users')
    } finally {
      setIsLoadingUsers(false)
    }
  }, [])

  const loadTournamentCatalog = useCallback(async () => {
    try {
      setIsLoadingTournaments(true)
      const rows = await fetchTournamentCatalog()
      setTournamentCatalog(rows || [])
      setPendingEnableIds([])
      setPendingDisableIds([])
    } catch (error) {
      setErrorText(error.message || 'Failed to load tournament catalog')
    } finally {
      setIsLoadingTournaments(false)
    }
  }, [])

  const loadContestCatalog = useCallback(async (tournamentId = selectedContestTournamentId) => {
    try {
      setIsLoadingContests(true)
      if (!tournamentId) {
        setContestCatalog([])
        setSelectedContestIds([])
        return
      }
      const rows = await fetchContestCatalog(tournamentId)
      setContestCatalog(rows || [])
      setSelectedContestIds((rows || []).filter((row) => row.enabled).map((row) => row.id))
    } catch (error) {
      setErrorText(error.message || 'Failed to load contest catalog')
    } finally {
      setIsLoadingContests(false)
    }
  }, [selectedContestTournamentId])

  useEffect(() => {
    void loadUsers()
    void loadTournamentCatalog()
  }, [loadTournamentCatalog, loadUsers])

  useEffect(() => {
    if (tab === 'users') {
      void loadUsers()
      return
    }
    if (tab === 'tournaments') {
      void loadTournamentCatalog()
      return
    }
  }, [loadContestCatalog, loadTournamentCatalog, loadUsers, tab])

  useEffect(() => {
    if (tab !== 'contests') return
    if (!selectedContestTournamentId) {
      setContestCatalog([])
      setSelectedContestIds([])
      return
    }
    void loadContestCatalog(selectedContestTournamentId)
  }, [loadContestCatalog, selectedContestTournamentId, tab])

  const onRoleChange = (userId, role) => {
    setUserDrafts((prev) => {
      const current = prev[userId] || {}
      return {
        ...prev,
        [userId]: {
          role,
          contestManagerContestId: current.contestManagerContestId || '',
          dirty: true,
        },
      }
    })
  }

  const onSaveAllUserRoles = async () => {
    const dirtyRows = users.filter((row) => userDrafts[row.id]?.dirty)
    if (!dirtyRows.length) return
    try {
      setErrorText('')
      setNotice('')
      setIsSavingUserRoles(true)
      for (const row of dirtyRows) {
        const draft = userDrafts[row.id]
        // Keep existing contest scope untouched from this roles table.
        await updateAdminUser({
          id: row.id,
          payload: {
            role: draft.role,
            actorUserId:
              currentUser?.gameName || currentUser?.email || currentUser?.id || '',
          },
        })
      }
      setUsers((prev) =>
        prev.map((row) =>
          userDrafts[row.id]?.dirty ? { ...row, role: userDrafts[row.id].role } : row,
        ),
      )
      setUserDrafts((prev) =>
        Object.entries(prev).reduce((acc, [id, draft]) => {
          acc[id] = { ...draft, dirty: false }
          return acc
        }, {}),
      )
      setNotice('Roles saved')
    } catch (error) {
      setErrorText(error.message || 'Failed to save roles')
    } finally {
      setIsSavingUserRoles(false)
    }
  }

  const onDeleteUser = async (userId) => {
    try {
      setErrorText('')
      setNotice('')
      await deleteAdminUser({
        id: userId,
        actorUserId: currentUser?.gameName || currentUser?.email || currentUser?.id || '',
      })
      setUsers((prev) => prev.filter((row) => row.id !== userId))
      setUserDrafts((prev) => {
        const next = { ...prev }
        delete next[userId]
        return next
      })
      setNotice('User deleted')
    } catch (error) {
      setErrorText(error.message || 'Failed to delete user')
    }
  }

  const onToggleTournament = (row) => {
    if (row.enabled) {
      setPendingDisableIds((prev) =>
        prev.includes(row.id) ? prev.filter((item) => item !== row.id) : [...prev, row.id],
      )
      return
    }
    setPendingEnableIds((prev) =>
      prev.includes(row.id) ? prev.filter((item) => item !== row.id) : [...prev, row.id],
    )
  }

  const onCreateTournament = async () => {
    try {
      setErrorText('')
      setNotice('')
      setIsCreatingTournament(true)
      let payload
      if (tournamentCreateMode === 'json') {
        const parsed = JSON.parse(createTournamentJson || '{}')
        payload = {
          ...parsed,
          source: 'json',
          actorUserId:
            currentUser?.gameName || currentUser?.email || currentUser?.id || '',
        }
      } else {
        const cleanedMatches = (createTournamentMatches || [])
          .map((row, index) => ({
            matchNo: Number(row.matchNo || index + 1),
            home: (row.home || '').toString().trim().toUpperCase(),
            away: (row.away || '').toString().trim().toUpperCase(),
            date: row.date || '',
            startAt: row.startAt || '',
            venue: row.venue || '',
          }))
          .filter((row) => row.home && row.away)
        payload = {
          name: createTournamentForm.name,
          season: createTournamentForm.season,
          source: 'manual',
          matches: cleanedMatches,
          actorUserId:
            currentUser?.gameName || currentUser?.email || currentUser?.id || '',
        }
      }
      await createAdminTournament(payload)
      await loadTournamentCatalog()
      setNotice('Tournament created and enabled')
      setShowCreateTournamentModal(false)
      setCreateTournamentForm({ name: '', season: '2026', source: 'manual' })
      setCreateTournamentMatches([{ matchNo: 1, home: '', away: '', date: '', startAt: '', venue: '' }])
      setCreateTournamentJson('')
    } catch (error) {
      setErrorText(error.message || 'Failed to create tournament')
    } finally {
      setIsCreatingTournament(false)
    }
  }

  const onDeleteTournament = async (tournamentId) => {
    try {
      setErrorText('')
      setNotice('')
      await deleteAdminTournament({
        id: tournamentId,
        actorUserId: currentUser?.gameName || currentUser?.email || currentUser?.id || '',
      })
      await loadTournamentCatalog()
      setNotice('Tournament deleted')
    } catch (error) {
      setErrorText(error.message || 'Failed to delete tournament')
    }
  }

  const onEnableTournaments = async () => {
    try {
      if (!pendingEnableIds.length) return
      setIsSaving(true)
      setErrorText('')
      setNotice('')
      await enableTournaments(
        pendingEnableIds,
        currentUser?.gameName || currentUser?.email || currentUser?.id || '',
      )
      await loadTournamentCatalog()
      setNotice('Tournaments added')
    } catch (error) {
      setErrorText(error.message || 'Failed to add tournaments')
    } finally {
      setIsSaving(false)
    }
  }

  const onDisableTournaments = async () => {
    const removableIds = pendingDisableIds.filter((id) =>
      tournamentCatalog.find((row) => row.id === id && row.enabled),
    )
    if (!removableIds.length) return
    try {
      setIsSaving(true)
      setErrorText('')
      setNotice('')
      await disableTournaments(
        removableIds,
        currentUser?.gameName || currentUser?.email || currentUser?.id || '',
      )
      await loadTournamentCatalog()
      setNotice('Tournaments removed. You can re-enable them anytime.')
    } catch (error) {
      setErrorText(error.message || 'Failed to remove tournaments')
    } finally {
      setIsSaving(false)
      setShowDisableModal(false)
    }
  }

  const onToggleContest = (contestId) => {
    setSelectedContestIds((prev) =>
      prev.includes(contestId) ? prev.filter((id) => id !== contestId) : [...prev, contestId],
    )
  }

  const onSaveContests = async () => {
    if (!selectedContestTournamentId) return
    try {
      setIsSaving(true)
      setErrorText('')
      setNotice('')
      await syncContestSelections({
        tournamentId: selectedContestTournamentId,
        enabledIds: selectedContestIds,
      })
      await loadContestCatalog(selectedContestTournamentId)
      setNotice('Contests updated')
    } catch (error) {
      setErrorText(error.message || 'Failed to save contests')
    } finally {
      setIsSaving(false)
    }
  }

  const disabledCount = useMemo(
    () => tournamentCatalog.filter((row) => !row.enabled).length,
    [tournamentCatalog],
  )
  const enabledSelectedCount = useMemo(() => pendingDisableIds.length, [pendingDisableIds])
  const disabledSelectedCount = useMemo(() => pendingEnableIds.length, [pendingEnableIds])
  const selectedEnabledTournaments = useMemo(
    () => tournamentCatalog.filter((row) => pendingDisableIds.includes(row.id) && row.enabled),
    [pendingDisableIds, tournamentCatalog],
  )
  const activeSelectedTournaments = useMemo(
    () => selectedEnabledTournaments.filter((row) => row.hasActiveContests),
    [selectedEnabledTournaments],
  )

  const usersColumns = [
    {
      key: 'name',
      label: 'Name',
      render: (row) => (
        <Link className="leaderboard-link" to={`/users/${row.id}`}>
          {row.name}
        </Link>
      ),
    },
    {
      key: 'location',
      label: 'Location',
      render: (row) => row.location || '-',
    },
    {
      key: 'joinedAt',
      label: 'Date joined',
      render: (row) => new Date(row.joinedAt).toLocaleDateString(),
    },
    {
      key: 'role',
      label: 'Role',
      render: (row) => {
        const draft = userDrafts[row.id] || {
          role: row.role,
          contestManagerContestId: row.contestManagerContestId || '',
          dirty: false,
        }
        const canEditRole =
          isMasterUser || !['admin', 'master_admin'].includes(row.role)
        return (
          <select
            value={draft.role}
            disabled={!canEditRole}
            onClick={(event) => event.stopPropagation()}
            onChange={(event) => onRoleChange(row.id, event.target.value)}
          >
            <option value="user">player (default)</option>
            <option value="contest_manager">score manager</option>
            {isMasterUser && <option value="admin">admin</option>}
            {isMasterUser && <option value="master_admin">master admin</option>}
          </select>
        )
      },
    },
    {
      key: 'delete',
      label: 'Delete',
      render: (row) => (
        <Button
          variant="danger"
          size="small"
          disabled={!isMasterUser || row.role === 'master_admin'}
          onClick={(event) => {
            event.stopPropagation()
            onDeleteUser(row.id)
          }}
        >
          Delete
        </Button>
      ),
    },
  ]

  const tournamentColumns = [
    { key: 'name', label: 'Tournament' },
    { key: 'season', label: 'Season' },
    { key: 'matchesCount', label: 'Matches', render: (row) => Number(row.matchesCount || 0) },
    { key: 'contestsCount', label: 'Contests', render: (row) => Number(row.contestsCount || 0) },
    {
      key: 'enabled',
      label: 'Status',
      render: (row) => (row.enabled ? 'Enabled' : 'Available'),
    },
    {
      key: 'updated',
      label: 'Last updated',
      render: (row) =>
        row.lastUpdatedAt ? new Date(row.lastUpdatedAt).toLocaleString() : '-',
    },
    {
      key: 'select',
      label: 'Select',
      render: (row) => (
        <input
          type="checkbox"
          checked={row.enabled ? !pendingDisableIds.includes(row.id) : pendingEnableIds.includes(row.id)}
          onClick={(event) => event.stopPropagation()}
          onChange={() => onToggleTournament(row)}
        />
      ),
    },
    {
      key: 'delete',
      label: 'Delete',
      render: (row) => (
        <Button
          variant="danger"
          size="small"
          onClick={(event) => {
            event.stopPropagation()
            void onDeleteTournament(row.id)
          }}
        >
          Delete
        </Button>
      ),
    },
  ]
  const dirtyRoleCount = useMemo(
    () => users.filter((row) => userDrafts[row.id]?.dirty).length,
    [users, userDrafts],
  )
  const enabledTournamentOptions = useMemo(
    () =>
      tournamentCatalog
        .filter((row) => row.enabled)
        .map((row) => ({ value: row.id, label: row.name })),
    [tournamentCatalog],
  )
  useEffect(() => {
    if (tab !== 'contests') return
    if (!enabledTournamentOptions.length) {
      if (selectedContestTournamentId) setSelectedContestTournamentId('')
      return
    }
    const exists = enabledTournamentOptions.some(
      (item) => item.value === selectedContestTournamentId,
    )
    if (!exists) {
      setSelectedContestTournamentId(enabledTournamentOptions[0].value)
    }
  }, [enabledTournamentOptions, selectedContestTournamentId, tab])

  const contestDirty = useMemo(() => {
    const enabled = contestCatalog.filter((row) => row.enabled).map((row) => row.id)
    return (
      enabled.length !== selectedContestIds.length ||
      enabled.some((id) => !selectedContestIds.includes(id))
    )
  }, [contestCatalog, selectedContestIds])
  const contestColumns = [
    { key: 'name', label: 'Contest' },
    { key: 'game', label: 'Type' },
    {
      key: 'status',
      label: 'Status',
      render: (row) => (row.enabled ? 'Enabled' : 'Available'),
    },
    {
      key: 'select',
      label: 'Select',
      render: (row) => (
        <input
          type="checkbox"
          checked={selectedContestIds.includes(row.id)}
          onClick={(event) => event.stopPropagation()}
          onChange={() => onToggleContest(row.id)}
        />
      ),
    },
  ]

  return (
    <section className="dashboard-section">
      <div className="admin-card dashboard-panel-card admin-manager-panel">
        <div className="upload-tab-row admin-manager-tabs compact" role="tablist" aria-label="Admin manager tabs">
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'users'}
            className={`upload-tab-btn ${tab === 'users' ? 'active' : ''}`.trim()}
            onClick={() => setTab('users')}
          >
            {`Users (${users.length})`}
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'tournaments'}
            className={`upload-tab-btn ${tab === 'tournaments' ? 'active' : ''}`.trim()}
            onClick={() => setTab('tournaments')}
          >
            {`Tournaments (${tournamentCatalog.length})`}
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'contests'}
            className={`upload-tab-btn ${tab === 'contests' ? 'active' : ''}`.trim()}
            onClick={() => setTab('contests')}
          >
            Contests
          </button>
        </div>

        {!!errorText && <p className="error-text">{errorText}</p>}
        {!!notice && <p className="success-text">{notice}</p>}

        {tab === 'users' ? (
          <>
            <div className="top-actions">
              <Button variant="ghost" size="small" onClick={() => void loadUsers()}>
                Refresh users
              </Button>
              <Button
                variant="primary"
                size="small"
                disabled={!dirtyRoleCount || isSavingUserRoles}
                onClick={() => void onSaveAllUserRoles()}
              >
                {isSavingUserRoles ? 'Saving...' : `Save (${dirtyRoleCount})`}
              </Button>
            </div>
            {isLoadingUsers ? (
              <p className="team-note">Loading users...</p>
            ) : (
              <StickyTable
                columns={usersColumns}
                rows={users}
                rowKey={(row) => row.id}
                emptyText="No users found"
                wrapperClassName="catalog-table-wrap"
                tableClassName="catalog-table"
              />
            )}
          </>
        ) : tab === 'tournaments' ? (
          <>
            <div className="contest-section-head">
              <h3>{`Available (${disabledCount})`}</h3>
              <div className="top-actions">
                <Button variant="ghost" size="small" onClick={() => void loadTournamentCatalog()}>
                  Refresh tournaments
                </Button>
                <Button
                  variant="primary"
                  size="small"
                  disabled={!disabledSelectedCount || isSaving}
                  onClick={onEnableTournaments}
                >
                  {isSaving ? 'Adding...' : 'Add to Tournaments'}
                </Button>
                <Button
                  variant="danger"
                  size="small"
                  disabled={!enabledSelectedCount || isSaving}
                  onClick={() => setShowDisableModal(true)}
                >
                  Remove from Tournaments
                </Button>
              </div>
            </div>
            {isLoadingTournaments ? (
              <p className="team-note">Loading tournaments...</p>
            ) : (
              <StickyTable
                columns={tournamentColumns}
                rows={tournamentCatalog}
                rowKey={(row) => row.id}
                emptyText="No tournaments found"
                wrapperClassName="catalog-table-wrap"
                tableClassName="catalog-table"
              />
            )}
          </>
        ) : (
          <>
            <div className="contest-section-head">
              <h3>Contests</h3>
              <div className="top-actions">
                <select
                  value={selectedContestTournamentId}
                  onChange={(event) => setSelectedContestTournamentId(event.target.value)}
                >
                  {!enabledTournamentOptions.length && (
                    <option value="" disabled>
                      No tournaments enabled
                    </option>
                  )}
                  {enabledTournamentOptions.map((item) => (
                    <option key={item.value} value={item.value}>
                      {item.label}
                    </option>
                  ))}
                </select>
                <Button
                  variant="ghost"
                  size="small"
                  disabled={!selectedContestTournamentId}
                  onClick={() => void loadContestCatalog(selectedContestTournamentId)}
                >
                  Refresh contests
                </Button>
                <Button
                  variant="primary"
                  size="small"
                  disabled={
                    !selectedContestTournamentId || !contestDirty || isSaving
                  }
                  onClick={() => void onSaveContests()}
                >
                  {isSaving ? 'Saving...' : 'Save'}
                </Button>
              </div>
            </div>
            {!enabledTournamentOptions.length ? (
              <p className="team-note">No contests selected.</p>
            ) : !selectedContestTournamentId ? (
              <p className="team-note">No contests selected.</p>
            ) : isLoadingContests ? (
              <p className="team-note">Loading contests...</p>
            ) : (
              <StickyTable
                columns={contestColumns}
                rows={contestCatalog}
                rowKey={(row) => row.id}
                emptyText="No contests selected"
                wrapperClassName="catalog-table-wrap"
                tableClassName="catalog-table"
              />
            )}
          </>
        )}
      </div>
      <Modal
        open={showCreateTournamentModal}
        onClose={() => setShowCreateTournamentModal(false)}
        title="Create tournament"
        size="md"
        footer={
          <>
            <Button variant="ghost" size="small" onClick={() => setShowCreateTournamentModal(false)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              size="small"
              disabled={isCreatingTournament}
              onClick={() => void onCreateTournament()}
            >
              {isCreatingTournament ? 'Creating...' : 'Create'}
            </Button>
          </>
        }
      >
        <div className="create-contest-form">
          <label className="create-contest-field">
            <span>Input type</span>
            <select
              value={tournamentCreateMode}
              onChange={(event) => setTournamentCreateMode(event.target.value)}
            >
              <option value="manual">Manual grid</option>
              <option value="json">JSON</option>
            </select>
          </label>
          {tournamentCreateMode === 'json' ? (
            <label className="create-contest-field">
              <span>JSON payload</span>
              <textarea
                rows={12}
                value={createTournamentJson}
                onChange={(event) => setCreateTournamentJson(event.target.value)}
                placeholder='{"name":"New Cup","season":"2026","matches":[{"matchNo":1,"home":"IND","away":"AUS","date":"2026-03-10","startAt":"2026-03-10T14:00:00.000Z"}]}'
              />
            </label>
          ) : (
            <>
              <label className="create-contest-field">
                <span>Tournament name</span>
                <input
                  type="text"
                  value={createTournamentForm.name}
                  onChange={(event) =>
                    setCreateTournamentForm((prev) => ({ ...prev, name: event.target.value }))
                  }
                />
              </label>
              <label className="create-contest-field">
                <span>Season</span>
                <input
                  type="text"
                  value={createTournamentForm.season}
                  onChange={(event) =>
                    setCreateTournamentForm((prev) => ({ ...prev, season: event.target.value }))
                  }
                />
              </label>
              <div className="create-contest-field">
                <span>Matches</span>
                <div className="top-actions">
                  <Button
                    variant="ghost"
                    size="small"
                    onClick={() =>
                      setCreateTournamentMatches((prev) => [
                        ...prev,
                        {
                          matchNo: prev.length + 1,
                          home: '',
                          away: '',
                          date: '',
                          startAt: '',
                          venue: '',
                        },
                      ])
                    }
                  >
                    + Add match
                  </Button>
                </div>
                {createTournamentMatches.map((row, index) => (
                  <div key={`${index + 1}`} className="manual-scope-row">
                    <input
                      type="number"
                      min="1"
                      value={row.matchNo}
                      onChange={(event) =>
                        setCreateTournamentMatches((prev) =>
                          prev.map((item, i) =>
                            i === index ? { ...item, matchNo: Number(event.target.value || i + 1) } : item,
                          ),
                        )
                      }
                    />
                    <input
                      type="text"
                      placeholder="Home (IND)"
                      value={row.home}
                      onChange={(event) =>
                        setCreateTournamentMatches((prev) =>
                          prev.map((item, i) =>
                            i === index ? { ...item, home: event.target.value } : item,
                          ),
                        )
                      }
                    />
                    <input
                      type="text"
                      placeholder="Away (AUS)"
                      value={row.away}
                      onChange={(event) =>
                        setCreateTournamentMatches((prev) =>
                          prev.map((item, i) =>
                            i === index ? { ...item, away: event.target.value } : item,
                          ),
                        )
                      }
                    />
                    <input
                      type="date"
                      value={row.date}
                      onChange={(event) =>
                        setCreateTournamentMatches((prev) =>
                          prev.map((item, i) =>
                            i === index ? { ...item, date: event.target.value } : item,
                          ),
                        )
                      }
                    />
                    <input
                      type="datetime-local"
                      value={row.startAt}
                      onChange={(event) =>
                        setCreateTournamentMatches((prev) =>
                          prev.map((item, i) =>
                            i === index ? { ...item, startAt: event.target.value } : item,
                          ),
                        )
                      }
                    />
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </Modal>
      <Modal
        open={showDisableModal}
        onClose={() => setShowDisableModal(false)}
        title="Remove tournaments?"
        size="sm"
        footer={
          <>
            <Button variant="ghost" size="small" onClick={() => setShowDisableModal(false)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              size="small"
              disabled={isSaving || !enabledSelectedCount}
              onClick={() => void onDisableTournaments()}
            >
              {isSaving ? 'Removing...' : 'Remove'}
            </Button>
          </>
        }
      >
        <p>
          {`Are you sure you want to delete ${selectedEnabledTournaments
            .map((item) => item.name)
            .join(', ')} tournaments?`}
        </p>
        {!!activeSelectedTournaments.length && (
          <p className="error-text">
            {`Warning: ${activeSelectedTournaments
              .map((item) => item.name)
              .join(', ')} are not completed yet.`}
          </p>
        )}
        <p className="team-note">You can recover removed tournaments anytime from this page.</p>
      </Modal>
    </section>
  )
}

export default AdminManagerPanel
