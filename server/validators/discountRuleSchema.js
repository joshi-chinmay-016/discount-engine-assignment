/**
 * discountRuleSchema.js
 *
 * Independent validator for LLM-interpreted discount rules.
 * Enforces strict domain invariants matching the existing DiscountRule model.
 */

const ALLOWED_SCOPES = ['brand', 'platform', 'cart']
const ALLOWED_TYPES = ['percentage', 'flat']

/**
 * Validates a candidate rule object.
 * Returns { isValid: boolean, rule?: Object, errors?: string[] }
 */
export function validateRuleCandidate(candidate) {
  if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)) {
    return { isValid: false, errors: ['Rule must be a non-null object.'] }
  }

  const errors = []

  // 1. Scope validation
  const scope = typeof candidate.scope === 'string' ? candidate.scope.trim().toLowerCase() : ''
  if (!ALLOWED_SCOPES.includes(scope)) {
    errors.push(`Invalid scope "${candidate.scope}". Must be one of: ${ALLOWED_SCOPES.join(', ')}.`)
  }

  // 2. Type validation
  const type = typeof candidate.type === 'string' ? candidate.type.trim().toLowerCase() : ''
  if (!ALLOWED_TYPES.includes(type)) {
    errors.push(`Invalid discount type "${candidate.type}". Must be "percentage" or "flat".`)
  }

  // 3. Value validation
  const value = candidate.value
  if (typeof value !== 'number' || !Number.isFinite(value) || Number.isNaN(value)) {
    errors.push(`Discount value must be a valid finite number, got "${value}".`)
  } else if (value <= 0) {
    errors.push(`Discount value must be greater than zero, got ${value}.`)
  } else if (type === 'percentage' && value > 100) {
    errors.push(`Percentage discount cannot exceed 100%, got ${value}%.`)
  }

  // 4. Stackable validation
  if (typeof candidate.stackable !== 'boolean') {
    errors.push(`Stackable must be a strict boolean (true or false), got "${candidate.stackable}".`)
  }

  // 5. AppliesTo validation
  let appliesTo = candidate.appliesTo
  if (scope === 'brand' || scope === 'platform') {
    if (!appliesTo || typeof appliesTo !== 'string' || appliesTo.trim() === '') {
      errors.push(`Rule with scope "${scope}" requires a non-empty "appliesTo" target.`)
    } else {
      appliesTo = appliesTo.trim()
    }
  } else if (scope === 'cart') {
    // For cart rules, appliesTo can describe condition or default to "cart"
    appliesTo = typeof appliesTo === 'string' && appliesTo.trim() !== '' ? appliesTo.trim() : 'cart'
  }

  // 6. Minimum spend validation (cart rules or optional condition)
  let minSpend = 0
  if (candidate.minSpend !== undefined && candidate.minSpend !== null) {
    if (typeof candidate.minSpend !== 'number' || !Number.isFinite(candidate.minSpend) || Number.isNaN(candidate.minSpend)) {
      errors.push(`Minimum spend threshold must be a valid number, got "${candidate.minSpend}".`)
    } else if (candidate.minSpend < 0) {
      errors.push(`Minimum spend threshold cannot be negative, got ${candidate.minSpend}.`)
    } else {
      minSpend = Math.round(candidate.minSpend)
    }
  }

  if (errors.length > 0) {
    return { isValid: false, errors }
  }

  return {
    isValid: true,
    rule: {
      scope,
      appliesTo,
      type,
      value: type === 'percentage' ? Number(value.toFixed(2)) : Math.round(value),
      stackable: candidate.stackable,
      minSpend,
    },
  }
}

/**
 * Validates the full structured response from the LLM service.
 */
export function validateLlmResponse(payload) {
  if (!payload || typeof payload !== 'object') {
    return {
      status: 'error',
      message: 'Malformed response received: expected JSON object.',
    }
  }

  // Case 1: Model asks for clarification on ambiguous input
  if (payload.status === 'needs_clarification') {
    const question = typeof payload.question === 'string' ? payload.question.trim() : ''
    if (!question) {
      return {
        status: 'error',
        message: 'Model requested clarification but provided no question.',
      }
    }
    return {
      status: 'needs_clarification',
      question,
    }
  }

  // Case 2: Model successfully produced a rule
  if (payload.status === 'success' || payload.rule) {
    const ruleCandidate = payload.rule || payload
    const validation = validateRuleCandidate(ruleCandidate)

    if (!validation.isValid) {
      return {
        status: 'error',
        message: `Rule validation failed: ${validation.errors.join(' ')}`,
      }
    }

    return {
      status: 'success',
      rule: validation.rule,
      message: payload.message || 'Rule interpreted successfully.',
    }
  }

  // Case 3: Model returned an explicit error or unhandled status
  return {
    status: 'error',
    message: payload.message || 'Unable to interpret the discount instruction into a valid rule.',
  }
}
