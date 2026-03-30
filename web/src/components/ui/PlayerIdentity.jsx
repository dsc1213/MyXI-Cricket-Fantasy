import PlayerAvatar from './PlayerAvatar.jsx'

function PlayerIdentity({
  name = '',
  imageUrl = '',
  subtitle = '',
  className = '',
  size = 'sm',
  title = '',
  nameSuffix = null,
}) {
  return (
    <div className={`player-identity ${className}`.trim()} title={title || undefined}>
      <PlayerAvatar name={name} imageUrl={imageUrl} size={size} />
      <div className="player-identity-copy">
        <span className="player-identity-name">
          {name}
          {nameSuffix}
        </span>
        {!!subtitle && <small className="player-identity-subtitle">{subtitle}</small>}
      </div>
    </div>
  )
}

export default PlayerIdentity
