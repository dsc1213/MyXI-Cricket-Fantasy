const fallbackPointsRules = {
  batting: [],
  bowling: [],
  fielding: [],
}

let defaultPointsRulesJson = fallbackPointsRules

try {
  const module = await import('../../mocks/state/points-rule-template.json', {
    with: { type: 'json' },
  })
  defaultPointsRulesJson = module?.default || fallbackPointsRules
} catch (error) {
  const message = error?.message || 'Unknown points rule template load error'
  console.warn(
    `[config] Points rule template unavailable, using empty defaults: ${message}`,
  )
}

const cloneDefaultPointsRules = () => JSON.parse(JSON.stringify(defaultPointsRulesJson))

const mergeRuleSection = (defaults = [], incoming = []) => {
  const incomingRows = Array.isArray(incoming) ? incoming : []
  const merged = defaults.map((row) => {
    const incomingRow = incomingRows.find((candidate) => candidate?.id === row.id)
    return incomingRow ? { ...row, ...incomingRow } : { ...row }
  })
  incomingRows.forEach((row) => {
    if (!row?.id || merged.some((candidate) => candidate.id === row.id)) return
    merged.push({ ...row })
  })
  return merged
}

const normalizePointsRuleTemplate = (value) => {
  const template = value && typeof value === 'object' ? value : {}
  const defaults = cloneDefaultPointsRules()
  return {
    batting: mergeRuleSection(defaults.batting, template.batting),
    bowling: mergeRuleSection(defaults.bowling, template.bowling),
    fielding: mergeRuleSection(defaults.fielding, template.fielding),
  }
}

export { defaultPointsRulesJson, cloneDefaultPointsRules, normalizePointsRuleTemplate }
