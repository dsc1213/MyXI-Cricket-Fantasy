import dotenv from 'dotenv'
import { app } from './server.js'

dotenv.config()

const port = process.env.PORT || 4000

app.listen(port, () => {
  console.log(`API listening on ${port}`)
})
