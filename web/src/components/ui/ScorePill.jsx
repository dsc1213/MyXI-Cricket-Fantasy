const getPointToneClass = (value) =>
  Number(value || 0) < 0 ? 'is-negative' : 'is-positive'

function ScorePill({
  value = null,
  prefix = '',
  suffix = ' pts',
  tone = '',
  variant = '',
  className = '',
  style = undefined,
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
      style={style}
    >
      {label}
    </strong>
  )
}

export default ScorePill
