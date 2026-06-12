import express from 'express'

const router = express.Router()

const PYTHON_ANALYZE_URL = process.env.PYTHON_VISION_URL || 'http://127.0.0.1:8000/analyze'

router.post('/', async (req, res, next) => {
  try {
    const { image } = req.body
    if (!image) return res.status(400).json({ error: 'Missing image (base64) in request body' })

    // Forward base64 JSON to Python analyze endpoint
    const resp = await fetch(PYTHON_ANALYZE_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ image }),
    })

    if (!resp.ok) {
      const text = await resp.text()
      return res.status(502).json({ error: 'Python service error', details: text })
    }

    const json = await resp.json()
    return res.json(json)
  } catch (err) {
    next(err)
  }
})

export default router
