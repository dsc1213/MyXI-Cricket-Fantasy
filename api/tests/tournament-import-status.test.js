import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  deriveMatchStatus,
  isMatchEditingLocked,
  mapMatchWithDerivedStatus,
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

describe('match edit lock override', () => {
  it('keeps inprogress matches editable when admin forces edits open', () => {
    expect(isMatchEditingLocked('inprogress', 'force_open')).toBe(false)

    expect(
      mapMatchWithDerivedStatus({
        status: 'inprogress',
        teamEditLockOverride: 'force_open',
      }),
    ).toMatchObject({
      status: 'inprogress',
      teamEditLockOverride: 'force_open',
      teamEditingLocked: false,
      locked: false,
    })
  })

  it('locks pre-match team edits when admin forces edits closed', () => {
    expect(isMatchEditingLocked('started', 'force_locked')).toBe(true)

    expect(
      mapMatchWithDerivedStatus({
        status: 'started',
        teamEditLockOverride: 'force_locked',
      }),
    ).toMatchObject({
      status: 'started',
      teamEditLockOverride: 'force_locked',
      teamEditingLocked: true,
      locked: true,
    })
  })
})
