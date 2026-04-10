// State builder functions extracted from Dashboard.jsx
import { cloneDefaultPointsRules } from '../../lib/defaultPointsRules.js'

export const defaultPointsRules = cloneDefaultPointsRules()

export const buildFallbackBootstrap = () => ({
  tournaments: [],
  joinedContests: [],
  pointsRuleTemplate: defaultPointsRules,
  adminManager: [],
  masterConsole: [],
  auditLogs: [],
})

export const buildDefaultManualStatsRow = () => ({
  runs: 0,
  ballsFaced: 0,
  fours: 0,
  sixes: 0,
  overs: 0,
  runsConceded: 0,
  wickets: 0,
  maidens: 0,
  noBalls: 0,
  wides: 0,
  catches: 0,
  stumpings: 0,
  runoutDirect: 0,
  runoutIndirect: 0,
  hatTrick: 0,
  dismissed: false,
})
