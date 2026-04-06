import dotenv from 'dotenv'
import { app } from './server.js'

dotenv.config()

const PORT = process.env.PORT || 4000

app.listen(PORT, () => {
  console.log(`API listening on ${PORT}`)
})
