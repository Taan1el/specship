import 'dotenv/config'
import { createApp } from './app.js'
import {
  createMemorySpecStore,
  createPostgresSpecStore,
} from './specStore.js'

const port = Number(process.env.PORT ?? 4175)
const store = process.env.DATABASE_URL
  ? createPostgresSpecStore(process.env.DATABASE_URL)
  : createMemorySpecStore()

createApp(store).listen(port, () => {
  console.log(`SpecShip API listening on http://127.0.0.1:${port}`)
})
