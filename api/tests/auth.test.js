import { beforeAll, beforeEach, describe, expect, it } from 'vitest'
import request from 'supertest'
import { users } from '../src/store.js'

let app
let resetStore

beforeAll(async () => {
  process.env.NODE_ENV = 'test'
  process.env.MOCK_API = 'true'
  process.env.DB_PROVIDER = 'mock'
  process.env.MASTER_ADMIN_EMAIL = 'admin@myxi.local'
  process.env.MASTER_ADMIN_PASSWORD = 'change-me'
  process.env.MASTER_ADMIN_NAME = 'Admin'
  process.env.JWT_SECRET = 'test-secret'
  process.env.JWT_EXPIRES_IN = '1h'

  const mod = await import('../src/server.js')
  app = mod.app
  resetStore = mod.resetStore
})

beforeEach(() => {
  resetStore()
})

const loginMaster = async () => {
  const res = await request(app).post('/auth/login').send({
    email: 'admin@myxi.local',
    password: 'change-me',
  })
  return res.body.token
}

const loginBy = async (userId, password = 'demo123') => {
  return request(app).post('/auth/login').send({ userId, password })
}
const securityAnswersFor = (userId) => [
  `${userId}-school`,
  `${userId}-cricketer`,
  `${userId}-city`,
]

describe('auth', () => {
  it('registers a user as pending', async () => {
    const res = await request(app)
      .post('/auth/register')
      .send({
        name: 'Test User',
        gameName: 'TestXI',
        email: 'user@myxi.local',
        password: 'pass1234',
        securityAnswers: securityAnswersFor('testxi'),
      })
    expect(res.status).toBe(201)
    expect(res.body.status).toBe('pending')
  })

  it('rejects register when email already exists', async () => {
    const res = await request(app)
      .post('/auth/register')
      .send({
        name: 'Another Admin',
        gameName: 'adminclone',
        email: 'admin@myxi.local',
        password: 'pass1234',
        securityAnswers: securityAnswersFor('adminclone'),
      })
    expect(res.status).toBe(409)
    expect((res.body.message || '').toLowerCase()).toContain('already exists')
  })

  it('rejects register when game name already exists', async () => {
    const res = await request(app)
      .post('/auth/register')
      .send({
        name: 'Another Admin',
        gameName: 'player',
        email: 'new-admin@myxi.local',
        password: 'pass1234',
        securityAnswers: securityAnswersFor('player'),
      })
    expect(res.status).toBe(409)
    expect((res.body.message || '').toLowerCase()).toContain('already exists')
  })

  it('master admin can login and receive token', { timeout: 15000 }, async () => {
    const res = await request(app).post('/auth/login').send({
      email: 'admin@myxi.local',
      password: 'change-me',
    })
    expect(res.status).toBe(200)
    expect(res.body.token).toBeTruthy()
    expect(res.body.tokenExpiresAt).toBeTruthy()
    expect(res.body.email).toBe('admin@myxi.local')
    expect(res.body.location).toBeDefined()
  })

  it('refreshes session for authenticated users', async () => {
    const login = await request(app).post('/auth/login').send({
      email: 'admin@myxi.local',
      password: 'change-me',
    })
    expect(login.status).toBe(200)
    const refresh = await request(app)
      .post('/auth/refresh')
      .set('Authorization', `Bearer ${login.body.token}`)
    expect(refresh.status).toBe(200)
    expect(refresh.body.ok).toBe(true)
    expect(refresh.body.token).toBeTruthy()
    expect(Number(refresh.body.tokenExpiresAt || 0)).toBeGreaterThan(0)
  })

  it('allows authenticated user to change password', async () => {
    const login = await request(app).post('/auth/login').send({
      userId: 'player',
      password: 'demo123',
    })
    expect(login.status).toBe(200)

    const change = await request(app)
      .post('/auth/change-password')
      .set('Authorization', `Bearer ${login.body.token}`)
      .send({
        currentPassword: 'demo123',
        newPassword: 'demo1234',
      })
    expect(change.status).toBe(200)
    expect(change.body.ok).toBe(true)

    const oldLogin = await request(app).post('/auth/login').send({
      userId: 'player',
      password: 'demo123',
    })
    expect(oldLogin.status).toBe(401)

    const newLogin = await request(app).post('/auth/login').send({
      userId: 'player',
      password: 'demo1234',
    })
    expect(newLogin.status).toBe(200)
  })

  it('approves a user then allows login', async () => {
    const reg = await request(app)
      .post('/auth/register')
      .send({
        name: 'User Two',
        gameName: 'UserTwo',
        email: 'user2@myxi.local',
        password: 'pass1234',
        securityAnswers: securityAnswersFor('usertwo'),
      })
    const token = await loginMaster()
    const approve = await request(app)
      .post('/auth/approve-user')
      .set('Authorization', `Bearer ${token}`)
      .send({ userId: reg.body.id, status: 'active' })
    expect(approve.status).toBe(200)

    const login = await request(app).post('/auth/login').send({
      email: 'user2@myxi.local',
      password: 'pass1234',
    })
    expect(login.status).toBe(200)
    expect(login.body.token).toBeTruthy()
  })

  it('master admin can delete a user', async () => {
    const reg = await request(app)
      .post('/auth/register')
      .send({
        name: 'User Three',
        gameName: 'UserThree',
        email: 'user3@myxi.local',
        password: 'pass1234',
        securityAnswers: securityAnswersFor('userthree'),
      })
    const token = await loginMaster()
    const del = await request(app)
      .delete(`/admin/users/${reg.body.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ actorUserId: 'master' })
    expect(del.status).toBe(200)
    expect(del.body.ok).toBe(true)
    expect(del.body.removedId).toBe(Number(reg.body.id))
  })

  it('supports forgot password and reset password flow', async () => {
    const registerRes = await request(app)
      .post('/auth/register')
      .send({
        name: 'Reset User',
        gameName: 'resetuser',
        email: 'reset@myxi.local',
        password: 'oldpass123',
        securityAnswers: securityAnswersFor('resetuser'),
      })
    expect(registerRes.status).toBe(201)

    const forgotRes = await request(app).post('/auth/forgot-password').send({
      userId: 'resetuser',
    })
    expect(forgotRes.status).toBe(200)
    expect(forgotRes.body.ok).toBe(true)
    expect(Array.isArray(forgotRes.body.questions)).toBe(true)
    expect(forgotRes.body.questions.length).toBe(3)

    const invalidReset = await request(app)
      .post('/auth/reset-password')
      .send({
        userId: 'resetuser',
        answers: ['wrong-1', 'wrong-2', 'wrong-3'],
        newPassword: 'newpass123',
      })
    expect(invalidReset.status).toBe(401)

    const resetRes = await request(app)
      .post('/auth/reset-password')
      .send({
        userId: 'resetuser',
        answers: securityAnswersFor('resetuser'),
        newPassword: 'newpass123',
      })
    expect(resetRes.status).toBe(200)
    expect(resetRes.body.ok).toBe(true)

    const oldLogin = await request(app).post('/auth/login').send({
      userId: 'resetuser',
      password: 'oldpass123',
    })
    expect(oldLogin.status).toBe(401)

    const newLogin = await request(app).post('/auth/login').send({
      userId: 'resetuser',
      password: 'newpass123',
    })
    expect(newLogin.status).toBe(403)
    expect((newLogin.body.message || '').toLowerCase()).toContain('not approved')

    const token = await loginMaster()
    const approve = await request(app)
      .post('/auth/approve-user')
      .set('Authorization', `Bearer ${token}`)
      .send({ userId: registerRes.body.id, status: 'active' })
    expect(approve.status).toBe(200)

    const approvedLogin = await request(app).post('/auth/login').send({
      userId: 'resetuser',
      password: 'newpass123',
    })
    expect(approvedLogin.status).toBe(200)
  })

  it('blocks pending users from login until approved', async () => {
    const reg = await request(app)
      .post('/auth/register')
      .send({
        name: 'Pending User',
        gameName: 'pendinguser',
        email: 'pending@myxi.local',
        password: 'pass1234',
        securityAnswers: securityAnswersFor('pendinguser'),
      })
    expect(reg.status).toBe(201)

    const pendingLogin = await request(app).post('/auth/login').send({
      userId: 'pendinguser',
      password: 'pass1234',
    })
    expect(pendingLogin.status).toBe(403)
    expect((pendingLogin.body.message || '').toLowerCase()).toContain('not approved')

    const token = await loginMaster()
    const approve = await request(app)
      .post('/auth/approve-user')
      .set('Authorization', `Bearer ${token}`)
      .send({ userId: reg.body.id, status: 'active' })
    expect(approve.status).toBe(200)

    const approvedLogin = await request(app).post('/auth/login').send({
      userId: 'pendinguser',
      password: 'pass1234',
    })
    expect(approvedLogin.status).toBe(200)
  })
})

describe('role flows', () => {
  it('master flow: login repairs stale role and can access admin users', async () => {
    const masterUser = users.find((user) => user.gameName === 'master')
    expect(masterUser).toBeTruthy()
    masterUser.role = 'user'

    const login = await loginBy('master')
    expect(login.status).toBe(200)
    expect(login.body.role).toBe('master_admin')

    const usersRes = await request(app)
      .get('/admin/users')
      .set('Authorization', `Bearer ${login.body.token}`)
    expect(usersRes.status).toBe(200)
  })

  it('admin flow: login has admin role and cannot delete users', async () => {
    const login = await loginBy('rahulxi')
    expect(login.status).toBe(200)
    expect(login.body.role).toBe('admin')

    const listRes = await request(app)
      .get('/admin/users')
      .set('Authorization', `Bearer ${login.body.token}`)
    expect(listRes.status).toBe(200)

    const deleteRes = await request(app)
      .delete('/admin/users/1003')
      .set('Authorization', `Bearer ${login.body.token}`)
      .send({ actorUserId: 'rahulxi' })
    expect(deleteRes.status).toBe(403)
  })

  it('default/player flow: aliases normalize to user and block admin routes', async () => {
    const playerUser = users.find((user) => user.gameName === 'player')
    expect(playerUser).toBeTruthy()
    playerUser.role = 'default'

    const login = await loginBy('player')
    expect(login.status).toBe(200)
    expect(login.body.role).toBe('user')

    const usersRes = await request(app)
      .get('/admin/users')
      .set('Authorization', `Bearer ${login.body.token}`)
    expect(usersRes.status).toBe(200)

    const deleteRes = await request(app)
      .delete('/admin/users/1003')
      .set('Authorization', `Bearer ${login.body.token}`)
      .send({ actorUserId: 'player' })
    expect(deleteRes.status).toBe(403)
  })

  it('contest-admin flow: contest manager can save scores for assigned contest only', async () => {
    const login = await loginBy('contestmgr')
    expect(login.status).toBe(200)
    expect(login.body.role).toBe('contest_manager')
    expect(login.body.contestManagerContestId).toBeTruthy()

    const assignedContestId = login.body.contestManagerContestId
    const okRes = await request(app)
      .post('/admin/match-scores/upsert')
      .send({
        tournamentId: 't20wc-2026',
        contestId: assignedContestId,
        matchId: 'm1',
        userId: 'contestmgr',
        playerStats: [{ playerName: 'Suryakumar Yadav', runs: 22 }],
      })
    expect(okRes.status).toBe(200)
    expect(okRes.body.ok).toBe(true)

    const forbiddenRes = await request(app)
      .post('/admin/match-scores/upsert')
      .send({
        tournamentId: 't20wc-2026',
        contestId: 'wc-super-six',
        matchId: 'm1',
        userId: 'contestmgr',
        playerStats: [{ playerName: 'Suryakumar Yadav', runs: 22 }],
      })
    expect(forbiddenRes.status).toBe(403)
  }, 60000)
})
