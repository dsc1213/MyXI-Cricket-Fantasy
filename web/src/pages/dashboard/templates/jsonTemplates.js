export const SCORE_JSON_SCHEMA_TEMPLATE = `{
  "playerStats": [
    {
      "playerName": "Player 1",
      "runs": 30,
      "ballsFaced": 20,
      "fours": 4,
      "sixes": 1,
      "wickets": 2
    }
  ]
}`

export const SCORE_JSON_FALLBACK = '{\n  "playerStats": []\n}'

export const LINEUP_JSON_FALLBACK = '{\n  "lineups": {}\n}'

export const buildLineupJsonSchemaTemplate = (teamAName, teamBName) => `{
  "lineups": {
    "${teamAName}": {
      "playingXI": ["Player 1", "Player 2"]
    },
    "${teamBName}": {
      "playingXI": ["Player A", "Player B"]
    }
  }
}`

export const SCORE_AI_PROMPT_TEXT = [
  'Convert the scorecard into JSON for /match-scores/save.',
  '',
  'Rules:',
  '- Return valid JSON only.',
  '- No markdown or explanations.',
  '- Use exactly {"playerStats":[...]} as the top-level shape.',
  '- Use playerName exactly as shown in the template.',
  '- playerId is optional. Do not invent ids.',
  '- Include only players present in the template.',
  '- Names are validated by the app against DB players for the selected match.',
  '- Missing numeric fields should be 0. dismissed should be false when not out/DNB.',
  '',
  'Score fields: runs, ballsFaced, fours, sixes, wickets, overs, maidens, runsConceded, noBalls, wides, catches, stumpings, runoutDirect, runoutIndirect, dismissed.',
  '',
  'Scorecard JSON:',
  'PASTE_SCORECARD_JSON_HERE',
].join('\n')

export const LINEUP_AI_PROMPT_TEXT = [
  'Convert lineup notes into JSON for /admin/match-lineups/upsert.',
  '',
  'Rules:',
  '- Return valid JSON only.',
  '- No markdown or explanations.',
  '- Keep top-level shape as {"lineups": {...}}.',
  '- Use the team keys exactly as shown in the template.',
  '- For each team include only playingXI.',
  '- Each playingXI must contain 11 or 12 unique players.',
  '- Use player names from the selected squads only.',
  '- Names are validated by the app against DB players for the selected match.',
  '',
  'Format:',
  '{"lineups":{"TEAM_A":{"playingXI":["Player 1"]},"TEAM_B":{"playingXI":["Player 2"]}}}',
  '',
  'Source lineup notes:',
  'PASTE_LINEUP_SOURCE_HERE',
].join('\n')
