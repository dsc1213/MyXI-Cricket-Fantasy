const defaultPointsRules = {
  batting: [
    { id: 'run', label: 'Each Run', value: 1 },
    { id: 'four', label: 'Each Four', value: 1 },
    { id: 'six', label: 'Each Six', value: 2 },
    { id: 'thirty', label: '30 Runs Bonus', value: 3 },
    { id: 'fifty', label: '50 Runs Bonus', value: 5 },
    { id: 'seventyFive', label: '75 Runs Bonus', value: 0 },
    { id: 'century', label: '100 Runs Bonus', value: 10 },
    { id: 'oneFifty', label: '150 Runs Bonus', value: 0 },
    { id: 'twoHundred', label: '200+ Runs Bonus', value: 0 },
    { id: 'duck', label: 'Duck Out', value: -5 },
    { id: 'strikeRate150', label: 'Strike Rate 150+', value: 0 },
    { id: 'strikeRate200', label: 'Strike Rate 200+', value: 0 },
    { id: 'strikeRate250', label: 'Strike Rate 250+', value: 0 },
    { id: 'strikeRateBelow80', label: 'Strike Rate Below 80', value: 0 },
  ],
  bowling: [
    { id: 'wicket', label: 'Each Wicket', value: 20 },
    { id: 'maiden', label: 'Maiden Over', value: 8 },
    { id: 'threew', label: '3-Wicket Bonus', value: 5 },
    { id: 'fourw', label: '4-Wicket Bonus', value: 10 },
    { id: 'fivew', label: '5-Wicket Bonus', value: 15 },
    { id: 'wide', label: 'Wide / No-ball', value: -1 },
    { id: 'economyBelow3', label: 'Economy 3 or Less', value: 0 },
    { id: 'economyBelow5', label: 'Economy 5 or Less', value: 0 },
    { id: 'economyBelow6', label: 'Economy 6 or Less', value: 0 },
    { id: 'economyAbove10', label: 'Economy 10+', value: 0 },
    { id: 'economyAbove12', label: 'Economy 12+', value: 0 },
    { id: 'hatTrick', label: 'Hat-trick Bonus', value: 0 },
  ],
  fielding: [
    { id: 'catch', label: 'Each Catch', value: 10 },
    { id: 'threeCatch', label: '3+ Catches Bonus', value: 0 },
    { id: 'stumping', label: 'Stumping', value: 12 },
    { id: 'twoStumping', label: '2+ Stumpings Bonus', value: 0 },
    { id: 'runout-direct', label: 'Runout (Direct Hit)', value: 12 },
    { id: 'runout-indirect', label: 'Runout (Assist)', value: 6 },
  ],
}

const cloneDefaultPointsRules = () => JSON.parse(JSON.stringify(defaultPointsRules))

const mergeRuleSection = (defaults = [], incoming = []) => {
  const incomingRows = Array.isArray(incoming) ? incoming : []
  const incomingById = new Map(
    incomingRows.filter((row) => row?.id).map((row) => [row.id, row]),
  )

  const merged = defaults.map((row) => {
    const incomingRow = incomingById.get(row.id)
    return incomingRow ? { ...row, ...incomingRow } : { ...row }
  })

  for (const row of incomingRows) {
    if (!row?.id || incomingById.get(row.id) == null) continue
    if (merged.some((entry) => entry.id === row.id)) continue
    merged.push({ ...row })
  }

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

export { defaultPointsRules, cloneDefaultPointsRules, normalizePointsRuleTemplate }
