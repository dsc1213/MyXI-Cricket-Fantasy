const shouldLoadMockData = () => {
  const mockApiEnabled =
    (process.env.MOCK_API || '').toString().trim().toLowerCase() === 'true'
  const dbProvider = (process.env.DB_PROVIDER || '').toString().trim().toLowerCase()

  if (mockApiEnabled) return true
  if (dbProvider === 'postgres') return false
  return true
}

let seedUsers = []
let seedMatchScores = []

if (shouldLoadMockData()) {
  try {
    const module = await import('../../mocks/mockData.js')
    seedUsers = module?.mockUsers || []
    seedMatchScores = module?.flowSeedMatchScores || []
  } catch (error) {
    const message = error?.message || 'Unknown seed mock load error'
    console.warn(`[config] Seed mock data unavailable, using empty seed data: ${message}`)
  }
}

const getSeedUsers = () => seedUsers
const getSeedMatchScores = () => seedMatchScores

export { getSeedUsers, getSeedMatchScores }
