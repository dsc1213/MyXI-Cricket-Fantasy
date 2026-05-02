const IPL_TEAM_PALETTE = {
  CSK: {
    aliases: ['chennai super kings', 'chennai'],
    primary: '#facc15',
    accent: '#2563eb',
    lightText: '#ca8a04',
    darkText: '#fde68a',
  },
  MI: {
    aliases: ['mumbai indians', 'mumbai'],
    primary: '#1d4ed8',
    accent: '#d4af37',
    lightText: '#1e3a8a',
    darkText: '#93c5fd',
  },
  RCB: {
    aliases: ['royal challengers bengaluru', 'royal challengers bangalore', 'bengaluru'],
    primary: '#dc2626',
    accent: '#d4af37',
    lightText: '#b91c1c',
    darkText: '#fca5a5',
  },
  KKR: {
    aliases: ['kolkata knight riders', 'kolkata'],
    primary: '#4c1d95',
    accent: '#d4af37',
    lightText: '#5b21b6',
    darkText: '#c4b5fd',
  },
  SRH: {
    aliases: ['sunrisers hyderabad', 'hyderabad'],
    primary: '#f97316',
    accent: '#111827',
    lightText: '#c2410c',
    darkText: '#fdba74',
  },
  RR: {
    aliases: ['rajasthan royals', 'rajasthan'],
    primary: '#ec4899',
    accent: '#1e3a8a',
    lightText: '#be185d',
    darkText: '#f9a8d4',
  },
  DC: {
    aliases: ['delhi capitals', 'delhi'],
    primary: '#2563eb',
    accent: '#dc2626',
    lightText: '#1d4ed8',
    darkText: '#93c5fd',
  },
  GT: {
    aliases: ['gujarat titans', 'gujarat'],
    primary: '#0f172a',
    accent: '#d4af37',
    lightText: '#1e293b',
    darkText: '#cbd5e1',
  },
  LSG: {
    aliases: ['lucknow super giants', 'lucknow'],
    primary: '#dc2626',
    accent: '#0ea5e9',
    lightText: '#b91c1c',
    darkText: '#fca5a5',
  },
  PBKS: {
    aliases: ['punjab kings', 'punjab'],
    primary: '#b91c1c',
    accent: '#2563eb',
    lightText: '#991b1b',
    darkText: '#fca5a5',
  },
}

const normalizeTeamInput = (value = '') =>
  value
    .toString()
    .trim()
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

const resolveIplTeamCode = (value = '') => {
  const raw = value.toString().trim()
  const upper = raw.toUpperCase()
  if (IPL_TEAM_PALETTE[upper]) return upper
  const normalized = normalizeTeamInput(raw)
  return (
    Object.entries(IPL_TEAM_PALETTE).find(([code, config]) => {
      if (normalizeTeamInput(code) === normalized) return true
      return config.aliases.some((alias) => normalizeTeamInput(alias) === normalized)
    })?.[0] || ''
  )
}

const getIplTeamPalette = (value = '') => {
  const code = resolveIplTeamCode(value)
  if (!code) return null
  return { code, ...IPL_TEAM_PALETTE[code] }
}

const getIplTeamStyle = (value = '') => {
  const palette = getIplTeamPalette(value)
  if (!palette) return undefined
  return {
    '--ipl-team-primary': palette.primary,
    '--ipl-team-accent': palette.accent,
    '--ipl-team-text-light': palette.lightText,
    '--ipl-team-text-dark': palette.darkText,
    '--ipl-team-bg-light': `${palette.primary}1f`,
    '--ipl-team-bg-dark': `${palette.primary}33`,
    '--ipl-team-border-light': `${palette.primary}66`,
    '--ipl-team-border-dark': `${palette.primary}80`,
    '--myxi-team-rail': `linear-gradient(180deg, ${palette.primary} 0%, ${palette.accent} 100%)`,
  }
}

export { getIplTeamPalette, getIplTeamStyle, resolveIplTeamCode }
