const getDisplayName = (value = {}) =>
  (value.gameName || value.displayName || value.name || value.userId || value.id || '')
    .toString()
    .trim()

export { getDisplayName }
