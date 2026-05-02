import auditLogService from '../services/audit-log.service.js'
import { AUTO_SYNC_ACTOR_LABEL } from './settings.js'

const logAutoSyncActivity = async ({
  context = {},
  action,
  resourceType,
  match,
  detail,
  extraChanges = {},
}) =>
  auditLogService.logAction({
    performedBy: null,
    action,
    resourceType,
    resourceId: String(match?.id || ''),
    tournamentId: String(match?.tournamentId || 'global'),
    module: resourceType === 'match-lineup' ? 'lineups' : 'scores',
    detail,
    changes: {
      actorLabel: AUTO_SYNC_ACTOR_LABEL,
      syncId: context.syncId || '',
      trigger: context.trigger || '',
      source: 'live-score-api',
      ...extraChanges,
    },
  })

export { logAutoSyncActivity }
