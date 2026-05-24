import { useMemo, useState } from 'react'
import Button from '../../components/ui/Button.jsx'
import JsonAssistantModal from '../../components/ui/JsonAssistantModal.jsx'
import JsonTextareaField from '../../components/ui/JsonTextareaField.jsx'
import Modal from '../../components/ui/Modal.jsx'
import { importAdminTournamentMatches } from '../../lib/api.js'
import { getStoredUser } from '../../lib/auth.js'
import { parseNormalizedJsonInput } from '../../lib/jsonInput.js'

const buildMatchesJsonExample = (tournament = {}) => `{
  "tournamentId": "${tournament?.id || 'selected-tournament'}",
  "source": "json",
  "updateExistingContests": true,
  "matches": [
    {
      "id": "m71",
      "matchNo": 71,
      "home": "RCB",
      "away": "CSK",
      "startAt": "2026-05-25T14:00",
      "timezone": "Asia/Kolkata",
      "location": "Bengaluru",
      "venue": "M. Chinnaswamy Stadium"
    }
  ]
}`

function AddTournamentMatchesModal({
  open,
  tournament,
  onClose,
  onImported,
}) {
  const currentUser = getStoredUser()
  const [payloadText, setPayloadText] = useState('')
  const [updateExistingContests, setUpdateExistingContests] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [errorText, setErrorText] = useState('')
  const [isAssistantOpen, setIsAssistantOpen] = useState(false)
  const [copyJsonLabel, setCopyJsonLabel] = useState('Copy JSON')
  const [copyPromptLabel, setCopyPromptLabel] = useState('Copy AI Prompt')

  const templateJson = useMemo(() => buildMatchesJsonExample(tournament), [tournament])
  const aiPromptText = useMemo(
    () =>
      [
        'Convert source notes into the exact JSON format used by /admin/tournaments/:id/matches/import.',
        '',
        'Rules:',
        '- Return valid JSON only.',
        '- Do not include markdown, code fences, or explanations.',
        '- Keep top-level shape as {"source":"json","updateExistingContests":true,"matches":[...]}',
        '- Do not include tournament name or season unless they are already known.',
        '- Each match must include id, matchNo, home, away, startAt, timezone and optional venue/location.',
        `- Target tournament: ${tournament?.name || tournament?.id || 'selected tournament'}.`,
        '',
        'Template JSON:',
        templateJson,
        '',
        'Source match notes:',
        'PASTE_NEW_MATCH_NOTES_HERE',
      ].join('\n'),
    [templateJson, tournament],
  )

  const onCopy = async (text, setLabel, resetLabel) => {
    if (!text) return
    try {
      await navigator.clipboard.writeText(text)
      setLabel('Copied')
      window.setTimeout(() => setLabel(resetLabel), 1200)
    } catch {
      setLabel('Copy failed')
      window.setTimeout(() => setLabel(resetLabel), 1600)
    }
  }

  const onSubmit = async () => {
    if (!tournament?.id) return
    try {
      setErrorText('')
      setIsSaving(true)
      const { parsed, normalizedText } = parseNormalizedJsonInput(payloadText || '{}')
      if (normalizedText !== payloadText) {
        setPayloadText(JSON.stringify(parsed, null, 2))
      }
      const actorUserId =
        currentUser?.gameName || currentUser?.email || currentUser?.id || ''
      const result = await importAdminTournamentMatches(tournament.id, {
        ...parsed,
        updateExistingContests,
        actorUserId,
      })
      onImported?.(result)
      setPayloadText('')
      setUpdateExistingContests(true)
      onClose?.()
    } catch (error) {
      setErrorText(error.message || 'Failed to add matches')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <>
      <Modal
        open={open}
        onClose={onClose}
        title={`Add matches${tournament?.name ? ` • ${tournament.name}` : ''}`}
        size="md"
        className="add-tournament-matches-modal"
        footer={
          <>
            <Button variant="ghost" size="small" onClick={onClose}>
              Cancel
            </Button>
            <Button
              variant="primary"
              size="small"
              disabled={isSaving || !payloadText.trim() || !tournament?.id}
              onClick={() => void onSubmit()}
            >
              {isSaving ? 'Adding...' : 'Add matches'}
            </Button>
          </>
        }
      >
        <div className="add-tournament-matches-form">
          {!!errorText && (
            <p className="add-tournament-matches-feedback error-text" role="alert">
              {errorText}
            </p>
          )}
          <JsonTextareaField
            wrapperClassName="add-tournament-matches-json-field"
            label="New matches JSON payload"
            labelAction={
              <Button
                type="button"
                variant="secondary"
                size="small"
                aria-label="Generate JSON"
                onClick={() => {
                  setIsAssistantOpen(true)
                  setCopyJsonLabel('Copy JSON')
                  setCopyPromptLabel('Copy AI Prompt')
                }}
              >
                Generate JSON
              </Button>
            }
            rows={12}
            value={payloadText}
            onChange={(event) => setPayloadText(event.target.value)}
            placeholder={templateJson}
            onClear={() => setPayloadText('')}
            clearDisabled={!payloadText.trim()}
          />
          <label className="add-tournament-matches-checkbox">
            <input
              type="checkbox"
              checked={updateExistingContests}
              onChange={(event) => setUpdateExistingContests(event.target.checked)}
            />
            <span>Update existing contests</span>
          </label>
        </div>
      </Modal>
      <JsonAssistantModal
        open={isAssistantOpen}
        ariaLabel="Generated Matches JSON"
        title="Generated Matches JSON"
        description="Use this template with an AI prompt, then paste the final JSON into the add matches payload."
        jsonLabel="Matches JSON"
        jsonText={templateJson}
        onCopyJson={() => void onCopy(templateJson, setCopyJsonLabel, 'Copy JSON')}
        copyJsonLabel={copyJsonLabel}
        promptLabel="AI Prompt For Matches JSON"
        promptText={aiPromptText}
        onCopyPrompt={() =>
          void onCopy(aiPromptText, setCopyPromptLabel, 'Copy AI Prompt')
        }
        copyPromptLabel={copyPromptLabel}
        footerActions={[
          {
            label: 'Use Template',
            variant: 'primary',
            onClick: () => {
              setPayloadText(templateJson)
              setIsAssistantOpen(false)
            },
          },
          {
            label: 'Close',
            variant: 'ghost',
            onClick: () => setIsAssistantOpen(false),
          },
        ]}
        onClose={() => setIsAssistantOpen(false)}
      />
    </>
  )
}

export default AddTournamentMatchesModal
