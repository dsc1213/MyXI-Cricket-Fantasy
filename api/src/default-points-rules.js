import defaultPointsRulesJson from '../../mocks/state/points-rule-template.json' with { type: 'json' }

const cloneDefaultPointsRules = () => JSON.parse(JSON.stringify(defaultPointsRulesJson))

export { defaultPointsRulesJson, cloneDefaultPointsRules }
