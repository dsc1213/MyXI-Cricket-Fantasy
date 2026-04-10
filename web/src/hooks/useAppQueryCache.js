import { useContext } from 'react'
import { AppQueryCacheContext } from '../contexts/AppQueryCacheContext.jsx'

const useAppQueryCache = () => useContext(AppQueryCacheContext)

export default useAppQueryCache
