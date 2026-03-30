import { dbQuery } from '../db.js'

class PlayerRepository {
  async findAll() {
    const result = await dbQuery(
      `SELECT id, first_name as "firstName", last_name as "lastName", role, team_key as "teamKey",
              team_name as "teamName", player_id as "playerId", display_name as "displayName",
              country, image_url as "imageUrl", active, batting_style as "battingStyle",
              bowling_style as "bowlingStyle", base_price as "basePrice", source_key as "sourceKey",
              created_at as "createdAt", updated_at as "updatedAt"
       FROM players
       ORDER BY team_key, first_name ASC`,
    )
    return result.rows
  }

  async findById(id) {
    const result = await dbQuery(
      `SELECT id, first_name as "firstName", last_name as "lastName", role, team_key as "teamKey",
              team_name as "teamName", player_id as "playerId", display_name as "displayName",
              country, image_url as "imageUrl", active, batting_style as "battingStyle",
              bowling_style as "bowlingStyle", base_price as "basePrice", source_key as "sourceKey",
              created_at as "createdAt", updated_at as "updatedAt"
       FROM players
       WHERE id = $1`,
      [id],
    )
    return result.rows[0]
  }

  async findByTeam(teamKey) {
    const result = await dbQuery(
      `SELECT id, first_name as "firstName", last_name as "lastName", role, team_key as "teamKey",
              team_name as "teamName", player_id as "playerId", display_name as "displayName",
              country, image_url as "imageUrl", active, batting_style as "battingStyle",
              bowling_style as "bowlingStyle", base_price as "basePrice", source_key as "sourceKey",
              created_at as "createdAt", updated_at as "updatedAt"
       FROM players
       WHERE team_key = $1
       ORDER BY first_name ASC`,
      [teamKey],
    )
    return result.rows
  }

  async findStats(playerId) {
    const result = await dbQuery(
      `SELECT id, player_id as "playerId", tournament_id as "tournamentId", runs, wickets, catches,
              stumpings, total_points as "totalPoints", created_at as "createdAt", updated_at as "updatedAt"
       FROM player_stats
       WHERE player_id = $1`,
      [playerId],
    )
    return result.rows
  }

  async create(data) {
    const {
      firstName,
      lastName,
      role,
      teamKey,
      teamName,
      playerId,
      displayName,
      country,
      imageUrl,
      active,
      battingStyle,
      bowlingStyle,
      basePrice,
      sourceKey,
    } = data
    const result = await dbQuery(
      `INSERT INTO players (
         first_name, last_name, role, team_key, team_name, player_id, display_name, country,
         image_url, active, batting_style, bowling_style, base_price, source_key, created_at, updated_at
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, now(), now())
       RETURNING id, first_name as "firstName", last_name as "lastName", role, team_key as "teamKey",
                 team_name as "teamName", player_id as "playerId", display_name as "displayName",
                 country, image_url as "imageUrl", active, batting_style as "battingStyle",
                 bowling_style as "bowlingStyle", base_price as "basePrice", source_key as "sourceKey",
                 created_at as "createdAt", updated_at as "updatedAt"`,
      [
        firstName,
        lastName,
        role,
        teamKey,
        teamName || teamKey,
        playerId,
        displayName || [firstName, lastName].filter(Boolean).join(' '),
        country || '',
        imageUrl || '',
        active !== false,
        battingStyle || '',
        bowlingStyle || '',
        basePrice ?? null,
        sourceKey || null,
      ],
    )
    return result.rows[0]
  }

  async bulkCreate(players) {
    const values = []
    let paramIndex = 1
    const placeholders = players
      .map((p) => {
        values.push(
          p.firstName,
          p.lastName,
          p.role,
          p.teamKey,
          p.teamName || p.teamKey,
          p.playerId,
          p.displayName || [p.firstName, p.lastName].filter(Boolean).join(' '),
          p.country || '',
          p.imageUrl || '',
          p.active !== false,
          p.battingStyle || '',
          p.bowlingStyle || '',
          p.basePrice ?? null,
          p.sourceKey || null,
        )
        const p1 = paramIndex,
          p2 = paramIndex + 1,
          p3 = paramIndex + 2,
          p4 = paramIndex + 3,
          p5 = paramIndex + 4,
          p6 = paramIndex + 5,
          p7 = paramIndex + 6,
          p8 = paramIndex + 7,
          p9 = paramIndex + 8,
          p10 = paramIndex + 9,
          p11 = paramIndex + 10,
          p12 = paramIndex + 11,
          p13 = paramIndex + 12,
          p14 = paramIndex + 13
        paramIndex += 14
        return `($${p1}, $${p2}, $${p3}, $${p4}, $${p5}, $${p6}, $${p7}, $${p8}, $${p9}, $${p10}, $${p11}, $${p12}, $${p13}, $${p14}, now(), now())`
      })
      .join(', ')

    const result = await dbQuery(
      `INSERT INTO players (
         first_name, last_name, role, team_key, team_name, player_id, display_name, country,
         image_url, active, batting_style, bowling_style, base_price, source_key, created_at, updated_at
       )
       VALUES ${placeholders}
       RETURNING id, first_name as "firstName", last_name as "lastName", role, team_key as "teamKey",
                 team_name as "teamName", player_id as "playerId", display_name as "displayName",
                 country, image_url as "imageUrl", active, batting_style as "battingStyle",
                 bowling_style as "bowlingStyle", base_price as "basePrice", source_key as "sourceKey",
                 created_at as "createdAt", updated_at as "updatedAt"`,
      values,
    )
    return result.rows
  }

  async findAllTeamSquads() {
    const result = await dbQuery(
      `SELECT
         ts.team_code as "teamCode",
         ts.team_name as "teamName",
         ts.tournament_type as "tournamentType",
         ts.country,
         ts.league,
         ts.tournament,
         ts.source,
         ts.updated_at as "lastUpdatedAt",
         p.id,
         p.first_name as "firstName",
         p.last_name as "lastName",
         p.display_name as "displayName",
         p.role,
         p.country as "playerCountry",
         p.team_key as "teamKey",
         p.player_id as "playerId",
         p.image_url as "imageUrl",
         p.batting_style as "battingStyle",
         p.bowling_style as "bowlingStyle",
         p.active
       FROM team_squads ts
       LEFT JOIN players p ON p.team_key = ts.team_code
       ORDER BY ts.team_code ASC, p.display_name ASC, p.first_name ASC, p.last_name ASC`,
    )
    const squads = new Map()
    for (const row of result.rows) {
      if (!squads.has(row.teamCode)) {
        squads.set(row.teamCode, {
          teamCode: row.teamCode,
          teamName: row.teamName,
          tournamentType: row.tournamentType,
          country: row.country,
          league: row.league,
          tournament: row.tournament,
          source: row.source,
          lastUpdatedAt: row.lastUpdatedAt,
          squad: [],
        })
      }
      if (row.id) {
        squads.get(row.teamCode).squad.push({
          id: row.id,
          name:
            row.displayName || [row.firstName, row.lastName].filter(Boolean).join(' ').trim(),
          country: row.playerCountry || '',
          role: row.role,
          playerId: row.playerId,
          imageUrl: row.imageUrl || '',
          battingStyle: row.battingStyle || '',
          bowlingStyle: row.bowlingStyle || '',
          active: row.active !== false,
        })
      }
    }
    return [...squads.values()]
  }

  async upsertTeamSquadMeta(data) {
    const {
      teamCode,
      teamName,
      tournamentType = 'league',
      country = '',
      league = '',
      tournament = '',
      source = 'manual',
    } = data
    const result = await dbQuery(
      `INSERT INTO team_squads (
         team_code, team_name, tournament_type, country, league, tournament, source, created_at, updated_at
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, now(), now())
       ON CONFLICT (team_code)
       DO UPDATE SET
         team_name = excluded.team_name,
         tournament_type = excluded.tournament_type,
         country = excluded.country,
         league = excluded.league,
         tournament = excluded.tournament,
         source = excluded.source,
         updated_at = now()
       RETURNING id`,
      [teamCode, teamName, tournamentType, country, league, tournament, source],
    )
    return result.rows[0]
  }

  async deleteByTeam(teamKey) {
    await dbQuery(`DELETE FROM players WHERE team_key = $1`, [teamKey])
    return true
  }

  async deleteTeamSquadMeta(teamKey) {
    await dbQuery(`DELETE FROM team_squads WHERE team_code = $1`, [teamKey])
    return true
  }

  async delete(id) {
    const result = await dbQuery(
      `DELETE FROM players WHERE id = $1
       RETURNING id`,
      [id],
    )
    return result.rows.length > 0
  }
}

export default new PlayerRepository()
