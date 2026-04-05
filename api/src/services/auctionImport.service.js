import bcrypt from 'bcryptjs'
import { createRepositoryFactory } from '../repositories/repository.factory.js'
import { dbQuery } from '../db.js'

const factory = createRepositoryFactory()

const slugify = (value = '') =>
  value
    .toString()
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')

const normalizeName = (value = '') =>
  value
    .toString()
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

const buildImportedUserShape = (entry = {}, contestName = '') => {
  const explicitUserId = (entry.userId || '').toString().trim()
  const explicitGameName = (entry.gameName || '').toString().trim()
  const explicitName = (entry.name || explicitGameName || explicitUserId || '').toString().trim()
  const baseSlug = slugify(explicitUserId || explicitGameName || explicitName || 'auction-user')
  return {
    name: explicitName || explicitGameName || explicitUserId || baseSlug,
    userId: explicitUserId || baseSlug,
    gameName: explicitGameName || explicitUserId || explicitName || baseSlug,
    email: `${baseSlug || 'auction-user'}+${slugify(contestName || 'contest') || 'contest'}@import.myxi.local`,
  }
}

const findExistingUser = async (repo, entry) => {
  const candidates = [
    (entry.userId || '').toString().trim(),
    (entry.gameName || '').toString().trim(),
    (entry.name || '').toString().trim(),
  ].filter(Boolean)
  for (const candidate of candidates) {
    const found = await repo.findByIdentifier(candidate)
    if (found) return found
  }
  return null
}

const findOrCreateImportedUser = async (repo, entry, contestName) => {
  const existing = await findExistingUser(repo, entry)
  if (existing) return existing
  const normalized = buildImportedUserShape(entry, contestName)
  const passwordHash = bcrypt.hashSync(`auction-import-${normalized.userId}-${Date.now()}`, 10)
  return await repo.createUser({
    ...normalized,
    location: '',
    phone: '',
    passwordHash,
    role: 'user',
    status: 'active',
    securityAnswers: ['auction', 'import', 'readonly'],
  })
}

const buildPlayerLookup = (players = [], allowedTeams = []) => {
  const allowed = new Set((allowedTeams || []).map((item) => item.toString().trim().toUpperCase()))
  const lookup = new Map()
  for (const player of players) {
    const teamKey = (player.teamKey || player.team || '').toString().trim().toUpperCase()
    if (allowed.size && teamKey && !allowed.has(teamKey)) continue
    const name =
      player.displayName ||
      player.name ||
      [player.firstName, player.lastName].filter(Boolean).join(' ').trim()
    const key = normalizeName(name)
    if (!key || lookup.has(key)) continue
    lookup.set(key, player)
  }
  return lookup
}

const normalizeParticipantRows = (payload = {}) => {
  const raw = Array.isArray(payload.participants) ? payload.participants : []
  return raw
    .map((entry) => ({
      userId: (entry?.userId || '').toString().trim(),
      gameName: (entry?.gameName || '').toString().trim(),
      name: (entry?.name || '').toString().trim(),
      roster: Array.isArray(entry?.roster)
        ? entry.roster.map((item) => item?.toString?.().trim?.() || '').filter(Boolean)
        : [],
    }))
    .filter((entry) => entry.name || entry.userId || entry.gameName)
}

class AuctionImportService {
  async resolveTournament(payload = {}) {
    const tournamentRepo = await factory.getTournamentRepository()
    const explicitTournamentId = (payload.tournamentId || '').toString().trim()
    if (!explicitTournamentId) return null
    if (/^\d+$/.test(explicitTournamentId)) {
      return await tournamentRepo.findById(Number(explicitTournamentId))
    }
    if (typeof tournamentRepo.findBySourceKey === 'function') {
      const bySourceKey = await tournamentRepo.findBySourceKey(explicitTournamentId)
      if (bySourceKey) return bySourceKey
    }
    return null
  }

  async importAuctionContest(payload = {}) {
    const tournamentId = (payload.tournamentId || '').toString().trim()
    const contestName = (payload.contestName || payload.name || '').toString().trim()
    if (!tournamentId || !contestName) {
      const error = new Error('tournamentId and contestName are required')
      error.statusCode = 400
      throw error
    }

    const participants = normalizeParticipantRows(payload)
    if (!participants.length) {
      const error = new Error('At least one participant is required')
      error.statusCode = 400
      throw error
    }
    for (let index = 0; index < participants.length; index += 1) {
      const participant = participants[index]
      if (!participant.roster.length) {
        const error = new Error(`participants[${index}].roster must contain at least one player`)
        error.statusCode = 400
        throw error
      }
    }

    const tournamentRepo = await factory.getTournamentRepository()
    const contestRepo = await factory.getContestRepository()
    const matchRepo = await factory.getMatchRepository()
    const playerRepo = await factory.getPlayerRepository()
    const userRepo = await factory.getUserRepository()

    const tournament = await this.resolveTournament(payload)
    if (!tournament) {
      const error = new Error('Tournament not found')
      error.statusCode = 404
      throw error
    }
    const resolvedTournamentId = Number(tournament.id)

    const existingContests = await contestRepo.findByTournament(resolvedTournamentId)
    const duplicate = (existingContests || []).find(
      (row) => (row.name || '').toString().trim().toLowerCase() === contestName.toLowerCase(),
    )
    if (duplicate) {
      const error = new Error(`Auction contest already exists: ${contestName}`)
      error.statusCode = 409
      throw error
    }

    const matches = await matchRepo.findByTournament(resolvedTournamentId)
    const matchIds = (matches || []).map((row) => row.id)
    if (!matchIds.length) {
      const error = new Error('Tournament has no matches')
      error.statusCode = 400
      throw error
    }

    const players =
      typeof playerRepo.findByTournament === 'function'
        ? await playerRepo.findByTournament(resolvedTournamentId)
        : await playerRepo.findAll()
    const selectedTeams =
      Array.isArray(tournament.selectedTeams) && tournament.selectedTeams.length
        ? tournament.selectedTeams
        : []
    const playerLookup = buildPlayerLookup(players, selectedTeams)

    const resolvedParticipants = []
    const missingNames = new Set()

    for (const participant of participants) {
      const user = await findOrCreateImportedUser(userRepo, participant, contestName)
      const playerIds = []
      for (const rosterName of participant.roster) {
        const matched = playerLookup.get(normalizeName(rosterName))
        if (!matched?.id) {
          missingNames.add(rosterName)
          continue
        }
        playerIds.push(Number(matched.id))
      }
      resolvedParticipants.push({
        participant,
        user,
        playerIds: [...new Set(playerIds)],
      })
    }

    if (missingNames.size) {
      const error = new Error(
        `Some roster players were not found in the tournament player pool: ${Array.from(missingNames)
          .slice(0, 12)
          .join(', ')}`,
      )
      error.statusCode = 400
      throw error
    }

    const createdContest = await contestRepo.create({
      tournamentId: resolvedTournamentId,
      name: contestName,
      matchIds,
      prizeStructure: {},
      game: 'Fantasy',
      mode: 'fixed_roster',
      sourceKey: slugify(`${tournament.sourceKey || resolvedTournamentId}-${contestName}`),
      status: payload.status || 'Starting Soon',
      entryFee: 0,
      maxParticipants: resolvedParticipants.length,
    })

    for (const row of resolvedParticipants) {
      await dbQuery(
        `INSERT INTO contest_fixed_rosters (contest_id, user_id, player_ids, created_at, updated_at)
         VALUES ($1, $2, $3, now(), now())`,
        [createdContest.id, row.user.id, row.playerIds],
      )
    }

    await contestRepo.update(createdContest.id, {
      maxParticipants: resolvedParticipants.length,
    })

    return {
      ok: true,
      contest: createdContest,
      participantsImported: resolvedParticipants.length,
      rosterCount: resolvedParticipants.reduce((sum, row) => sum + row.playerIds.length, 0),
    }
  }
}

export default new AuctionImportService()
