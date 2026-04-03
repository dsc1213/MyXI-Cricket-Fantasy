const regularMenuItems = [
  { key: 'joined', label: 'Dashboard' },
  { key: 'points', label: 'Scoring Rules' },
]

const adminMenuItems = [
  { key: 'createTournament', label: 'Create Tournament' },
  { key: 'players', label: 'Player Manager' },
  { key: 'squads', label: 'Squad Manager' },
  { key: 'admin', label: 'Admin Manager' },
  { key: 'upload', label: 'Score Updates' },
  { key: 'audit', label: 'Audit Logs' },
]
const masterMenuItems = [{ key: 'approvals', label: 'Pending Approvals' }]

const menuItems = [...regularMenuItems, ...adminMenuItems]

const gameClassMap = {
  Fantasy: 'fantasy',
  Draft: 'drafts',
  "Pick'em": 'pickem',
}

const sectionTitles = {
  joined: 'Dashboard',
  points: 'Scoring Rules',
  admin: 'Admin Manager',
  createTournament: 'Create Tournament',
  players: 'Player Manager',
  squads: 'Squad Manager',
  upload: 'Score Updates',
  audit: 'Audit Logs',
  approvals: 'Pending Approvals',
}

export {
  menuItems,
  regularMenuItems,
  adminMenuItems,
  masterMenuItems,
  gameClassMap,
  sectionTitles,
}
