import { dbQuery } from '../db.js'

const resolveActorLabel = (row = {}) =>
  row.actorLabel ||
  row.actorGameName ||
  row.actorName ||
  row.actorUserId ||
  row.performedBy?.toString() ||
  'Admin'

class AuditLogService {
  async logAction({
    performedBy = null,
    action = '',
    resourceType = '',
    resourceId = '',
    tournamentId = 'global',
    module = 'admin',
    detail = '',
    target = '',
    changes = {},
    ipAddress = '',
    userAgent = '',
  } = {}) {
    if (!action) return null
    const payload = {
      tournamentId: tournamentId || 'global',
      module: module || 'admin',
      detail: detail || '',
      target: target || resourceId || '',
      ...((changes && typeof changes === 'object') ? changes : {}),
    }
    const result = await dbQuery(
      `INSERT INTO audit_logs (
         performed_by, action, resource_type, resource_id, changes, ip_address, user_agent, created_at
       )
       VALUES ($1, $2, $3, $4, $5::jsonb, $6, $7, now())
       RETURNING id`,
      [
        performedBy || null,
        action,
        resourceType || null,
        resourceId ? String(resourceId) : null,
        JSON.stringify(payload),
        ipAddress || null,
        userAgent || null,
      ],
    )
    return result.rows?.[0] || null
  }

  async listRecent(limit = 250) {
    const safeLimit = Math.max(1, Math.min(Number(limit) || 250, 1000))
    const result = await dbQuery(
      `SELECT al.id,
              al.action,
              al.resource_type as "resourceType",
              al.resource_id as "resourceId",
              al.changes,
              al.changes->>'actorLabel' as "actorLabel",
              al.created_at as "at",
              al.performed_by as "performedBy",
              NULLIF(u.game_name, '') as "actorGameName",
              NULLIF(u.name, '') as "actorName",
              NULLIF(u.user_id, '') as "actorUserId"
       FROM audit_logs al
       LEFT JOIN users u ON u.id = al.performed_by
       ORDER BY al.created_at DESC
       LIMIT $1`,
      [safeLimit],
    )
    return (result.rows || []).map((row) => {
      const changes =
        typeof row.changes === 'string' ? JSON.parse(row.changes || '{}') : row.changes || {}
      return {
        id: row.id,
        actor: resolveActorLabel(row),
        action: row.action || '-',
        target: changes?.target || row.resourceId || '-',
        detail: changes?.detail || '-',
        tournamentId: changes?.tournamentId || 'global',
        module: changes?.module || row.resourceType || 'admin',
        at: row.at,
      }
    })
  }

  async deleteByIds(ids = []) {
    const normalizedIds = Array.from(
      new Set(
        (Array.isArray(ids) ? ids : [])
          .map((value) => Number(value))
          .filter((value) => Number.isFinite(value) && value > 0),
      ),
    )
    if (!normalizedIds.length) {
      return { deletedCount: 0 }
    }
    const result = await dbQuery(
      `DELETE FROM audit_logs
       WHERE id = ANY($1::bigint[])`,
      [normalizedIds],
    )
    return { deletedCount: Number(result.rowCount || 0) }
  }
}

export default new AuditLogService()
