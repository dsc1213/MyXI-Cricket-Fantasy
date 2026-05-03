import { cloneDefaultPointsRules } from '../lib/defaultPointsRules.js'

const sectionDescriptions = {
  batting: 'Runs, milestones, duck, and strike-rate slabs sourced from scorecard batting tables.',
  bowling: 'Wickets, maidens, wides/no-balls, and economy slabs sourced from bowling figures.',
  fielding: 'Catches, stumpings, and runout credits sourced from dismissal details only.',
}

const shouldShowStrikeRateNote = (section, rowId) =>
  section === 'batting' && rowId === 'strikeRate150'

function ScoringRules() {
  const pointsRules = cloneDefaultPointsRules()

  return (
    <section className="admin">
      <div className="admin-header">
        <div>
          <p className="eyebrow">Admin</p>
          <h2>Scoring Rules</h2>
          <p className="lead">
            Read-only reference of the shared scoring template used by the app.
          </p>
        </div>
      </div>
      <div className="admin-grid points-reference-grid">
        {Object.entries(pointsRules).map(([section, rows]) => (
          <article className="admin-card points-reference-card" key={section}>
            <div className="points-reference-head">
              <div>
                <h3>{section}</h3>
                <p>{sectionDescriptions[section] || 'Shared scoring rules.'}</p>
              </div>
              <span className="badge light">{`${rows.length} rules`}</span>
            </div>
            <div className="points-reference-list">
              {rows.map((row) => (
                <div key={row.id}>
                  {shouldShowStrikeRateNote(section, row.id) ? (
                    <p className="points-rule-note">
                      <span className="points-rule-note-icon" aria-hidden="true">
                        i
                      </span>
                      SR points apply only after 15 balls faced.
                    </p>
                  ) : null}
                  <div className="points-input-row points-reference-row">
                    <span>{row.label}</span>
                    <input type="number" value={row.value} readOnly disabled />
                  </div>
                </div>
              ))}
            </div>
          </article>
        ))}
      </div>
    </section>
  )
}

export default ScoringRules
