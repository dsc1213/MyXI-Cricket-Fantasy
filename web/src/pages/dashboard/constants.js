const regularMenuItems = [
  { key: 'joined', label: 'Dashboard' },
  { key: 'points', label: 'Scoring Rules' },
  { key: 'players', label: 'Player Manager' },
]

const adminMenuItems = [
  { key: 'tournamentManager', label: 'Tournament Manager' },
  { key: 'contestManager', label: 'Contest Manager' },
  { key: 'squads', label: 'Squad Manager' },
  { key: 'upload', label: 'Score Manager' },
  { key: 'audit', label: 'Audit Logs' },
]
const masterMenuItems = [{ key: 'userManager', label: 'User Manager' }]

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
