import { dbQuery } from '../db.js'

const normalizeIdentityPart = (value = '') =>
  value
    .toString()
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')

const GLOBAL_PLAYER_TEAM_KEY = 'GLOBAL'
const GLOBAL_PLAYER_TEAM_NAME = 'Global Player Pool'

const buildCanonicalSourceKey = ({
  sourceKey,
  playerId,
  displayName,
  firstName,
  lastName,
  country,
} = {}) => {
  if ((sourceKey || '').toString().trim()) return sourceKey.toString().trim()
  if ((playerId || '').toString().trim()) return playerId.toString().trim()
  const name =
    (displayName || '').toString().trim() ||
    [firstName, lastName].filter(Boolean).join(' ').trim()
  const nameKey = normalizeIdentityPart(name)
  const countryKey = normalizeIdentityPart(country)
  return [nameKey, countryKey].filter(Boolean).join('-')
}

class PlayerRepository {
  async findByDisplayNameAndCountry(displayName, country) {
    const result = await dbQuery(
      `SELECT id, first_name as "firstName", last_name as "lastName", role, team_key as "teamKey",
              team_name as "teamName", player_id as "playerId", display_name as "displayName",
              country, image_url as "imageUrl", active, batting_style as "battingStyle",
              bowling_style as "bowlingStyle", base_price as "basePrice", source_key as "sourceKey",
              created_at as "createdAt", updated_at as "updatedAt"
       FROM players
       WHERE lower(trim(display_name)) = lower(trim($1))
         AND lower(trim(coalesce(country, ''))) = lower(trim($2))
       ORDER BY id ASC
       LIMIT 1`,
      [displayName, country],
    )
    return result.rows[0] || null
  }

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

  async findByTournament(tournamentId) {
    const result = await dbQuery(
      `SELECT p.id,
              p.first_name as "firstName",
              p.last_name as "lastName",
              coalesce(tp.role, p.role) as role,
              tp.team_code as "teamKey",
              p.team_name as "teamName",
              p.player_id as "playerId",
              p.display_name as "displayName",
              p.country,
              p.image_url as "imageUrl",
              coalesce(tp.active, p.active) as active,
              p.batting_style as "battingStyle",
              p.bowling_style as "bowlingStyle",
              p.base_price as "basePrice",
              p.source_key as "sourceKey",
              p.created_at as "createdAt",
              p.updated_at as "updatedAt"
       FROM tournament_players tp
       JOIN players p
         ON p.id = tp.player_id
       WHERE tp.tournament_id = $1
       ORDER BY tp.team_code ASC, p.display_name ASC, p.first_name ASC, p.last_name ASC`,
      [tournamentId],
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

  async findByTeam(teamKey, tournamentId = null) {
    if (tournamentId) {
      const result = await dbQuery(
        `SELECT p.id,
                p.first_name as "firstName",
                p.last_name as "lastName",
                coalesce(tp.role, p.role) as role,
                tp.team_code as "teamKey",
                p.team_name as "teamName",
                p.player_id as "playerId",
                p.display_name as "displayName",
                p.country,
                p.image_url as "imageUrl",
                coalesce(tp.active, p.active) as active,
                p.batting_style as "battingStyle",
                p.bowling_style as "bowlingStyle",
                p.base_price as "basePrice",
                p.source_key as "sourceKey",
                p.created_at as "createdAt",
                p.updated_at as "updatedAt"
         FROM tournament_players tp
         JOIN players p
           ON p.id = tp.player_id
         WHERE tp.team_code = $1
           AND tp.tournament_id = $2
         ORDER BY p.display_name ASC, p.first_name ASC, p.last_name ASC`,
        [teamKey, tournamentId],
      )
      return result.rows
    }
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
    const canonicalSourceKey = buildCanonicalSourceKey({
      sourceKey,
      playerId,
      displayName,
      firstName,
      lastName,
      country,
    })
    const resolvedTeamKey = (teamKey || '').toString().trim() || GLOBAL_PLAYER_TEAM_KEY
    const providedTeamName = (teamName || '').toString().trim()
    const resolvedTeamName = providedTeamName
      ? providedTeamName
      : resolvedTeamKey === GLOBAL_PLAYER_TEAM_KEY
        ? GLOBAL_PLAYER_TEAM_NAME
        : resolvedTeamKey
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
        resolvedTeamKey,
        resolvedTeamName,
        playerId,
        displayName || [firstName, lastName].filter(Boolean).join(' '),
        country || '',
        imageUrl || '',
        active !== false,
        battingStyle || '',
        bowlingStyle || '',
        basePrice ?? null,
        canonicalSourceKey || null,
      ],
    )
    return result.rows[0]
  }

  async findCanonical(data = {}) {
    const explicitId = data.canonicalPlayerId || data.id || null
    if (explicitId != null && `${explicitId}`.trim()) {
      const normalizedExplicitId = `${explicitId}`.trim()
      if (/^\d+$/.test(normalizedExplicitId)) {
        const byId = await dbQuery(
          `SELECT id, first_name as "firstName", last_name as "lastName", role, team_key as "teamKey",
                  team_name as "teamName", player_id as "playerId", display_name as "displayName",
                  country, image_url as "imageUrl", active, batting_style as "battingStyle",
                  bowling_style as "bowlingStyle", base_price as "basePrice", source_key as "sourceKey",
                  created_at as "createdAt", updated_at as "updatedAt"
           FROM players
           WHERE id = $1
           LIMIT 1`,
          [Number(normalizedExplicitId)],
        )
        if (byId.rows[0]) return byId.rows[0]
      } else {
        const byExternalKey = await dbQuery(
          `SELECT id, first_name as "firstName", last_name as "lastName", role, team_key as "teamKey",
                  team_name as "teamName", player_id as "playerId", display_name as "displayName",
                  country, image_url as "imageUrl", active, batting_style as "battingStyle",
                  bowling_style as "bowlingStyle", base_price as "basePrice", source_key as "sourceKey",
                  created_at as "createdAt", updated_at as "updatedAt"
           FROM players
           WHERE source_key = $1
              OR player_id = $1
           LIMIT 1`,
          [normalizedExplicitId],
        )
        if (byExternalKey.rows[0]) return byExternalKey.rows[0]
      }
    }
    const canonicalSourceKey = buildCanonicalSourceKey(data)
    if (canonicalSourceKey) {
      const byKey = await dbQuery(
        `SELECT id, first_name as "firstName", last_name as "lastName", role, team_key as "teamKey",
                team_name as "teamName", player_id as "playerId", display_name as "displayName",
                country, image_url as "imageUrl", active, batting_style as "battingStyle",
                bowling_style as "bowlingStyle", base_price as "basePrice", source_key as "sourceKey",
                created_at as "createdAt", updated_at as "updatedAt"
         FROM players
         WHERE source_key = $1
         LIMIT 1`,
        [canonicalSourceKey],
      )
      if (byKey.rows[0]) return byKey.rows[0]
    }
    const name = (
      data.displayName || [data.firstName, data.lastName].filter(Boolean).join(' ')
    )
      .toString()
      .trim()
    const country = (data.country || '').toString().trim()
    if (name) {
      const byName = await dbQuery(
        `SELECT id, first_name as "firstName", last_name as "lastName", role, team_key as "teamKey",
                team_name as "teamName", player_id as "playerId", display_name as "displayName",
                country, image_url as "imageUrl", active, batting_style as "battingStyle",
                bowling_style as "bowlingStyle", base_price as "basePrice", source_key as "sourceKey",
                created_at as "createdAt", updated_at as "updatedAt"
         FROM players
         WHERE lower(trim(display_name)) = lower(trim($1))
           AND lower(trim(coalesce(country, ''))) = lower(trim($2))
         ORDER BY id ASC
         LIMIT 1`,
        [name, country],
      )
      if (byName.rows[0]) return byName.rows[0]

      const byNameOnly = await dbQuery(
        `SELECT id, first_name as "firstName", last_name as "lastName", role, team_key as "teamKey",
                team_name as "teamName", player_id as "playerId", display_name as "displayName",
                country, image_url as "imageUrl", active, batting_style as "battingStyle",
                bowling_style as "bowlingStyle", base_price as "basePrice", source_key as "sourceKey",
                created_at as "createdAt", updated_at as "updatedAt"
         FROM players
         WHERE lower(trim(display_name)) = lower(trim($1))
         ORDER BY id ASC
         LIMIT 1`,
        [name],
      )
      if (byNameOnly.rows[0]) return byNameOnly.rows[0]
    }
    return null
  }

  async upsertCanonical(data = {}) {
    const existing = await this.findCanonical(data)
    const canonicalSourceKey = buildCanonicalSourceKey(data)
    if (!existing) {
      return this.create({
        ...data,
        sourceKey: canonicalSourceKey || data.sourceKey || null,
      })
    }

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
      `UPDATE players
       SET first_name = coalesce(nullif($2, ''), first_name),
           last_name = coalesce(nullif($3, ''), last_name),
           role = coalesce(nullif($4, ''), role),
           team_key = coalesce(nullif($5, ''), team_key),
           team_name = coalesce(nullif($6, ''), team_name),
           player_id = coalesce(nullif($7, ''), player_id),
           display_name = coalesce(nullif($8, ''), display_name),
           country = coalesce($9, country),
           image_url = coalesce($10, image_url),
           active = coalesce($11, active),
           batting_style = coalesce($12, batting_style),
           bowling_style = coalesce($13, bowling_style),
           base_price = coalesce($14, base_price),
           source_key = coalesce(nullif($15, ''), source_key),
           updated_at = now()
       WHERE id = $1
       RETURNING id, first_name as "firstName", last_name as "lastName", role, team_key as "teamKey",
                 team_name as "teamName", player_id as "playerId", display_name as "displayName",
                 country, image_url as "imageUrl", active, batting_style as "battingStyle",
                 bowling_style as "bowlingStyle", base_price as "basePrice", source_key as "sourceKey",
                 created_at as "createdAt", updated_at as "updatedAt"`,
      [
        existing.id,
        firstName || '',
        lastName || '',
        role || '',
        teamKey || '',
        teamName || '',
        playerId || '',
        displayName || '',
        country ?? existing.country ?? '',
        imageUrl ?? existing.imageUrl ?? '',
        active ?? existing.active ?? true,
        battingStyle ?? existing.battingStyle ?? '',
        bowlingStyle ?? existing.bowlingStyle ?? '',
        basePrice ?? existing.basePrice ?? null,
        canonicalSourceKey || sourceKey || '',
      ],
    )
    return result.rows[0]
  }

  async bulkCreate(players) {
    const created = []
    for (const player of players) {
      created.push(await this.upsertCanonical(player))
    }
    return created
  }

  async replaceTournamentTeamPlayers({ tournamentId, teamKey, teamName, players = [] }) {
    await dbQuery(
      `DELETE FROM tournament_players
       WHERE tournament_id = $1 AND team_code = $2`,
      [tournamentId, teamKey],
    )

    const created = []
    for (const player of players) {
      const canonical = await this.upsertCanonical({
        ...player,
        teamKey,
        teamName,
      })
      created.push(canonical)
      await dbQuery(
        `INSERT INTO tournament_players (
           tournament_id, player_id, team_code, role, active, created_at, updated_at
         )
         VALUES ($1, $2, $3, $4, $5, now(), now())
         ON CONFLICT (tournament_id, player_id) DO UPDATE
         SET team_code = excluded.team_code,
             role = excluded.role,
             active = excluded.active,
             updated_at = now()`,
        [
          tournamentId,
          canonical.id,
          teamKey,
          player.role || canonical.role || '',
          player.active !== false,
        ],
      )
    }
    return created
  }

  async bulkCreateLegacy(players) {
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

  async findAllTeamSquads(tournamentId = null) {
    const result = await dbQuery(
      `SELECT
         ts.id as "teamSquadId",
         ts.tournament_id as "tournamentId",
         ts.team_code as "teamCode",
         ts.team_name as "teamName",
         ts.tournament_type as "tournamentType",
         ts.country,
         ts.league,
         ts.tournament,
         ts.source,
         ts.updated_at as "lastUpdatedAt",
         p.id as "playerRowId",
         p.id as "canonicalPlayerId",
         p.first_name as "firstName",
         p.last_name as "lastName",
         p.display_name as "displayName",
         coalesce(tp.role, p.role) as role,
         p.country as "playerCountry",
         tp.team_code as "teamKey",
         p.player_id as "playerId",
         p.source_key as "sourceKey",
         p.image_url as "imageUrl",
         p.batting_style as "battingStyle",
         p.bowling_style as "bowlingStyle",
         coalesce(tp.active, p.active) as active
       FROM team_squads ts
       LEFT JOIN tournament_players tp
         ON tp.team_code = ts.team_code
        AND (
          (ts.tournament_id is not null and tp.tournament_id = ts.tournament_id)
          or ts.tournament_id is null
        )
       LEFT JOIN players p
         ON p.id = tp.player_id
       WHERE ($1::bigint is null OR ts.tournament_id = $1)
       ORDER BY ts.team_code ASC, p.display_name ASC, p.first_name ASC, p.last_name ASC`,
      [tournamentId],
    )
    const squads = new Map()
    for (const row of result.rows) {
      const squadKey = `${row.tournamentId || 'none'}::${row.teamCode}`
      if (!squads.has(squadKey)) {
        squads.set(squadKey, {
          id: row.teamSquadId,
          tournamentId: row.tournamentId || null,
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
      if (row.playerRowId) {
        squads.get(squadKey).squad.push({
          id: row.playerRowId,
          canonicalPlayerId: row.canonicalPlayerId,
          name:
            row.displayName ||
            [row.firstName, row.lastName].filter(Boolean).join(' ').trim(),
          country: row.playerCountry || '',
          role: row.role,
          playerId: row.playerId,
          sourceKey: row.sourceKey || '',
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
      tournamentId = null,
      source = 'manual',
    } = data
    const result = await dbQuery(
      `INSERT INTO team_squads (
         tournament_id, team_code, team_name, tournament_type, country, league, tournament, source, created_at, updated_at
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, now(), now())
       ON CONFLICT (tournament_id, team_code)
       DO UPDATE SET
         team_name = excluded.team_name,
         tournament_type = excluded.tournament_type,
         country = excluded.country,
         league = excluded.league,
         tournament = excluded.tournament,
         source = excluded.source,
         updated_at = now()
       RETURNING id`,
      [
        tournamentId,
        teamCode,
        teamName,
        tournamentType,
        country,
        league,
        tournament,
        source,
      ],
    )
    return result.rows[0]
  }

  async deleteByTeam(teamKey, tournamentId = null) {
    if (tournamentId) {
      await dbQuery(
        `DELETE FROM tournament_players
         WHERE team_code = $1 AND tournament_id = $2`,
        [teamKey, tournamentId],
      )
      return true
    }
    await dbQuery(`DELETE FROM players WHERE team_key = $1`, [teamKey])
    return true
  }

  async deleteTeamSquadMeta(teamKey, tournamentId = null) {
    if (tournamentId) {
      await dbQuery(
        `DELETE FROM team_squads
         WHERE team_code = $1 AND tournament_id = $2`,
        [teamKey, tournamentId],
      )
      return true
    }
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

  async deleteMany(ids = []) {
    const normalizedIds = Array.from(
      new Set(
        (Array.isArray(ids) ? ids : [])
          .map((value) => Number(value))
          .filter((value) => Number.isFinite(value) && value > 0),
      ),
    )
    if (!normalizedIds.length) return []
    const result = await dbQuery(
      `DELETE FROM players
       WHERE id = ANY($1::bigint[])
       RETURNING id`,
      [normalizedIds],
    )
    return (result.rows || []).map((row) => Number(row.id))
  }
}

export default new PlayerRepository()
