import test from 'node:test'
import assert from 'node:assert/strict'

import {
  clearAllAppQueryCache,
  fetchCachedQuery,
  getAppQueryCacheSnapshot,
  invalidateAppQueryCache,
} from '../../src/lib/appQueryCache.js'

test.afterEach(() => {
  clearAllAppQueryCache()
})

test('fetchCachedQuery caches successful results by key', async () => {
  let calls = 0

  const first = await fetchCachedQuery({
    key: 'demo:one',
    loader: async () => {
      calls += 1
      return { ok: true, calls }
    },
  })

  const second = await fetchCachedQuery({
    key: 'demo:one',
    loader: async () => {
      calls += 1
      return { ok: true, calls }
    },
  })

  assert.equal(calls, 1)
  assert.deepEqual(first, { ok: true, calls: 1 })
  assert.deepEqual(second, { ok: true, calls: 1 })
})

test('fetchCachedQuery dedupes in-flight requests for the same key', async () => {
  let calls = 0

  const loader = async () => {
    calls += 1
    await new Promise((resolve) => setTimeout(resolve, 10))
    return { ok: true, calls }
  }

  const [first, second] = await Promise.all([
    fetchCachedQuery({ key: 'demo:pending', loader }),
    fetchCachedQuery({ key: 'demo:pending', loader }),
  ])

  assert.equal(calls, 1)
  assert.deepEqual(first, { ok: true, calls: 1 })
  assert.deepEqual(second, { ok: true, calls: 1 })
})

test('invalidateAppQueryCache removes matching prefix keys', async () => {
  await fetchCachedQuery({
    key: 'matches:2',
    loader: async () => ['m1'],
  })
  await fetchCachedQuery({
    key: 'matches:3',
    loader: async () => ['m2'],
  })

  invalidateAppQueryCache('matches:2')

  const snapshot = getAppQueryCacheSnapshot()
  const keys = snapshot.entries.map((entry) => entry.key)
  assert.deepEqual(keys, ['matches:3'])
})

test('failed lookups stay retryable after invalidation', async () => {
  let calls = 0

  await assert.rejects(() =>
    fetchCachedQuery({
      key: 'demo:error',
      loader: async () => {
        calls += 1
        throw new Error('boom')
      },
    }),
  )

  invalidateAppQueryCache('demo:error')

  const result = await fetchCachedQuery({
    key: 'demo:error',
    loader: async () => {
      calls += 1
      return { ok: true }
    },
  })

  assert.equal(calls, 2)
  assert.deepEqual(result, { ok: true })
})

test('clearAllAppQueryCache removes cached entries so the next lookup refetches', async () => {
  let calls = 0

  const loader = async () => {
    calls += 1
    return { ok: true, calls }
  }

  const first = await fetchCachedQuery({ key: 'demo:clear-all', loader })
  clearAllAppQueryCache()
  const second = await fetchCachedQuery({ key: 'demo:clear-all', loader })

  assert.deepEqual(first, { ok: true, calls: 1 })
  assert.deepEqual(second, { ok: true, calls: 2 })
  assert.equal(calls, 2)
})
