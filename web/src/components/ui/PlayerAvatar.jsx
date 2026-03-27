function normalizeInitials(value = '') {
  const words = value
    .toString()
    .trim()
    .split(/\s+/)
    .filter(Boolean)
  if (!words.length) return '?'
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase()
  return `${words[0][0] || ''}${words[words.length - 1][0] || ''}`.toUpperCase()
}

function PlayerAvatar({ name = '', imageUrl = '', size = 'sm' }) {
  const normalizedUrl = imageUrl.toString().trim()
  const hasImage = Boolean(normalizedUrl) && !normalizedUrl.endsWith('/icon512.png')
  return (
    <span className={`player-avatar ${size}`.trim()} aria-hidden="true">
      {hasImage ? (
        <img src={normalizedUrl} alt="" loading="lazy" />
      ) : (
        <span className="player-avatar-fallback">{normalizeInitials(name)}</span>
      )}
    </span>
  )
}

export default PlayerAvatar
