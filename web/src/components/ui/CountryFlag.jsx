import { getCountryFlag } from './countryFlagUtils.js'
import { getIplTeamStyle, resolveIplTeamCode } from '../../lib/iplTeamPalette.js'

function CountryText({ value, className = '' }) {
  const flag = getCountryFlag(value)
  const teamCode = resolveIplTeamCode(value)
  return (
    <span
      className={`country-text ${teamCode ? 'ipl-team-text' : ''} ${className}`.trim()}
      style={getIplTeamStyle(value)}
    >
      <span>{value}</span>
      {flag ? <span className="country-flag" aria-hidden="true">{flag}</span> : null}
    </span>
  )
}

function MatchLabel({ home, away, value }) {
  if (home && away) {
    return (
      <span className="match-country-label">
        <CountryText value={home} />
        <span className="match-country-sep">vs</span>
        <CountryText value={away} />
      </span>
    )
  }
  const text = (value || '').toString()
  const vsSplit = text.split(/\s+vs\s+/i)
  if (vsSplit.length === 2) {
    return (
      <span className="match-country-label">
        <CountryText value={vsSplit[0]} />
        <span className="match-country-sep">vs</span>
        <CountryText value={vsSplit[1]} />
      </span>
    )
  }
  return <CountryText value={text} />
}

export { CountryText, MatchLabel }
