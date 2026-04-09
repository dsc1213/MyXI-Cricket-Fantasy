import { useCallback, useEffect, useRef, useState } from 'react'

function useApiHealthStatus({
  autoRetry = false,
  retryIntervalMs = 30000,
  maxRetries = 10,
  checkDurationMs = 800,
  initialCheck = true,
} = {}) {
  const [apiStatus, setApiStatusState] = useState('pending')
  const [checkingApi, setCheckingApi] = useState(false)
  const [reconnectAttempt, setReconnectAttempt] = useState(0)
  const apiDotRef = useRef(null)
  const reconnectTimerRef = useRef(null)

  const clearReconnectTimer = useCallback(() => {
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current)
      reconnectTimerRef.current = null
    }
  }, [])

  const setApiStatus = useCallback(
    (nextStatus) => {
      setApiStatusState(nextStatus)
      if (nextStatus === 'ok') {
        clearReconnectTimer()
        setReconnectAttempt(0)
      }
    },
    [clearReconnectTimer],
  )

  const checkApi = useCallback(
    (isAutoRetry = false) => {
      setCheckingApi(true)
      if (!isAutoRetry) setReconnectAttempt(0)
      if (apiDotRef.current) apiDotRef.current.checkHealth()
      setTimeout(() => setCheckingApi(false), checkDurationMs)
    },
    [checkDurationMs],
  )

  useEffect(() => {
    if (!autoRetry || apiStatus !== 'fail' || reconnectAttempt >= maxRetries) {
      clearReconnectTimer()
      return undefined
    }

    reconnectTimerRef.current = setTimeout(() => {
      setReconnectAttempt((attempt) => attempt + 1)
      checkApi(true)
    }, retryIntervalMs)

    return clearReconnectTimer
  }, [
    apiStatus,
    reconnectAttempt,
    autoRetry,
    maxRetries,
    retryIntervalMs,
    clearReconnectTimer,
    checkApi,
  ])

  useEffect(() => {
    if (!initialCheck) return undefined
    const id = setTimeout(() => {
      if (apiDotRef.current) apiDotRef.current.checkHealth()
    }, 0)
    return () => {
      clearTimeout(id)
      clearReconnectTimer()
    }
  }, [initialCheck, clearReconnectTimer])

  const showApiError = apiStatus === 'fail'

  return {
    apiStatus,
    setApiStatus,
    apiDotRef,
    showApiError,
    checkingApi,
    reconnectAttempt,
    maxRetries,
    checkApi,
  }
}

export default useApiHealthStatus
