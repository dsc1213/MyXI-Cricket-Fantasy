import { createContext, useContext, useMemo, useState } from 'react'

const defaultCacheState = {
  tournaments: [],
  allContests: [],
  matchesByTournament: {},
  teamPoolByMatch: {},
  savedScoresByMatch: {},
  playingXiByMatch: {},
  generatedScoreJsonByMatch: {},
}

const ScoreManagerCacheContext = createContext({
  cache: defaultCacheState,
  setCache: () => {},
})

function ScoreManagerCacheProvider({ children }) {
  const [cache, setCache] = useState(defaultCacheState)

  const value = useMemo(
    () => ({
      cache,
      setCache,
    }),
    [cache],
  )

  return (
    <ScoreManagerCacheContext.Provider value={value}>
      {children}
    </ScoreManagerCacheContext.Provider>
  )
}

const useScoreManagerCache = () => useContext(ScoreManagerCacheContext)

export { ScoreManagerCacheProvider, useScoreManagerCache }
