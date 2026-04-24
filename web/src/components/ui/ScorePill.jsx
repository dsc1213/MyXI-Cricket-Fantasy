const getPointToneClass = (value) =>
  Number(value || 0) < 0 ? 'is-negative' : 'is-positive'

function ScorePill({
  value = null,
  prefix = '',
  suffix = ' pts',
  tone = '',
  variant = '',
  className = '',
  children = null,
}) {
  const toneClass =
    tone || (value != null && children == null ? getPointToneClass(value) : '')
  const label =
    children != null ? children : `${prefix}${Number(value || 0)}${suffix}`

  return (
    <strong
      className={['score-pill', toneClass, variant ? `score-pill-${variant}` : '', className]
        .filter(Boolean)
        .join(' ')}
    >
      {label}
    </strong>
  )
}

export default ScorePill
