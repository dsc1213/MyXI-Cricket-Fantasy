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
    bowling: 'Wickets, bowled/LBW bonus, maidens, wides/no-balls, and economy slabs.',
    fielding: 'Catches, stumpings, and runout scoring from scorecard text.',
  }
  const shouldShowStrikeRateNote = (section, rowId) =>
    section === 'batting' && rowId === 'strikeRate150'

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
                <div key={row.id}>
                  {shouldShowStrikeRateNote(section, row.id) ? (
                    <p className="points-rule-note">
                      <span className="points-rule-note-icon" aria-hidden="true">
                        i
                      </span>
                      SR points apply only after 15 balls faced.
                    </p>
                  ) : null}
                  <label className="points-input-row">
                    <span>{row.label}</span>
                    <input
                      type="number"
                      value={row.value}
                      disabled={!isEditable}
                      onChange={(event) => updateRuleValue(section, row.id, event.target.value)}
                    />
                  </label>
                </div>
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
