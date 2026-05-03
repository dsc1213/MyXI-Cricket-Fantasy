import test from 'node:test'
import assert from 'node:assert/strict'

import { sortMatchesForSelection } from '../../src/lib/matchSort.js'

test('sortMatchesForSelection keeps active matches first and completed matches oldest to newest', () => {
  const now = new Date('2026-05-03T12:00:00-05:00').getTime()
  const rows = [
    {
      id: 'past-completed',
      startAt: '2026-05-02T09:00:00-05:00',
      status: 'completed',
    },
    {
      id: 'today-completed',
      startAt: '2026-05-03T09:00:00-05:00',
      status: 'completed',
    },
    {
      id: 'future-notstarted',
      startAt: '2026-05-04T09:00:00-05:00',
      status: 'notstarted',
    },
    {
      id: 'past-started',
      startAt: '2026-05-02T10:00:00-05:00',
      status: 'started',
    },
    {
      id: 'today-inprogress',
      startAt: '2026-05-03T11:00:00-05:00',
      status: 'inprogress',
    },
    {
      id: 'today-started',
      startAt: '2026-05-03T10:00:00-05:00',
      status: 'started',
    },
  ]

  assert.deepEqual(
    sortMatchesForSelection(rows, now).map((row) => row.id),
    [
      'today-started',
      'today-inprogress',
      'future-notstarted',
      'past-started',
      'past-completed',
      'today-completed',
    ],
  )
})
