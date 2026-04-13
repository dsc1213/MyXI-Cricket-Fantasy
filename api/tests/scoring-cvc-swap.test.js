import { describe, it, expect } from 'vitest'
import { resolveEffectiveSelection } from '../src/scoring.js'

// Unit test for C/VC swap with backup promotion

describe('resolveEffectiveSelection', () => {
  it('should assign C/VC to promoted backup if original is swapped out', () => {
    // Setup: 11 playing XI, 4 backups, C and VC are not in active XI
    const playingXi = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]
    const backups = [12, 13, 14, 15]
    const captainId = 1 // Will be swapped out
    const viceCaptainId = 2 // Will be swapped out
    // Only 3-11 are active, so 12 and 13 will be promoted
    const activePlayerIds = [3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13]

    const result = resolveEffectiveSelection({
      playingXi,
      backups,
      activePlayerIds,
      captainId,
      viceCaptainId,
    })

    // 1 and 2 are swapped out, 12 and 13 are promoted
    expect(result.nextPlayingXi).not.toContain(1)
    expect(result.nextPlayingXi).not.toContain(2)
    expect(result.promotedBackupIds).toEqual([12, 13])
    // C/VC should be reassigned to promoted backups
    expect(result.resolvedCaptainId).toBe(12)
    expect(result.resolvedViceCaptainId).toBe(13)
    // C/VC applies should be true for promoted backups
    expect(result.captainApplies).toBe(true)
    expect(result.viceCaptainApplies).toBe(true)
  })
})
