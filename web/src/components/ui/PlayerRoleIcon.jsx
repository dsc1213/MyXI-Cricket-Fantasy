const normalizeRole = (role = '') => {
  const value = role.toString().trim().toUpperCase()
  if (value.includes('WICKET') || value === 'WK') return 'WK'
  if (value.includes('ALL') || value === 'AR') return 'AR'
  if (value.includes('BOWL')) return 'BOWL'
  return 'BAT'
}

const ROLE_LABELS = {
  BAT: 'Batter',
  AR: 'All-rounder',
  WK: 'Wicketkeeper',
  BOWL: 'Bowler',
}

function BatterIcon() {
  return (
    <>
      <path
        className="role-icon-stroke role-icon-bat-wood"
        d="M5.3 15.2 12.8 7.7"
      />
      <path
        className="role-icon-stroke role-icon-bat-edge"
        d="M3.8 13.6 11.3 6.1"
      />
      <path className="role-icon-stroke role-icon-bat-handle" d="M12.2 6.8 15.7 3.3" />
    </>
  )
}

function AllRounderIcon() {
  return (
    <>
      <path
        className="role-icon-stroke role-icon-bat-wood"
        d="M4.8 14.8 11.7 7.9"
      />
      <path
        className="role-icon-stroke role-icon-bat-edge"
        d="M3.5 13.4 10.4 6.5"
      />
      <path className="role-icon-stroke role-icon-bat-handle" d="M11.1 7.1 15.6 2.6" />
      <circle className="role-icon-ball-red" cx="13.9" cy="13.1" r="3.2" />
      <path className="role-icon-stroke role-icon-ball-stripe" d="M12.3 10.5c1.3 1.3 2 2.8 2.2 4.8" />
    </>
  )
}

function WicketKeeperIcon() {
  return (
    <>
      <path className="role-icon-stroke role-icon-wicket" d="M8 4.2v8.9M11 4.2v8.9M14 4.2v8.9" />
      <path className="role-icon-stroke role-icon-bail" d="M7.2 4.1h7.6" />
      <path
        className="role-icon-glove-left"
        d="M4.7 10.2c-1.1.8-1.4 2.8-.5 4 .9 1.2 2.9 1.2 3.7.1.5-.7.4-1.6-.2-2.1l-2-2Z"
      />
      <path
        className="role-icon-glove-right"
        d="M16.7 10.2c1.1.8 1.4 2.8.5 4-.9 1.2-2.9 1.2-3.7.1-.5-.7-.4-1.6.2-2.1l2-2Z"
      />
    </>
  )
}

function BowlerIcon() {
  return (
    <>
      <circle className="role-icon-ball-red" cx="10" cy="10" r="6.8" />
      <path className="role-icon-stroke role-icon-ball-white-stripe" d="M6.3 4.6c3.2 2.2 5.1 5.3 5.9 9.4" />
      <path className="role-icon-stroke role-icon-ball-white-stripe" d="M8.1 3.8c3.3 2.4 5.4 5.6 6.1 9.8" />
    </>
  )
}

function PlayerRoleIcon({ role = '', className = '' }) {
  const normalizedRole = normalizeRole(role)
  const label = ROLE_LABELS[normalizedRole] || ROLE_LABELS.BAT

  return (
    <span
      className={`player-role-icon player-role-icon-${normalizedRole.toLowerCase()} ${className}`.trim()}
      title={label}
      aria-label={label}
      role="img"
    >
      <svg viewBox="0 0 20 20" aria-hidden="true" focusable="false">
        {normalizedRole === 'AR' ? <AllRounderIcon /> : null}
        {normalizedRole === 'WK' ? <WicketKeeperIcon /> : null}
        {normalizedRole === 'BOWL' ? <BowlerIcon /> : null}
        {normalizedRole === 'BAT' ? <BatterIcon /> : null}
      </svg>
    </span>
  )
}

export default PlayerRoleIcon
