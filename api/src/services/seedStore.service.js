import { flowSeedMatchScores, mockUsers as seedUsers } from '../../mocks/mockData.js'

const getSeedUsers = () => seedUsers
const getSeedMatchScores = () => flowSeedMatchScores || []

export { getSeedUsers, getSeedMatchScores }
