import { createContext, useMemo, useSyncExternalStore } from 'react'
import {
  ENABLE_APP_QUERY_CACHE,
  clearAllAppQueryCache,
  getAppQueryCacheSnapshot,
  invalidateAppQueryCache,
  subscribeAppQueryCache,
} from '../lib/appQueryCache.js'

const AppQueryCacheContext = createContext({
  enabled: ENABLE_APP_QUERY_CACHE,
  clearAll: clearAllAppQueryCache,
  invalidate: invalidateAppQueryCache,
  snapshot: getAppQueryCacheSnapshot(),
})

function AppQueryCacheProvider({ children }) {
  const snapshot = useSyncExternalStore(
    subscribeAppQueryCache,
    getAppQueryCacheSnapshot,
    getAppQueryCacheSnapshot,
  )

  const value = useMemo(
    () => ({
      enabled: ENABLE_APP_QUERY_CACHE,
      clearAll: clearAllAppQueryCache,
      invalidate: invalidateAppQueryCache,
      snapshot,
    }),
    [snapshot],
  )

  return (
    <AppQueryCacheContext.Provider value={value}>{children}</AppQueryCacheContext.Provider>
  )
}

export { AppQueryCacheContext, AppQueryCacheProvider }
