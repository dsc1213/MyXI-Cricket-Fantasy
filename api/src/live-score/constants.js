const DEFAULT_TEAM_ALIASES = {
  CSK: ['chennai super kings', 'chennai'],
  DC: ['delhi capitals', 'delhi'],
  GT: ['gujarat titans', 'gujarat'],
  KKR: ['kolkata knight riders', 'kolkata'],
  LSG: ['lucknow super giants', 'lucknow'],
  MI: ['mumbai indians', 'mumbai'],
  MINY: ['mi new york', 'new york'],
  PBKS: ['punjab kings', 'punjab'],
  RCB: ['royal challengers bengaluru', 'royal challengers bangalore', 'bengaluru'],
  RR: ['rajasthan royals', 'rajasthan'],
  SRH: ['sunrisers hyderabad', 'hyderabad'],
  LAKR: ['los angeles knight riders', 'los angeles'],
  SEA: ['seattle orcas', 'seattle'],
  SFU: ['san francisco unicorns', 'san francisco'],
  TSK: ['texas super kings', 'texas'],
  WF: ['washington freedom', 'washington'],
}

const parseLiveScoreTeamAliases = () => {
  if (!process.env.LIVE_SCORE_TEAM_ALIASES) return {}
  try {
    const parsed = JSON.parse(process.env.LIVE_SCORE_TEAM_ALIASES)
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {}
  } catch {
    return {}
  }
}

const getLiveScoreTeamAliases = () => ({
  ...DEFAULT_TEAM_ALIASES,
  ...parseLiveScoreTeamAliases(),
})

export { getLiveScoreTeamAliases }
