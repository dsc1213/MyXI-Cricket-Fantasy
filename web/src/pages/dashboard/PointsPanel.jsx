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
          <div className="points-group" key={section}>
            <h4>{section}</h4>
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
