import { scoringRules } from './store.js'

const canManageUser = (currentUser, targetUser) => {
  if (!currentUser || !targetUser) return false
  if (currentUser.role === 'master_admin') return true
  if (currentUser.role === 'admin') {
    return targetUser.role !== 'master_admin'
  }
  return currentUser.id === targetUser.id
}

const getRulesForTournament = (tournamentId) => {
  const existing = scoringRules.find((r) => r.tournamentId === tournamentId)
  if (existing) return existing.rules
  return {
    run: 1,
    wicket: 20,
    catch: 10,
    four: 1,
    six: 2,
  }
}

const calculatePoints = (stats, rules) => {
  const runs = (stats.runs || 0) * (rules.run || 0)
  const wickets = (stats.wickets || 0) * (rules.wicket || 0)
  const catches = (stats.catches || 0) * (rules.catch || 0)
  const fours = (stats.fours || 0) * (rules.four || 0)
  const sixes = (stats.sixes || 0) * (rules.six || 0)
  return runs + wickets + catches + fours + sixes
}

export { canManageUser, getRulesForTournament, calculatePoints }
