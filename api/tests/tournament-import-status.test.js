import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  deriveMatchStatus,
  normalizeImportedStartAt,
} from '../src/services/tournamentImport.service.js'

describe('deriveMatchStatus', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('keeps a 5 AM CDT match as notstarted when current time is 1 AM CDT', () => {
    vi.setSystemTime(new Date('2026-04-25T06:00:00.000Z'))

    expect(normalizeImportedStartAt('2026-04-25T10:00:00.000Z')).toBe(
      '2026-04-25T10:00:00.000Z',
    )

    expect(
      deriveMatchStatus({
        startAt: '2026-04-25T10:00:00.000Z',
        date: 'Sat Apr 25',
        explicitStatus: 'notstarted',
      }),
    ).toBe('notstarted')
  })

  it('promotes notstarted to inprogress only after the start time passes', () => {
    vi.setSystemTime(new Date('2026-04-25T10:01:00.000Z'))

    expect(
      deriveMatchStatus({
        startAt: '2026-04-25T10:00:00.000Z',
        date: 'Sat Apr 25',
        explicitStatus: 'notstarted',
      }),
    ).toBe('inprogress')
  })

  it('downgrades inprogress back to notstarted when start time is still in the future', () => {
    vi.setSystemTime(new Date('2026-04-25T06:00:00.000Z'))

    expect(
      deriveMatchStatus({
        startAt: '2026-04-25T10:00:00.000Z',
        date: 'Sat Apr 25',
        explicitStatus: 'inprogress',
      }),
    ).toBe('notstarted')
  })
})
