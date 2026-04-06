const COUNTRY_FLAG_MAP = {
  ind: '🇮🇳',
  india: '🇮🇳',
  pak: '🇵🇰',
  pakistan: '🇵🇰',
  aus: '🇦🇺',
  australia: '🇦🇺',
  eng: '🇬🇧',
  england: '🇬🇧',
  nz: '🇳🇿',
  'new zealand': '🇳🇿',
  sa: '🇿🇦',
  'south africa': '🇿🇦',
  sl: '🇱🇰',
  'sri lanka': '🇱🇰',
  usa: '🇺🇸',
  us: '🇺🇸',
  'united states': '🇺🇸',
  'united states of america': '🇺🇸',
  nam: '🇳🇦',
  namibia: '🇳🇦',
  ned: '🇳🇱',
  netherlands: '🇳🇱',
  ire: '🇮🇪',
  ireland: '🇮🇪',
  wi: '🇯🇲',
  'west indies': '🇯🇲',
  ban: '🇧🇩',
  bangladesh: '🇧🇩',
  afg: '🇦🇫',
  afghanistan: '🇦🇫',
  japan: '🇯🇵',
}

const normalizeCountryKey = (value = '') =>
  value
    .toString()
    .trim()
    .toLowerCase()
    .replace(/\./g, '')
    .replace(/\s+/g, ' ')

const getCountryFlag = (value = '') => COUNTRY_FLAG_MAP[normalizeCountryKey(value)] || ''

export { getCountryFlag }
