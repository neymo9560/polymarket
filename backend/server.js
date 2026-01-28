// Backend ultra-simple pour test Railway
const express = require('express')
const cors = require('cors')

const app = express()
const PORT = process.env.PORT || 3001

app.use(cors())
app.use(express.json())

// Health check simple
app.get('/health', (req, res) => {
  res.json({ status: 'ok', message: 'Backend fonctionne!' })
})

app.get('/', (req, res) => {
  res.json({ status: 'ok' })
})

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`)
})
