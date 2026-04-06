import { useEffect, useState, forwardRef, useImperativeHandle } from 'react'

const ApiStatusDot = forwardRef(function ApiStatusDot(
  {
    apiBase = '',
    checkUrl = '/health',
    interval = 0,
    className = '',
    style = {},
    onStatus,
  },
  ref,
) {
  const [status, setStatus] = useState('pending') // 'ok', 'fail', 'pending'

  const checkHealth = async () => {
    setStatus('pending')
    try {
      const res = await fetch(`${apiBase}${checkUrl}`, {
        method: 'GET',
        credentials: 'omit',
      })
      if (res.ok) {
        setStatus('ok')
        onStatus?.('ok')
      } else {
        setStatus('fail')
        onStatus?.('fail')
      }
    } catch {
      setStatus('fail')
      onStatus?.('fail')
    }
  }

  useImperativeHandle(ref, () => ({ checkHealth }), [apiBase, checkUrl])

  useEffect(() => {
    checkHealth()
    if (interval > 0) {
      const id = setInterval(checkHealth, interval)
      return () => clearInterval(id)
    }
    // eslint-disable-next-line
  }, [apiBase, checkUrl, interval])

  const color = status === 'ok' ? '#2ecc40' : status === 'fail' ? '#ff4136' : '#ffdc00'
  const tooltip =
    status === 'ok'
      ? 'API connected'
      : status === 'fail'
        ? 'API unavailable'
        : 'Checking API...'

  return (
    <span
      className={`api-status-dot ${status} ${className}`.trim()}
      title={tooltip}
      style={{
        display: 'inline-block',
        width: 14,
        height: 14,
        borderRadius: '50%',
        background: color,
        border: '1.5px solid #888',
        marginRight: 8,
        verticalAlign: 'middle',
        ...style,
      }}
      tabIndex={0}
      aria-label={tooltip}
    />
  )
})

export default ApiStatusDot
