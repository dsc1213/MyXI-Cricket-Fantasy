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

export { defaultPointsRulesJson, cloneDefaultPointsRules }
