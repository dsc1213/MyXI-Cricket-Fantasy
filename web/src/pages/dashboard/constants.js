const regularMenuItems = [
  { key: 'joined', label: 'Dashboard' },
  { key: 'points', label: 'Scoring Rules' },
  { key: 'players', label: 'Player Manager' },
]

const adminMenuItems = [
  { key: 'tournamentManager', label: 'Tournament Manager' },
  { key: 'contestManager', label: 'Contest Manager' },
  { key: 'squads', label: 'Squad Manager' },
  { key: 'playingXiManager', label: 'Playing XI Manager' },
  { key: 'scoreManager', label: 'Score Manager' },
]
const masterMenuItems = [
  { key: 'userManager', label: 'User Manager' },
  { key: 'audit', label: 'Audit Logs' },
]

const menuItems = [...regularMenuItems, ...adminMenuItems]

const gameClassMap = {
  Fantasy: 'fantasy',
  Draft: 'drafts',
  "Pick'em": 'pickem',
}

const sectionTitles = {
  joined: 'Dashboard',
  points: 'Scoring Rules',
  userManager: 'User Manager',
  tournamentManager: 'Tournament Manager',
  contestManager: 'Contest Manager',
  players: 'Player Manager',
  squads: 'Squad Manager',
  upload: 'Score Manager',
  playingXiManager: 'Playing XI Manager',
  scoreManager: 'Score Manager',
  audit: 'Audit Logs',
  admin: 'User Manager',
  createTournament: 'Tournament Manager',
  approvals: 'User Manager',
}

export {
  menuItems,
  regularMenuItems,
  adminMenuItems,
  masterMenuItems,
  gameClassMap,
  sectionTitles,
}
