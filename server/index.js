/**
 * server/index.js
 *
 * Backend API server for Opptra Discount Engine.
 * Provides secure endpoints for LLM rule interpretation and health monitoring.
 */

import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'
import { fileURLToPath } from 'url'
import ruleRoutes from './routes/ruleRoutes.js'

dotenv.config()

export const app = express()
const PORT = process.env.PORT || 3001

// Middleware
app.use(cors())
app.use(express.json({ limit: '10kb' })) // Request size protection

// Healthcheck endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'discount-engine-backend',
    provider: process.env.LLM_PROVIDER || 'gemini',
    hasKey: Boolean(process.env.GEMINI_API_KEY || process.env.OPENAI_API_KEY),
  })
})

// Root info route when accessing backend directly
app.get('/', (req, res) => {
  res.type('html').send(`
    <html>
      <body style="font-family: Arial, sans-serif; padding: 2rem; background: #f7f7f9; color: #131A48;">
        <h2>Opptra Discount Engine — Backend API</h2>
        <p>API gateway is running.</p>
        <p>Open the frontend application at: <a href="http://localhost:5173">http://localhost:5173</a></p>
      </body>
    </html>
  `)
})

// Routes
app.use('/api/rules', ruleRoutes)

// Fallback 404 handler for API routes (delegates non-API routes to next middleware)
app.use((req, res, next) => {
  if (req.path.startsWith('/api')) {
    return res.status(404).json({ status: 'error', message: `Route ${req.method} ${req.path} not found.` })
  }
  next()
})

// Start server ONLY when executed directly as entrypoint, not when imported in tests
const isMain = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]
if (isMain) {
  app.listen(PORT, () => {
    console.log(`[Opptra Backend] Running on http://localhost:${PORT}`)
  })
}
