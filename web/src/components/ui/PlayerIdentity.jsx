import PlayerAvatar from './PlayerAvatar.jsx'

function PlayerIdentity({
  name = '',
  imageUrl = '',
  subtitle = '',
  subtitleSuffix = null,
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
        {!!subtitle && (
          <small className="player-identity-subtitle">
            <span className="player-identity-role">{subtitle}</span>
            {subtitleSuffix}
          </small>
        )}
      </div>
    </div>
  )
}

export default PlayerIdentity
