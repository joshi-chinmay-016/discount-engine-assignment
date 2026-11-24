/**
 * ruleRoutes.js
 *
 * Express route handler for natural language rule interpretation.
 */

import { Router } from 'express'
import { interpretDiscountInstruction } from '../services/llmRuleParser.js'

const router = Router()

/**
 * POST /api/rules/interpret
 * Body: { instruction: string }
 */
router.post('/interpret', async (req, res) => {
  const { instruction } = req.body || {}

  if (!instruction || typeof instruction !== 'string' || instruction.trim() === '') {
    return res.status(400).json({
      status: 'error',
      message: 'Request body must contain a non-empty "instruction" string.',
    })
  }

  try {
    const result = await interpretDiscountInstruction(instruction)

    if (result.status === 'success') {
      return res.status(200).json(result)
    }

    if (result.status === 'needs_clarification') {
      return res.status(200).json(result)
    }

    return res.status(422).json(result)
  } catch (err) {
    return res.status(500).json({
      status: 'error',
      message: 'Internal server error while processing discount instruction.',
    })
  }
})

export default router
