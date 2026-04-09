const SMART_DOUBLE_QUOTES_REGEX = /[\u201C\u201D\u201E\u201F\u2033\u2036\uFF02]/g
const SMART_SINGLE_QUOTES_REGEX = /[\u2018\u2019\u201A\u201B\u2032\u2035\uFF07]/g
// Strip invisible formatting chars that frequently appear in AI/copied text.
const INVISIBLE_FORMAT_REGEX =
  /[\u00AD\u034F\u061C\u17B4\u17B5\u180E\u200B\u200C\u200D\u200E\u200F\u202A\u202B\u202C\u202D\u202E\u2060\u2061\u2062\u2063\u2064\u2065\u2066\u2067\u2068\u2069\u206A\u206B\u206C\u206D\u206E\u206F\uFEFF]/g
const FENCED_JSON_REGEX = /```(?:json)?\s*([\s\S]*?)\s*```/i

const trimToLikelyJson = (value = '') => {
  const text = String(value || '').trim()
  if (!text) return '{}'

  const firstObjectIndex = text.indexOf('{')
  const firstArrayIndex = text.indexOf('[')
  const starts = [firstObjectIndex, firstArrayIndex].filter((index) => index >= 0)
  if (!starts.length) return text

  const start = Math.min(...starts)
  const startsWithObject = text[start] === '{'
  const end = startsWithObject ? text.lastIndexOf('}') : text.lastIndexOf(']')
  if (end <= start) return text
  return text.slice(start, end + 1).trim()
}

export const normalizeJsonInputText = (value = '') => {
  let normalized = String(value || '')
    .replace(INVISIBLE_FORMAT_REGEX, '')
    .replace(SMART_DOUBLE_QUOTES_REGEX, '"')
    .replace(SMART_SINGLE_QUOTES_REGEX, "'")
    .trim()

  const fencedMatch = normalized.match(FENCED_JSON_REGEX)
  if (fencedMatch?.[1]) {
    normalized = fencedMatch[1].trim()
  } else {
    normalized = trimToLikelyJson(normalized)
  }

  return normalized || '{}'
}

export const parseNormalizedJsonInput = (value = '') => {
  const normalizedText = normalizeJsonInputText(value)
  return {
    normalizedText,
    parsed: JSON.parse(normalizedText || '{}'),
  }
}
