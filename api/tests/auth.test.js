import { beforeAll, beforeEach, describe, expect, it } from 'vitest'
import request from 'supertest'

let app
let resetStore

beforeAll(async () => {
  process.env.NODE_ENV = 'test'
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

describe('auth', () => {
  it('registers a user as pending', async () => {
    const res = await request(app).post('/auth/register').send({
      name: 'Test User',
      gameName: 'TestXI',
      email: 'user@myxi.local',
      password: 'pass1234',
    })
    expect(res.status).toBe(201)
    expect(res.body.status).toBe('pending')
  })

  it('master admin can login and receive token', async () => {
    const res = await request(app).post('/auth/login').send({
      email: 'admin@myxi.local',
      password: 'change-me',
    })
    expect(res.status).toBe(200)
    expect(res.body.token).toBeTruthy()
  })

  it('approves a user then allows login', async () => {
    const reg = await request(app).post('/auth/register').send({
      name: 'User Two',
      gameName: 'UserTwo',
      email: 'user2@myxi.local',
      password: 'pass1234',
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
    const reg = await request(app).post('/auth/register').send({
      name: 'User Three',
      gameName: 'UserThree',
      email: 'user3@myxi.local',
      password: 'pass1234',
    })
    const token = await loginMaster()
    const del = await request(app)
      .delete(`/users/${reg.body.id}`)
      .set('Authorization', `Bearer ${token}`)
    expect(del.status).toBe(200)
    expect(del.body.deleted).toBe(true)
  })
})
