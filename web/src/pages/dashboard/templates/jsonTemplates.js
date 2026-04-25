export const SCORE_JSON_SCHEMA_TEMPLATE = `{
  "playerStats": [
    {
      "playerName": "Player 1",
      "runs": 30,
      "ballsFaced": 20,
      "fours": 4,
      "sixes": 1,
      "wickets": 2,
      "overs": 4,
      "maidens": 0,
      "runsConceded": 28,
      "noBalls": 0,
      "wides": 1,
      "catches": 1,
      "stumpings": 0,
      "runoutDirect": 0,
      "runoutIndirect": 0,
      "hatTrick": 0,
      "dismissed": true
    }
  ]
}`

export const SCORE_JSON_FALLBACK = '{\n  "playerStats": []\n}'

export const LINEUP_JSON_FALLBACK = '{\n  "lineups": {}\n}'

export const buildLineupJsonSchemaTemplate = (teamAName, teamBName) => `{
  "lineups": {
    "${teamAName}": {
      "playingXI": ["Player 1", "Player 2"],
      "impactPlayers": ["Impact Player 1"]
    },
    "${teamBName}": {
      "playingXI": ["Player A", "Player B"],
      "impactPlayers": ["Impact Player A"]
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
  '- If the source contains multiple scorecards, innings snapshots, score updates, or repeated versions of the same match, always use the latest / most recent / final available score state only.',
  '- Use playerName exactly as shown in the template.',
  '- playerId is optional. Do not invent ids.',
  '- Include only players present in the template.',
  '- Names are validated by the app against DB players for the selected match.',
  '- Missing numeric fields should be 0. dismissed should be false when not out/DNB.',
  '- ballsFaced is required for duck and strike-rate rules when the batter faced the ball.',
  '- overs and runsConceded are required for economy rules when the player bowled.',
  '',
  'Score fields: runs, ballsFaced, fours, sixes, wickets, overs, maidens, runsConceded, noBalls, wides, catches, stumpings, runoutDirect, runoutIndirect, hatTrick, dismissed.',
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
  '- For each team include playingXI and add the actual impact player only if they have played. Do not assume or add any substitute. Ensure players are unique.',
  '- Each playingXI must contain 11 to 15 unique players.',
  '- impactPlayers is optional and can be empty or omitted when not announced.',
  '- Use player names from the selected squads only.',
  '- Names are validated by the app against DB players for the selected match.',
  '',
  'Format:',
  '{"lineups":{"TEAM_A":{"playingXI":["Player 1"],"impactPlayers":["Impact Player 1"]},"TEAM_B":{"playingXI":["Player 2"]}}}',
  '',
  'Source lineup notes:',
  'PASTE_LINEUP_SOURCE_HERE',
].join('\n')
