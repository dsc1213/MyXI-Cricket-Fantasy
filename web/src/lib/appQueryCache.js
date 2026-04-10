const ENABLE_APP_QUERY_CACHE =
  (import.meta.env?.VITE_ENABLE_APP_QUERY_CACHE || 'true').toString().trim().toLowerCase() !==
  'false'

const entries = new Map()
const listeners = new Set()
let snapshot = {
  enabled: ENABLE_APP_QUERY_CACHE,
  size: 0,
  entries: [],
}

const rebuildSnapshot = () => {
  snapshot = {
    enabled: ENABLE_APP_QUERY_CACHE,
    size: entries.size,
    entries: Array.from(entries.values()).map(cloneEntry).filter(Boolean),
  }
}

const notify = () => {
  listeners.forEach((listener) => {
    try {
      listener()
    } catch {
      // Listener failures should not break cache behavior.
    }
  })
}

const cloneEntry = (entry) => {
  if (!entry) return null
  return {
    key: entry.key,
    status: entry.status,
    data: entry.data,
    error: entry.error,
    updatedAt: entry.updatedAt,
    hasPromise: Boolean(entry.promise),
  }
}

const getSnapshot = () => snapshot

const subscribe = (listener) => {
  if (typeof listener !== 'function') return () => {}
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

const getEntry = (key) => entries.get(key) || null

const setEntry = (key, patch) => {
  const current = getEntry(key) || {
    key,
    status: 'idle',
    data: null,
    error: null,
    updatedAt: 0,
    promise: null,
  }
  const next = { ...current, ...patch, key }
  entries.set(key, next)
  rebuildSnapshot()
  notify()
  return next
}

const clearAllAppQueryCache = () => {
  if (!entries.size) return
  entries.clear()
  rebuildSnapshot()
  notify()
}

const invalidateAppQueryCache = (matcher) => {
  if (!entries.size) return
  const keysToDelete = []
  if (typeof matcher === 'function') {
    for (const key of entries.keys()) {
      if (matcher(key)) keysToDelete.push(key)
    }
  } else if (Array.isArray(matcher)) {
    matcher.forEach((key) => {
      if (entries.has(key)) keysToDelete.push(key)
    })
  } else if (typeof matcher === 'string') {
    for (const key of entries.keys()) {
      if (key === matcher || key.startsWith(`${matcher}:`)) keysToDelete.push(key)
    }
  }
  if (!keysToDelete.length) return
  keysToDelete.forEach((key) => entries.delete(key))
  rebuildSnapshot()
  notify()
}

const fetchCachedQuery = async ({ key, loader, enabled = ENABLE_APP_QUERY_CACHE }) => {
  if (!enabled || !key) return loader()

  const existing = getEntry(key)
  if (existing?.status === 'success') return existing.data
  if (existing?.promise) return existing.promise

  setEntry(key, { status: 'loading', error: null })
  const pending = Promise.resolve()
    .then(loader)
    .then((data) => {
      setEntry(key, {
        status: 'success',
        data,
        error: null,
        updatedAt: Date.now(),
        promise: null,
      })
      return data
    })
    .catch((error) => {
      setEntry(key, {
        status: 'error',
        error,
        promise: null,
      })
      throw error
    })

  setEntry(key, { promise: pending })
  return pending
}

export {
  ENABLE_APP_QUERY_CACHE,
  clearAllAppQueryCache,
  fetchCachedQuery,
  getEntry as getAppQueryCacheEntry,
  getSnapshot as getAppQueryCacheSnapshot,
  invalidateAppQueryCache,
  subscribe as subscribeAppQueryCache,
}
