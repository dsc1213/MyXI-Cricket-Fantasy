import { beforeEach, describe, expect, it, vi } from 'vitest'

const dbQuery = vi.fn()

vi.mock('../src/db.js', () => ({
  dbQuery,
}))

let userRepository

beforeEach(async () => {
  dbQuery.mockReset()
  const mod = await import('../src/repositories/user.repository.js')
  userRepository = mod.default
})

describe('user repository db row mapping', () => {
  it('maps snake_case auth fields into the domain shape expected by auth service', async () => {
    dbQuery.mockResolvedValue({
      rows: [
        {
          id: 2,
          name: 'Sree Charan',
          userId: 'HunterCherryXI',
          gameName: 'HunterCherryXI',
          email: 'dsc.charancherry1213@gmail.com',
          phone: '6605412885',
          location: 'Dallas, Tx',
          password_hash:
            '$2b$10$vRuHSdQwFYMgT9QS9XpEX.OpKJzXSLZ3fjlJ5of7tsxQ9uguoOdxK',
          role: 'user',
          status: 'active',
          contest_manager_contest_id: null,
          created_at: '2026-03-26T22:00:43.747Z',
          updated_at: '2026-03-26T22:00:43.747Z',
          reset_token: null,
          reset_token_expires_at: null,
          security_answer_1_hash: 'q1',
          security_answer_2_hash: 'q2',
          security_answer_3_hash: 'q3',
        },
      ],
    })

    const user = await userRepository.findByIdentifier('HunterCherryXI')

    expect(user.passwordHash).toBe(
      '$2b$10$vRuHSdQwFYMgT9QS9XpEX.OpKJzXSLZ3fjlJ5of7tsxQ9uguoOdxK',
    )
    expect(user.contestManagerContestId).toBeNull()
    expect(user.securityAnswer1Hash).toBe('q1')
    expect(user.securityAnswer2Hash).toBe('q2')
    expect(user.securityAnswer3Hash).toBe('q3')
  })
})
