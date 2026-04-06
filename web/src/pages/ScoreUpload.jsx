import { useEffect, useState } from 'react'
import { fetchMatchOptions } from '../lib/api.js'

function ScoreUpload() {
  const [matchOptions, setMatchOptions] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [errorText, setErrorText] = useState('')

  useEffect(() => {
    let active = true
    const load = async () => {
      try {
        setIsLoading(true)
        setErrorText('')
        const data = await fetchMatchOptions()
        if (!active) return
        setMatchOptions(data || [])
      } catch (error) {
        if (!active) return
        setErrorText(error.message || 'Failed to load matches')
      } finally {
        if (active) {
          setIsLoading(false)
        }
      }
    }
    load()
    return () => {
      active = false
    }
  }, [])

  return (
    <section className="admin">
      <div className="admin-header">
        <div>
          <p className="eyebrow">Admin</p>
          <h2>Match score upload</h2>
          <p className="lead">Upload JSON to update points and leaderboard.</p>
          {isLoading && <p className="team-note">Loading...</p>}
          {!!errorText && <p className="error-text">{errorText}</p>}
        </div>
        <button type="button" className="cta">
          Upload
        </button>
      </div>
      <div className="admin-grid">
        <div className="admin-card admin-side-note">
          <label>
            Match
            <select>
              {matchOptions.map((item) => (
                <option key={item.id}>{item.label}</option>
              ))}
            </select>
          </label>
          <label>
            JSON payload
            <textarea
              rows="10"
              placeholder='{"playerStats":[{"playerId":"p1","runs":30,"wickets":2}]}'
            />
          </label>
        </div>
        <div className="admin-card">
          <h3>Example format</h3>
          <pre>{`{
  "playerStats": [
    {
      "playerId": "p1",
      "runs": 30,
      "wickets": 2,
      "catches": 1,
      "fours": 4,
      "sixes": 1
    }
  ]
}`}</pre>
        </div>
      </div>
    </section>
  )
}

export default ScoreUpload
