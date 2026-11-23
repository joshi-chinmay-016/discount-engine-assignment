/**
 * csvParser.js
 *
 * Converts raw CSV text into the typed objects the discount engine expects.
 * Uses papaparse for reliable CSV parsing, then maps column names to the
 * internal data shapes.
 *
 * Expected rules.csv columns:
 *   rule_id, scope, applies_to, type, value, stackable
 *
 * Expected cart.csv columns:
 *   item_id, product, brand, platform, base_price
 */

import Papa from 'papaparse'

/**
 * Parses the raw text of rules.csv into an array of DiscountRule objects.
 * Returns { data, errors } where errors is an array of row-level issues.
 */
export function parseRulesCSV(csvText) {
  const cleanedText = (csvText || '').replace(/^\uFEFF/, '').trim()
  const { data: rows, errors: parseErrors } = Papa.parse(cleanedText, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h) => h.trim().toLowerCase().replace(/\s+/g, '_'),
  })

  if (parseErrors.length > 0) {
    return { data: [], errors: parseErrors.map((e) => e.message) }
  }

  const data = []
  const errors = []

  rows.forEach((row, i) => {
    const rowNum = i + 2 // account for header row
    const missing = []

    if (!row.rule_id) missing.push('rule_id')
    if (!row.scope) missing.push('scope')
    if (!row.applies_to) missing.push('applies_to')
    if (!row.type) missing.push('type')
    if (row.value === undefined || row.value === '') missing.push('value')
    if (row.stackable === undefined || row.stackable === '') missing.push('stackable')

    if (missing.length > 0) {
      errors.push(`Row ${rowNum}: missing fields — ${missing.join(', ')}`)
      return
    }

    const scope = row.scope.trim().toLowerCase()
    if (scope !== 'brand' && scope !== 'platform' && scope !== 'cart') {
      errors.push(`Row ${rowNum}: scope must be "brand", "platform", or "cart", got "${row.scope}"`)
      return
    }

    const type = row.type.trim().toLowerCase()
    if (type !== 'percentage' && type !== 'flat') {
      errors.push(`Row ${rowNum}: type must be "percentage" or "flat", got "${row.type}"`)
      return
    }

    const value = parseFloat(row.value)
    if (isNaN(value) || value <= 0) {
      errors.push(`Row ${rowNum}: value must be a positive number, got "${row.value}"`)
      return
    }
    if (type === 'percentage' && value > 100) {
      errors.push(`Row ${rowNum}: percentage value cannot exceed 100%, got "${row.value}"`)
      return
    }

    const stackableStr = row.stackable.trim().toLowerCase()
    const stackable = stackableStr === 'true' || stackableStr === '1' || stackableStr === 'yes'

    // Parse minimum spend threshold for cart rules if specified
    let minSpend = 0
    if (scope === 'cart') {
      if (row.min_spend !== undefined && row.min_spend !== '') {
        minSpend = parseFloat(String(row.min_spend).replace(/,/g, ''))
      } else {
        const appliesToRaw = row.applies_to.trim().toLowerCase()
        if (appliesToRaw !== 'all' && appliesToRaw !== 'cart' && appliesToRaw !== 'total') {
          const match = appliesToRaw.match(/[\d.]+/)
          if (match) {
            minSpend = parseFloat(match[0])
          }
        }
      }
      if (isNaN(minSpend) || minSpend < 0) {
        errors.push(`Row ${rowNum}: invalid minimum spend threshold for cart rule, got "${row.min_spend || row.applies_to}"`)
        return
      }
    }

    data.push({
      ruleId: row.rule_id.trim(),
      scope,
      appliesTo: row.applies_to.trim(),
      type,
      value,
      stackable,
      minSpend,
    })
  })

  return { data, errors }
}

/**
 * Validates and normalizes a single cart row into a CartItem object.
 * Returns { item, error } where either item is a valid CartItem or error is a descriptive string.
 * Shared by both csvParser and pdfParser to guarantee identical validation rules.
 */
export function normalizeCartRow(row, rowNum = null) {
  const prefix = rowNum !== null ? `Row ${rowNum}: ` : ''
  const missing = []

  const itemId = row.item_id ?? row.itemId
  const product = row.product
  const brand = row.brand
  const platform = row.platform
  const rawPrice = row.base_price ?? row.basePrice

  if (!itemId) missing.push('item_id')
  if (!product) missing.push('product')
  if (!brand) missing.push('brand')
  if (!platform) missing.push('platform')
  if (rawPrice === undefined || rawPrice === null || rawPrice === '') missing.push('base_price')

  if (missing.length > 0) {
    return { item: null, error: `${prefix}missing fields — ${missing.join(', ')}` }
  }

  const cleanPriceStr = String(rawPrice).trim().replace(/,/g, '').replace(/^[^\d.]+/, '')
  const basePrice = parseFloat(cleanPriceStr)
  if (isNaN(basePrice) || basePrice <= 0) {
    return { item: null, error: `${prefix}base_price must be a positive number, got "${rawPrice}"` }
  }

  return {
    item: {
      itemId: String(itemId).trim(),
      product: String(product).trim(),
      brand: String(brand).trim(),
      platform: String(platform).trim(),
      basePrice: Math.round(basePrice),
    },
    error: null,
  }
}

/**
 * Parses the raw text of cart.csv into an array of CartItem objects.
 * Returns { data, errors } where errors is an array of row-level issues.
 */
export function parseCartCSV(csvText) {
  const cleanedText = (csvText || '').replace(/^\uFEFF/, '').trim()
  const { data: rows, errors: parseErrors } = Papa.parse(cleanedText, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h) => h.trim().toLowerCase().replace(/\s+/g, '_'),
  })

  if (parseErrors.length > 0) {
    return { data: [], errors: parseErrors.map((e) => e.message) }
  }

  const data = []
  const errors = []

  rows.forEach((row, i) => {
    const rowNum = i + 2
    const { item, error } = normalizeCartRow(row, rowNum)
    if (error) {
      errors.push(error)
      return
    }
    data.push(item)
  })

  return { data, errors }
}
