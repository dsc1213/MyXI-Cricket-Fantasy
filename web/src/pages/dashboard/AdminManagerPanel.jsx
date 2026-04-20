import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import ResourceRemovalModal from '../../components/admin/ResourceRemovalModal.jsx'
import CreateContestModal from '../../components/contest/CreateContestModal.jsx'
import Button from '../../components/ui/Button.jsx'
import JsonTextareaField from '../../components/ui/JsonTextareaField.jsx'
import Modal from '../../components/ui/Modal.jsx'
import SearchableSelect from '../../components/ui/SearchableSelect.jsx'
import StickyTable from '../../components/ui/StickyTable.jsx'
import {
  createAdminTournament,
  createAdminContest,
  addAdminContestParticipant,
  deleteAdminUser,
  fetchAdminContestParticipants,
  fetchContestRemovalPreview,
  fetchTournamentRemovalPreview,
  fetchContestCatalog,
  fetchContestMatchOptions,
  removeAdminContest,
  removeAdminContestParticipant,
  removeAdminTournament,
  disableTournaments,
  enableTournaments,
  fetchAdminUsers,
  fetchTournamentCatalog,
  fetchTournamentMatches,
  replaceAdminMatchBackups,
  startAdminContest,
  syncContestSelections,
  updateAdminMatchStatus,
  updateAdminContest,
  updateAdminUser,
} from '../../lib/api.js'
import { getStoredUser } from '../../lib/auth.js'
import { parseNormalizedJsonInput } from '../../lib/jsonInput.js'

const normalizeUsersPayload = (value) => {
  if (Array.isArray(value)) return value
  if (Array.isArray(value?.users)) return value.users
  if (Array.isArray(value?.rows)) return value.rows
  return []
}

const formatSafeDate = (value, formatter = 'date') => {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '-'
  return formatter === 'datetime' ? date.toLocaleString() : date.toLocaleDateString()
}

const formatMatchStatusLabel = (value = '') => {
  const normalized = value.toString().trim().toLowerCase()
  if (normalized === 'notstarted') return 'Not Started'
  if (normalized === 'inprogress') return 'In Progress'
  if (normalized === 'completed') return 'Completed'
  return value || '-'
}

function AdminManagerPanel({
  initialTab = 'users',
  hideTabs = false,
  tournamentSelectorOnly = false,
  preferredTournamentId = '',
}) {
  const currentUser = getStoredUser()
  const isMasterUser = currentUser?.role === 'master_admin'
  const canDeleteTournaments = ['admin', 'master_admin'].includes(currentUser?.role || '')
  const canRemoveContests = ['admin', 'master_admin'].includes(currentUser?.role || '')
  const [tab, setTab] = useState(initialTab)
  const [isLoadingUsers, setIsLoadingUsers] = useState(true)
  const [isLoadingTournaments, setIsLoadingTournaments] = useState(true)
  const [isLoadingContests, setIsLoadingContests] = useState(true)
  const [users, setUsers] = useState([])
  const [userFilterQuery, setUserFilterQuery] = useState('')
  const [userDrafts, setUserDrafts] = useState({})
  const [tournamentCatalog, setTournamentCatalog] = useState([])
  const [tournamentFilterQuery, setTournamentFilterQuery] = useState('')
  const [selectedTournamentId, setSelectedTournamentId] = useState('')
  const [tournamentMatches, setTournamentMatches] = useState([])
  const [isLoadingTournamentMatches, setIsLoadingTournamentMatches] = useState(false)
  const [pendingDisableIds, setPendingDisableIds] = useState([])
  const [contestCatalog, setContestCatalog] = useState([])
  const [selectedContestTournamentId, setSelectedContestTournamentId] = useState('')
  const [selectedContestIds, setSelectedContestIds] = useState([])
  const [errorText, setErrorText] = useState('')
  const [notice, setNotice] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [isSavingUserRoles, setIsSavingUserRoles] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [removalTarget, setRemovalTarget] = useState(null)
  const [isRemovingResource, setIsRemovingResource] = useState(false)
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
  const [showCreateContestModal, setShowCreateContestModal] = useState(false)
  const [isCreatingContest, setIsCreatingContest] = useState(false)
  const [createContestForm, setCreateContestForm] = useState({
    name: '',
    teams: '8',
    startAt: '',
  })
  const [createContestMatchOptions, setCreateContestMatchOptions] = useState([])
  const [createContestMatchIds, setCreateContestMatchIds] = useState([])
  const [editContest, setEditContest] = useState(null)
  const [editContestForm, setEditContestForm] = useState({
    name: '',
    teams: '',
    startAt: '',
  })
  const [contestParticipants, setContestParticipants] = useState([])
  const [editContestParticipantIds, setEditContestParticipantIds] = useState([])
  const [editContestAddUserId, setEditContestAddUserId] = useState('')
  const [pendingParticipantAction, setPendingParticipantAction] = useState(null)
  const [isLoadingContestParticipants, setIsLoadingContestParticipants] = useState(false)
  const [isSavingContestEdit, setIsSavingContestEdit] = useState(false)

  const loadUsers = useCallback(async () => {
    try {
      setIsLoadingUsers(true)
      const response = await fetchAdminUsers()
      const rows = normalizeUsersPayload(response)
      setUsers(rows)
      setUserDrafts(
        rows.reduce((acc, row) => {
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
      setSelectedTournamentId((prev) => {
        if (!rows?.length) return ''
        if (
          preferredTournamentId &&
          rows.some((row) => String(row.id) === String(preferredTournamentId))
        ) {
          return String(preferredTournamentId)
        }
        return rows.some((row) => String(row.id) === String(prev))
          ? prev
          : String(rows[0].id)
      })
      setPendingDisableIds([])
    } catch (error) {
      setErrorText(error.message || 'Failed to load tournament catalog')
    } finally {
      setIsLoadingTournaments(false)
    }
  }, [preferredTournamentId])

  const loadTournamentMatches = useCallback(
    async (tournamentId = selectedTournamentId) => {
      if (!tournamentId) {
        setTournamentMatches([])
        return
      }
      try {
        setIsLoadingTournamentMatches(true)
        const rows = await fetchTournamentMatches(tournamentId)
        setTournamentMatches(Array.isArray(rows) ? rows : [])
      } catch (error) {
        setErrorText(error.message || 'Failed to load tournament matches')
      } finally {
        setIsLoadingTournamentMatches(false)
      }
    },
    [selectedTournamentId],
  )

  const loadContestCatalog = useCallback(
    async (tournamentId = selectedContestTournamentId) => {
      try {
        setIsLoadingContests(true)
        if (!tournamentId) {
          setContestCatalog([])
          setSelectedContestIds([])
          return
        }
        const rows = await fetchContestCatalog(tournamentId)
        setContestCatalog(rows || [])
        setSelectedContestIds(
          (rows || []).filter((row) => row.enabled).map((row) => row.id),
        )
      } catch (error) {
        setErrorText(error.message || 'Failed to load contest catalog')
      } finally {
        setIsLoadingContests(false)
      }
    },
    [selectedContestTournamentId],
  )

  useEffect(() => {
    setTab(initialTab)
  }, [initialTab])

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
    if (tab !== 'tournaments') return
    if (!selectedTournamentId) {
      setTournamentMatches([])
      return
    }
    void loadTournamentMatches(selectedTournamentId)
  }, [loadTournamentMatches, selectedTournamentId, tab])

  useEffect(() => {
    if (!preferredTournamentId) return
    setSelectedTournamentId(String(preferredTournamentId))
  }, [preferredTournamentId])

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
    setPendingDisableIds((prev) =>
      prev.includes(row.id) ? prev.filter((item) => item !== row.id) : [...prev, row.id],
    )
  }

  const onSelectTournament = (row) => {
    setSelectedTournamentId(String(row.id))
  }

  const onToggleTournamentEnabled = async (row) => {
    try {
      setIsSaving(true)
      setErrorText('')
      setNotice('')
      const actorUserId =
        currentUser?.gameName || currentUser?.email || currentUser?.id || ''
      if (row.enabled) {
        await disableTournaments([row.id], actorUserId)
        setNotice('Tournament disabled')
      } else {
        await enableTournaments([row.id], actorUserId)
        setNotice('Tournament enabled')
      }
      await loadTournamentCatalog()
    } catch (error) {
      setErrorText(error.message || 'Failed to update tournament status')
    } finally {
      setIsSaving(false)
    }
  }

  const onCreateTournament = async () => {
    try {
      setErrorText('')
      setNotice('')
      setIsCreatingTournament(true)
      let payload
      if (tournamentCreateMode === 'json') {
        const { parsed, normalizedText } = parseNormalizedJsonInput(
          createTournamentJson || '{}',
        )
        if (normalizedText !== createTournamentJson) {
          setCreateTournamentJson(JSON.stringify(parsed, null, 2))
        }
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
      setNotice('Tournament created. Enable it from the tournaments list when ready.')
      setShowCreateTournamentModal(false)
      setCreateTournamentForm({ name: '', season: '2026', source: 'manual' })
      setCreateTournamentMatches([
        { matchNo: 1, home: '', away: '', date: '', startAt: '', venue: '' },
      ])
      setCreateTournamentJson('')
    } catch (error) {
      setErrorText(error.message || 'Failed to create tournament')
    } finally {
      setIsCreatingTournament(false)
    }
  }

  const getUserDisplayName = (row = {}) =>
    (row.gameName || row.name || row.userId || row.email || row.id || '').toString().trim()

  const openCreateContestModal = async () => {
    if (!selectedContestTournamentId) return
    try {
      setErrorText('')
      setNotice('')
      setShowCreateContestModal(true)
      const rows = await fetchContestMatchOptions(selectedContestTournamentId)
      const options = Array.isArray(rows) ? rows : []
      setCreateContestMatchOptions(options)
      setCreateContestMatchIds(options.map((row) => String(row.id)))
    } catch (error) {
      setErrorText(error.message || 'Failed to load contest matches')
    }
  }

  const onCreateContest = async () => {
    try {
      setErrorText('')
      setNotice('')
      setIsCreatingContest(true)
      await createAdminContest({
        tournamentId: selectedContestTournamentId,
        name: createContestForm.name,
        teams: Number(createContestForm.teams || 0),
        maxParticipants: Number(createContestForm.teams || 0),
        startAt: createContestForm.startAt
          ? new Date(createContestForm.startAt).toISOString()
          : null,
        matchIds: createContestMatchIds,
        game: 'Fantasy',
        actorUserId: currentUser?.gameName || currentUser?.email || currentUser?.id || '',
      })
      setShowCreateContestModal(false)
      setCreateContestForm({ name: '', teams: '8', startAt: '' })
      setCreateContestMatchOptions([])
      setCreateContestMatchIds([])
      await loadContestCatalog(selectedContestTournamentId)
      setNotice('Contest created')
    } catch (error) {
      setErrorText(error.message || 'Failed to create contest')
    } finally {
      setIsCreatingContest(false)
    }
  }

  const loadContestParticipants = async (contest) => {
    if (!contest?.id) return []
    try {
      setIsLoadingContestParticipants(true)
      setErrorText('')
      const payload = await fetchAdminContestParticipants(contest.id)
      const rows = Array.isArray(payload?.participants) ? payload.participants : []
      setContestParticipants(rows)
      return rows
    } catch (error) {
      setErrorText(error.message || 'Failed to load contest participants')
      setContestParticipants([])
      return []
    } finally {
      setIsLoadingContestParticipants(false)
    }
  }

  const openContestEditModal = async (contest) => {
    setEditContest(contest)
    setEditContestForm({
      name: contest?.name || '',
      teams: String(contest?.maxPlayers || contest?.maxParticipants || contest?.teams || ''),
      startAt: contest?.startAt ? new Date(contest.startAt).toISOString().slice(0, 16) : '',
    })
    setEditContestAddUserId('')
    const rows = await loadContestParticipants(contest)
    setEditContestParticipantIds(rows.map((row) => String(row.id)))
  }

  const closeContestEditModal = () => {
    setEditContest(null)
    setEditContestForm({ name: '', teams: '', startAt: '' })
    setContestParticipants([])
    setEditContestParticipantIds([])
    setEditContestAddUserId('')
    setPendingParticipantAction(null)
  }

  const applyPendingParticipantAction = () => {
    if (!pendingParticipantAction) return
    const userId = String(pendingParticipantAction.userId || '')
    if (!userId) {
      setPendingParticipantAction(null)
      return
    }
    if (pendingParticipantAction.type === 'add') {
      setEditContestParticipantIds((prev) =>
        prev.includes(userId) ? prev : [...prev, userId],
      )
      setEditContestAddUserId('')
    }
    if (pendingParticipantAction.type === 'remove') {
      setEditContestParticipantIds((prev) =>
        prev.filter((id) => String(id) !== userId),
      )
    }
    setPendingParticipantAction(null)
  }

  const onSaveContestEdit = async () => {
    if (!editContest?.id) return
    try {
      setIsSavingContestEdit(true)
      setErrorText('')
      setNotice('')
      await updateAdminContest(editContest.id, {
        name: editContestForm.name.trim(),
        maxParticipants: Number(editContestForm.teams || 0),
        startAt: editContestForm.startAt
          ? new Date(editContestForm.startAt).toISOString()
          : null,
      })
      const originalIds = new Set(contestParticipants.map((row) => String(row.id)))
      const nextIds = new Set(editContestParticipantIds.map((id) => String(id)))
      const idsToAdd = [...nextIds].filter((id) => !originalIds.has(id))
      const idsToRemove = [...originalIds].filter((id) => !nextIds.has(id))
      await Promise.all([
        ...idsToAdd.map((userId) =>
          addAdminContestParticipant({ contestId: editContest.id, userId }),
        ),
        ...idsToRemove.map((userId) =>
          removeAdminContestParticipant({ contestId: editContest.id, userId }),
        ),
      ])
      await loadContestCatalog(selectedContestTournamentId)
      closeContestEditModal()
      setNotice('Contest updated')
    } catch (error) {
      setErrorText(error.message || 'Failed to update contest')
    } finally {
      setIsSavingContestEdit(false)
    }
  }

  const onDeleteTournament = async (tournamentId) => {
    if (!canDeleteTournaments) {
      setErrorText('Only admin/master can remove tournaments')
      return
    }
    try {
      setErrorText('')
      setNotice('')
      await removeAdminTournament({
        id: tournamentId,
        actorUserId: currentUser?.gameName || currentUser?.email || currentUser?.id || '',
      })
      await loadTournamentCatalog()
      setNotice('Tournament removed and sent for master review')
    } catch (error) {
      setErrorText(error.message || 'Failed to remove tournament')
    }
  }

  const onRemoveContest = async (contestId) => {
    if (!canRemoveContests) {
      setErrorText('Only admin/master can remove contests')
      return
    }
    try {
      setErrorText('')
      setNotice('')
      await removeAdminContest(
        contestId,
        currentUser?.gameName || currentUser?.email || currentUser?.id || '',
      )
      await loadContestCatalog(selectedContestTournamentId)
      closeContestEditModal()
      setNotice('Contest removed and sent for master review')
    } catch (error) {
      setErrorText(error.message || 'Failed to remove contest')
    }
  }

  const confirmDeleteTarget = async () => {
    if (!deleteTarget) return
    const current = deleteTarget
    setDeleteTarget(null)
    if (current.type === 'user') {
      await onDeleteUser(current.id)
    }
  }

  const onDeleteSelectedTournaments = async () => {
    const removableIds = pendingDisableIds.filter((id) =>
      tournamentCatalog.find((row) => row.id === id),
    )
    if (!removableIds.length) return
    try {
      setIsSaving(true)
      setErrorText('')
      setNotice('')
      for (const tournamentId of removableIds) {
        await removeAdminTournament({
          id: tournamentId,
          actorUserId:
            currentUser?.gameName || currentUser?.email || currentUser?.id || '',
        })
      }
      await loadTournamentCatalog()
      setNotice('Selected tournaments removed and sent for master review')
    } catch (error) {
      setErrorText(error.message || 'Failed to remove selected tournaments')
    } finally {
      setIsSaving(false)
    }
  }

  const onToggleContest = (contestId) => {
    setSelectedContestIds((prev) =>
      prev.includes(contestId)
        ? prev.filter((id) => id !== contestId)
        : [...prev, contestId],
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

  const enabledSelectedCount = useMemo(
    () => pendingDisableIds.length,
    [pendingDisableIds],
  )

  const normalizedUserFilterQuery = userFilterQuery.trim().toLowerCase()
  const filteredUsers = useMemo(() => {
    if (!normalizedUserFilterQuery) return users
    return users.filter((row) =>
      [
        row.name,
        row.userId,
        row.gameName,
        row.email,
        row.phone,
        row.location,
        row.role,
      ].some((value) =>
        String(value || '')
          .toLowerCase()
          .includes(normalizedUserFilterQuery),
      ),
    )
  }, [normalizedUserFilterQuery, users])

  const selectedTournament = useMemo(
    () =>
      tournamentCatalog.find((row) => String(row.id) === String(selectedTournamentId)) ||
      null,
    [selectedTournamentId, tournamentCatalog],
  )

  const normalizedTournamentFilterQuery = tournamentFilterQuery.trim().toLowerCase()
  const filteredTournamentCatalog = useMemo(() => {
    if (!normalizedTournamentFilterQuery) return tournamentCatalog
    return tournamentCatalog.filter((row) =>
      [row.name, row.season, row.status, row.enabled ? 'enabled' : 'available'].some(
        (value) =>
          String(value || '')
            .toLowerCase()
            .includes(normalizedTournamentFilterQuery),
      ),
    )
  }, [normalizedTournamentFilterQuery, tournamentCatalog])

  const onStartContestNow = async (contestId) => {
    try {
      setIsSaving(true)
      setErrorText('')
      setNotice('')
      await startAdminContest(
        contestId,
        currentUser?.gameName || currentUser?.email || currentUser?.id || '',
      )
      await loadContestCatalog(selectedContestTournamentId)
      setNotice('Contest started')
    } catch (error) {
      setErrorText(error.message || 'Failed to start contest')
    } finally {
      setIsSaving(false)
    }
  }

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
      render: (row) => formatSafeDate(row.joinedAt || row.createdAt),
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
        const canEditRole = isMasterUser || !['admin', 'master_admin'].includes(row.role)
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
            setDeleteTarget({
              type: 'user',
              id: row.id,
              detail: `Delete user "${row.name || row.gameName || row.userId || row.email}"?`,
            })
          }}
        >
          Delete
        </Button>
      ),
    },
  ]

  const tournamentColumns = [
    {
      key: 'select',
      label: 'Select',
      render: (row) => (
        <input
          type="checkbox"
          checked={pendingDisableIds.includes(row.id)}
          onClick={(event) => event.stopPropagation()}
          onChange={() => onToggleTournament(row)}
        />
      ),
    },
    { key: 'name', label: 'Tournament' },
    { key: 'season', label: 'Season' },
    {
      key: 'matchesCount',
      label: 'Matches',
      render: (row) => Number(row.matchesCount || 0),
    },
    {
      key: 'contestsCount',
      label: 'Contests',
      render: (row) => Number(row.contestsCount || 0),
    },
    {
      key: 'enabled',
      label: 'Status',
      render: (row) => (row.enabled ? 'Enabled' : 'Available'),
    },
    {
      key: 'updated',
      label: 'Last updated',
      render: (row) => formatSafeDate(row.lastUpdatedAt, 'datetime'),
    },
    {
      key: 'action',
      label: 'Action',
      render: (row) => (
        <Button
          variant={row.enabled ? 'danger' : 'primary'}
          size="small"
          disabled={isSaving}
          onClick={(event) => {
            event.stopPropagation()
            void onToggleTournamentEnabled(row)
          }}
        >
          {row.enabled ? 'Disable' : 'Enable'}
        </Button>
      ),
    },
    {
      key: 'delete',
      label: 'Remove',
      render: (row) => (
        <Button
          variant="danger"
          size="small"
          disabled={!canDeleteTournaments || isSaving}
          onClick={(event) => {
            event.stopPropagation()
            setRemovalTarget({
              type: 'tournament',
              id: row.id,
              name: row.name,
            })
          }}
        >
          Remove
        </Button>
      ),
    },
  ]
  const tournamentMatchColumns = [
    {
      key: 'name',
      label: 'Match',
      render: (row) =>
        row.name || `${row.home || row.teamA || ''} vs ${row.away || row.teamB || ''}`,
    },
    {
      key: 'startAt',
      label: 'Starts',
      render: (row) => formatSafeDate(row.startAt || row.startTime, 'datetime'),
    },
    {
      key: 'status',
      label: 'Status',
      render: (row) => (
        <select
          aria-label={`Match status ${row.name || row.id}`}
          value={(row.status || '').toString().trim().toLowerCase()}
          disabled={isSaving}
          onClick={(event) => event.stopPropagation()}
          onChange={async (event) => {
            try {
              setIsSaving(true)
              setErrorText('')
              setNotice('')
              await updateAdminMatchStatus({ id: row.id, status: event.target.value })
              await loadTournamentMatches(selectedTournamentId)
              setNotice('Match status updated')
            } catch (error) {
              setErrorText(error.message || 'Failed to update match status')
            } finally {
              setIsSaving(false)
            }
          }}
        >
          <option value="notstarted">Not Started</option>
          <option value="inprogress">In Progress</option>
          <option value="completed">Completed</option>
        </select>
      ),
    },
    {
      key: 'statusPreview',
      label: 'Display',
      render: (row) => formatMatchStatusLabel(row.status),
    },
    {
      key: 'scoresUpdated',
      label: 'Scores Updated',
      render: (row) => (row?.scoresUpdated ? 'Yes' : 'No'),
    },
    {
      key: 'actions',
      label: 'Actions',
      render: (row) => (
        <Button
          variant="ghost"
          size="small"
          disabled={isSaving}
          onClick={async (event) => {
            event.stopPropagation()
            try {
              setIsSaving(true)
              setErrorText('')
              setNotice('')
              const result = await replaceAdminMatchBackups({ id: row.id })
              await loadTournamentMatches(selectedTournamentId)
              const updatedSelections = Number(
                result?.autoReplacement?.updatedSelections || 0,
              )
              const skippedSelections = Number(
                result?.autoReplacement?.skippedSelections || 0,
              )
              setNotice(
                `Backups replaced (${updatedSelections} updated, ${skippedSelections} skipped)`,
              )
            } catch (error) {
              setErrorText(error.message || 'Failed to replace backups')
            } finally {
              setIsSaving(false)
            }
          }}
        >
          Replace Backups
        </Button>
      ),
    },
  ]
  const dirtyRoleCount = useMemo(
    () => users.filter((row) => userDrafts[row.id]?.dirty).length,
    [users, userDrafts],
  )
  const contestTournamentOptions = useMemo(
    () =>
      tournamentCatalog.map((row) => ({
        value: row.id,
        label: row.enabled ? row.name : `${row.name} (disabled)`,
        contestsCount: Number(row.contestsCount || 0),
      })),
    [tournamentCatalog],
  )
  useEffect(() => {
    if (tab !== 'contests') return
    if (!contestTournamentOptions.length) {
      if (selectedContestTournamentId) setSelectedContestTournamentId('')
      return
    }
    const exists = contestTournamentOptions.some(
      (item) => item.value === selectedContestTournamentId,
    )
    if (!exists) {
      const preferredOption =
        contestTournamentOptions.find((item) => item.contestsCount > 0) ||
        contestTournamentOptions[0]
      setSelectedContestTournamentId(preferredOption.value)
    }
  }, [contestTournamentOptions, selectedContestTournamentId, tab])

  const contestDirty = useMemo(() => {
    const enabled = contestCatalog.filter((row) => row.enabled).map((row) => row.id)
    return (
      enabled.length !== selectedContestIds.length ||
      enabled.some((id) => !selectedContestIds.includes(id))
    )
  }, [contestCatalog, selectedContestIds])
  const canEditContestRow = (row = {}) =>
    isMasterUser || (row.mode || '').toString().trim().toLowerCase() !== 'fixed_roster'
  const selectedEditParticipantIds = useMemo(
    () => new Set(editContestParticipantIds.map((id) => String(id))),
    [editContestParticipantIds],
  )
  const editParticipantRows = useMemo(() => {
    const userMap = new Map(users.map((row) => [String(row.id), row]))
    const participantMap = new Map(contestParticipants.map((row) => [String(row.id), row]))
    return editContestParticipantIds.map((id) => {
      const key = String(id)
      return {
        ...(userMap.get(key) || {}),
        ...(participantMap.get(key) || {}),
        id: key,
      }
    })
  }, [contestParticipants, editContestParticipantIds, users])
  const addableParticipantOptions = useMemo(
    () =>
      users
        .filter((row) => !selectedEditParticipantIds.has(String(row.id)))
        .sort((a, b) => getUserDisplayName(a).localeCompare(getUserDisplayName(b)))
        .map((row) => ({
          value: row.id,
          label: getUserDisplayName(row),
        })),
    [selectedEditParticipantIds, users],
  )
  const participantColumns = [
    {
      key: 'name',
      label: 'Game Name',
      render: (row) => (
        <div className="participant-name-action">
          <span>{getUserDisplayName(row)}</span>
          <Button
            variant="ghost"
            size="small"
            disabled={isSavingContestEdit}
            onClick={(event) => {
              event.stopPropagation()
              setPendingParticipantAction({
                type: 'remove',
                userId: row.id,
                label: getUserDisplayName(row),
              })
            }}
          >
            Remove
          </Button>
        </div>
      ),
    },
    {
      key: 'joinedAt',
      label: 'Joined',
      render: (row) => formatSafeDate(row.joinedAt, 'datetime'),
    },
  ]
  const contestColumns = [
    { key: 'name', label: 'Contest' },
    { key: 'game', label: 'Type' },
    {
      key: 'mode',
      label: 'Mode',
      render: (row) => (row.mode === 'fixed_roster' ? 'Auction' : 'Standard'),
    },
    {
      key: 'status',
      label: 'Status',
      render: (row) => row.status || (row.enabled ? 'Enabled' : 'Available'),
    },
    {
      key: 'startAt',
      label: 'Starts',
      render: (row) => (row.startAt ? formatSafeDate(row.startAt, 'datetime') : 'Manual'),
    },
    {
      key: 'participants',
      label: 'Participants',
      render: (row) =>
        `${Number(row.joinedCount ?? row.participantsCount ?? row.participants ?? 0)} / ${Number(row.maxPlayers || row.maxParticipants || row.teams || 0) || '-'}`,
    },
    {
      key: 'select',
      label: 'Select',
      render: (row) => (
        <input
          type="checkbox"
          checked={selectedContestIds.includes(row.id)}
          disabled={!canEditContestRow(row)}
          onClick={(event) => event.stopPropagation()}
          onChange={() => onToggleContest(row.id)}
        />
      ),
    },
    {
      key: 'action',
      label: 'Action',
      render: (row) => (
        <Button
          variant="ghost"
          size="small"
          disabled={!canEditContestRow(row) || !row.canStart || isSaving}
          onClick={(event) => {
            event.stopPropagation()
            void onStartContestNow(row.id)
          }}
        >
          {row.canStart ? 'Start now' : 'Started'}
        </Button>
      ),
    },
    {
      key: 'edit',
      label: 'Edit',
      render: (row) => (
        <Button
          variant="ghost"
          size="small"
          disabled={!canEditContestRow(row)}
          onClick={(event) => {
            event.stopPropagation()
            void openContestEditModal(row)
          }}
          title={canEditContestRow(row) ? 'Edit contest' : 'Auction contests are master-only'}
        >
          Edit
        </Button>
      ),
    },
  ]

  return (
    <section className="dashboard-section">
      <div className="admin-card dashboard-panel-card admin-manager-panel">
        {!hideTabs && (
          <div
            className="upload-tab-row admin-manager-tabs compact"
            role="tablist"
            aria-label="Admin manager tabs"
          >
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
        )}

        {!!errorText && <p className="error-text">{errorText}</p>}
        {!!notice && <p className="success-text">{notice}</p>}

        {tab === 'users' ? (
          <>
            <div className="contest-section-head">
              <h3>
                {`Available users (${filteredUsers.length}${normalizedUserFilterQuery ? ` / ${users.length}` : ''})`}
              </h3>
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
            </div>
            <div className="admin-user-filter-row">
              <input
                type="search"
                className="dashboard-text-input"
                placeholder="Search users by name, id, email, location, or role"
                value={userFilterQuery}
                onChange={(event) => setUserFilterQuery(event.target.value)}
                aria-label="Search users"
              />
            </div>
            {isLoadingUsers ? (
              <p className="team-note">Loading users...</p>
            ) : (
              <StickyTable
                columns={usersColumns}
                rows={filteredUsers}
                rowKey={(row) => row.id}
                emptyText={
                  normalizedUserFilterQuery
                    ? 'No users match this filter'
                    : 'No users found'
                }
                wrapperClassName="catalog-table-wrap"
                tableClassName="catalog-table"
              />
            )}
          </>
        ) : tab === 'tournaments' ? (
          <>
            {isLoadingTournaments ? (
              <p className="team-note">Loading tournaments...</p>
            ) : (
              <>
                {tournamentSelectorOnly ? (
                  <div className="admin-manager-tournament-selector-shell">
                    <div className="contest-section-head">
                      <h3>Manage tournaments</h3>
                      <div className="top-actions">
                        <Button
                          variant="ghost"
                          size="small"
                          onClick={() => void loadTournamentCatalog()}
                        >
                          Refresh tournaments
                        </Button>
                      </div>
                    </div>
                    <div className="admin-tournament-filter-row">
                      <input
                        type="search"
                        className="dashboard-text-input"
                        placeholder="Search tournaments by name, season, or status"
                        value={tournamentFilterQuery}
                        onChange={(event) => setTournamentFilterQuery(event.target.value)}
                        aria-label="Search tournaments"
                      />
                    </div>
                    <StickyTable
                      columns={tournamentColumns}
                      rows={filteredTournamentCatalog}
                      rowKey={(row) => row.id}
                      emptyText={
                        normalizedTournamentFilterQuery
                          ? 'No tournaments match this search'
                          : 'No tournaments found'
                      }
                      wrapperClassName="catalog-table-wrap"
                      tableClassName="catalog-table"
                      rowClassName={(row) =>
                        String(row.id) === String(selectedTournamentId) ? 'active' : ''
                      }
                      onRowClick={onSelectTournament}
                    />
                  </div>
                ) : (
                  <div className="admin-manager-tournaments-pane">
                    <div className="contest-section-head">
                      <h3>Tournaments</h3>
                      <div className="top-actions">
                        <Button
                          variant="ghost"
                          size="small"
                          onClick={() => void loadTournamentCatalog()}
                        >
                          Refresh tournaments
                        </Button>
                        <Button
                          variant="danger"
                          size="small"
                          disabled={!enabledSelectedCount || isSaving || !isMasterUser}
                          onClick={() => void onDeleteSelectedTournaments()}
                        >
                          Remove selected
                        </Button>
                      </div>
                    </div>
                    <StickyTable
                      columns={tournamentColumns}
                      rows={tournamentCatalog}
                      rowKey={(row) => row.id}
                      emptyText="No tournaments found"
                      wrapperClassName="catalog-table-wrap"
                      tableClassName="catalog-table"
                      rowClassName={(row) =>
                        String(row.id) === String(selectedTournamentId) ? 'active' : ''
                      }
                      onRowClick={onSelectTournament}
                    />
                  </div>
                )}
                <div className="admin-manager-matches-pane">
                  <div className="contest-section-head">
                    <h3>{`Matches${selectedTournament?.name ? ` • ${selectedTournament.name}` : ''}`}</h3>
                    <div className="top-actions">
                      <Button
                        variant="ghost"
                        size="small"
                        disabled={!selectedTournamentId}
                        onClick={() => void loadTournamentMatches(selectedTournamentId)}
                      >
                        Refresh matches
                      </Button>
                    </div>
                  </div>
                  {!selectedTournamentId ? (
                    <p className="team-note">
                      Select a tournament to manage its matches.
                    </p>
                  ) : isLoadingTournamentMatches ? (
                    <p className="team-note">Loading matches...</p>
                  ) : (
                    <StickyTable
                      columns={tournamentMatchColumns}
                      rows={tournamentMatches}
                      rowKey={(row) => row.id}
                      emptyText="No matches found for this tournament"
                      wrapperClassName="catalog-table-wrap"
                      tableClassName="catalog-table"
                    />
                  )}
                </div>
              </>
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
                  {!contestTournamentOptions.length && (
                    <option value="" disabled>
                      No tournaments available
                    </option>
                  )}
                  {contestTournamentOptions.map((item) => (
                    <option key={item.value} value={item.value}>
                      {item.label}
                    </option>
                  ))}
                </select>
                <Button
                  variant="secondary"
                  size="small"
                  disabled={!selectedContestTournamentId}
                  onClick={() => void openCreateContestModal()}
                >
                  + Create contest
                </Button>
                <Button
                  variant="primary"
                  size="small"
                  disabled={!selectedContestTournamentId || !contestDirty || isSaving}
                  onClick={() => void onSaveContests()}
                >
                  {isSaving ? 'Saving...' : 'Save'}
                </Button>
              </div>
            </div>
            {!contestTournamentOptions.length ? (
              <p className="team-note">No tournaments available.</p>
            ) : !selectedContestTournamentId ? (
              <p className="team-note">Select a tournament to manage contests.</p>
            ) : isLoadingContests ? (
              <p className="team-note">Loading contests...</p>
            ) : (
              <StickyTable
                columns={contestColumns}
                rows={contestCatalog}
                rowKey={(row) => row.id}
                emptyText="No contests found for this tournament"
                wrapperClassName="catalog-table-wrap"
                tableClassName="catalog-table"
              />
            )}
          </>
        )}
      </div>
      <CreateContestModal
        open={showCreateContestModal}
        onClose={() => setShowCreateContestModal(false)}
        onCreate={() => void onCreateContest()}
        isSaving={isCreatingContest}
        tournaments={contestTournamentOptions.map((item) => ({
          id: item.value,
          name: item.label,
        }))}
        form={{
          ...createContestForm,
          tournamentId: selectedContestTournamentId,
        }}
        onChangeForm={(nextForm) =>
          setCreateContestForm({
            name: nextForm.name || '',
            teams: nextForm.teams || '',
            startAt: nextForm.startAt || '',
          })
        }
        matchOptions={createContestMatchOptions}
        selectedMatchIds={createContestMatchIds}
        onChangeSelectedMatchIds={setCreateContestMatchIds}
        lockedTournamentId={selectedContestTournamentId}
      />
      <Modal
        open={Boolean(editContest)}
        onClose={closeContestEditModal}
        title={`Edit contest${editContest?.name ? ` • ${editContest.name}` : ''}`}
        size="md"
        footer={
          <>
            <Button
              variant="danger"
              size="small"
              disabled={!canRemoveContests || isSavingContestEdit || !editContest?.id}
              onClick={() =>
                setRemovalTarget({
                  type: 'contest',
                  id: editContest.id,
                  name: editContest.name,
                })
              }
            >
              Remove contest
            </Button>
            <Button variant="ghost" size="small" onClick={closeContestEditModal}>
              Cancel
            </Button>
            <Button
              variant="primary"
              size="small"
              disabled={
                isSavingContestEdit ||
                isLoadingContestParticipants ||
                !editContestForm.name.trim() ||
                Number(editContestForm.teams || 0) < 2 ||
                Number(editContestForm.teams || 0) < editContestParticipantIds.length
              }
              onClick={() => void onSaveContestEdit()}
            >
              {isSavingContestEdit ? 'Saving...' : 'Save'}
            </Button>
          </>
        }
      >
        <div className="create-contest-form">
          <label className="create-contest-field">
            <span>Contest name</span>
            <input
              className="create-contest-input"
              type="text"
              value={editContestForm.name}
              onChange={(event) =>
                setEditContestForm((prev) => ({ ...prev, name: event.target.value }))
              }
            />
          </label>
          <label className="create-contest-field">
            <span>Max participants</span>
            <input
              className="create-contest-input"
              type="number"
              min="2"
              value={editContestForm.teams}
              onChange={(event) =>
                setEditContestForm((prev) => ({ ...prev, teams: event.target.value }))
              }
            />
            {Number(editContestForm.teams || 0) < editContestParticipantIds.length ? (
              <small className="error-text">
                Max participants cannot be less than selected participants.
              </small>
            ) : null}
          </label>
          <label className="create-contest-field">
            <span>Starts at</span>
            <input
              className="create-contest-input"
              type="datetime-local"
              value={editContestForm.startAt}
              onChange={(event) =>
                setEditContestForm((prev) => ({ ...prev, startAt: event.target.value }))
              }
            />
            <small className="team-note">
              Leave empty to keep this contest on manual start.
            </small>
          </label>
          <div className="create-contest-field">
            <span>Add participant</span>
            <div className="top-actions">
              <SearchableSelect
                value={editContestAddUserId}
                disabled={isSavingContestEdit}
                onChange={setEditContestAddUserId}
                options={addableParticipantOptions}
                placeholder="Search user name"
              />
              <Button
                variant="primary"
                size="small"
                disabled={!editContestAddUserId || isSavingContestEdit}
                onClick={() => {
                  const option = addableParticipantOptions.find(
                    (item) => String(item.value) === String(editContestAddUserId),
                  )
                  setPendingParticipantAction({
                    type: 'add',
                    userId: editContestAddUserId,
                    label: option?.label || editContestAddUserId,
                  })
                }}
              >
                Add
              </Button>
            </div>
          </div>
          {isLoadingContestParticipants ? (
            <p className="team-note">Loading participants...</p>
          ) : (
            <StickyTable
              columns={participantColumns}
              rows={editParticipantRows}
              rowKey={(row) => row.id}
              emptyText="No participants selected"
              wrapperClassName="catalog-table-wrap"
              tableClassName="catalog-table"
            />
          )}
        </div>
      </Modal>
      <Modal
        open={Boolean(pendingParticipantAction)}
        onClose={() => setPendingParticipantAction(null)}
        title={
          pendingParticipantAction?.type === 'add'
            ? 'Add participant'
            : 'Remove participant'
        }
        size="sm"
        footer={
          <>
            <Button
              variant="ghost"
              size="small"
              onClick={() => setPendingParticipantAction(null)}
            >
              Cancel
            </Button>
            <Button
              variant={pendingParticipantAction?.type === 'remove' ? 'danger' : 'primary'}
              size="small"
              onClick={applyPendingParticipantAction}
            >
              {pendingParticipantAction?.type === 'add' ? 'Add' : 'Remove'}
            </Button>
          </>
        }
      >
        <p className="team-note">
          {pendingParticipantAction?.type === 'add'
            ? `Add ${pendingParticipantAction?.label || 'this user'} to this contest?`
            : `Remove ${pendingParticipantAction?.label || 'this user'} from this contest?`}
        </p>
        <p className="team-note">
          This updates the draft only. Click Save in the edit contest modal to apply it.
        </p>
      </Modal>
      <Modal
        open={showCreateTournamentModal}
        onClose={() => setShowCreateTournamentModal(false)}
        title="Create tournament"
        size="md"
        footer={
          <>
            <Button
              variant="ghost"
              size="small"
              onClick={() => setShowCreateTournamentModal(false)}
            >
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
            <JsonTextareaField
              wrapperClassName="create-contest-field"
              label="JSON payload"
              rows={12}
              value={createTournamentJson}
              onChange={(event) => setCreateTournamentJson(event.target.value)}
              placeholder='{"name":"New Cup","season":"2026","matches":[{"matchNo":1,"home":"IND","away":"AUS","date":"2026-03-10","startAt":"2026-03-10T14:00:00.000Z"}]}'
              onClear={() => setCreateTournamentJson('')}
              clearDisabled={!createTournamentJson.trim()}
            />
          ) : (
            <>
              <label className="create-contest-field">
                <span>Tournament name</span>
                <input
                  type="text"
                  value={createTournamentForm.name}
                  onChange={(event) =>
                    setCreateTournamentForm((prev) => ({
                      ...prev,
                      name: event.target.value,
                    }))
                  }
                />
              </label>
              <label className="create-contest-field">
                <span>Season</span>
                <input
                  type="text"
                  value={createTournamentForm.season}
                  onChange={(event) =>
                    setCreateTournamentForm((prev) => ({
                      ...prev,
                      season: event.target.value,
                    }))
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
                            i === index
                              ? { ...item, matchNo: Number(event.target.value || i + 1) }
                              : item,
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
        open={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        title="Delete user"
        size="sm"
        footer={
          <>
            <Button variant="ghost" size="small" onClick={() => setDeleteTarget(null)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              size="small"
              onClick={() => void confirmDeleteTarget()}
            >
              Delete
            </Button>
          </>
        }
      >
        <p className="team-note">{deleteTarget?.detail || ''}</p>
      </Modal>
      <ResourceRemovalModal
        key={`resource-remove-${removalTarget?.type || 'none'}-${removalTarget?.id || 'none'}`}
        open={Boolean(removalTarget)}
        resourceId={removalTarget?.id || ''}
        resourceName={removalTarget?.name || ''}
        resourceLabel={removalTarget?.type === 'contest' ? 'contest' : 'tournament'}
        impactLabel={
          removalTarget?.type === 'contest' ? 'contest impact' : 'tournament impact'
        }
        impactRows={
          removalTarget?.type === 'contest'
            ? [
                { key: 'matchCount', label: 'Matches' },
                { key: 'joinedCount', label: 'Participants' },
                { key: 'teamSelectionsCount', label: 'Team selections' },
                { key: 'fixedRostersCount', label: 'Fixed rosters' },
                { key: 'contestScoresCount', label: 'Contest scores' },
              ]
            : [
                { key: 'matchCount', label: 'Matches' },
                { key: 'contestCount', label: 'Contests' },
                { key: 'scoreRowsCount', label: 'Score rows' },
                { key: 'lineupsCount', label: 'Lineups' },
              ]
        }
        loadPreview={
          removalTarget?.type === 'contest'
            ? fetchContestRemovalPreview
            : fetchTournamentRemovalPreview
        }
        isSubmitting={isRemovingResource}
        onClose={() => setRemovalTarget(null)}
        onConfirm={async () => {
          if (!removalTarget?.id) return
          try {
            setIsRemovingResource(true)
            if (removalTarget.type === 'contest') {
              await onRemoveContest(removalTarget.id)
            } else {
              await onDeleteTournament(removalTarget.id)
            }
            setRemovalTarget(null)
          } finally {
            setIsRemovingResource(false)
          }
        }}
      />
    </section>
  )
}

export default AdminManagerPanel
