import { CountryText } from '../ui/CountryFlag.jsx'

function PlayerLabel({ player, className = '' }) {
  const countryValue = player.country || player.nationality || player.team
  return (
    <div className={`player-chip slot-chip compact ${className}`.trim()}>
      <span>
        {player.name} ({player.role})
      </span>
      <small>
        <CountryText value={countryValue} />
      </small>
    </div>
  )
}

export default PlayerLabel
