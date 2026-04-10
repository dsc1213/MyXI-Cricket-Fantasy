function PointsPanel({
  pointsRules,
  canEditRules,
  isEditMode,
  onEnableEdit,
  onDisableEdit,
  isSavingRules,
  updateRuleValue,
  onSaveRules,
}) {
  const isEditable = canEditRules && isEditMode
  const sectionDescriptions = {
    batting: 'Runs, milestones, duck, and strike-rate bonuses.',
    bowling: 'Wickets, maidens, wides/no-balls, and economy slabs.',
    fielding: 'Catches, stumpings, and runout scoring from scorecard text.',
  }

  return (
    <section className="dashboard-section">
      <div className="admin-card dashboard-panel-card points-editor-card">
        <div className="top-actions">
          {canEditRules ? (
            isEditable ? (
              <button type="button" className="btn btn-ghost btn-small" onClick={onDisableEdit}>
                Cancel
              </button>
            ) : (
              <button type="button" className="btn btn-ghost btn-small" onClick={onEnableEdit}>
                Edit
              </button>
            )
          ) : (
            <span className="team-note">Read-only: admin/master access required.</span>
          )}
        </div>
        {Object.entries(pointsRules).map(([section, rows]) => (
          <div className="points-group points-group-card" key={section}>
            <div className="points-group-head">
              <div>
                <h4>{section}</h4>
                <p className="team-note">{sectionDescriptions[section] || 'Shared scoring rules'}</p>
              </div>
              <span className="badge light">{`${rows.length} rules`}</span>
            </div>
            <div className="player-list">
              {rows.map((row) => (
                <label className="points-input-row" key={row.id}>
                  <span>{row.label}</span>
                  <input
                    type="number"
                    value={row.value}
                    disabled={!isEditable}
                    onChange={(event) => updateRuleValue(section, row.id, event.target.value)}
                  />
                </label>
              ))}
            </div>
          </div>
        ))}
        {isEditable && (
          <div className="top-actions">
            <button type="button" className="btn btn-primary btn-small" onClick={onSaveRules} disabled={isSavingRules}>
              {isSavingRules ? 'Saving...' : 'Save'}
            </button>
          </div>
        )}
      </div>
    </section>
  )
}

export default PointsPanel
