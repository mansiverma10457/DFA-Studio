import { simulateDFA } from './engine.js'

export const MAX_BATCH_STRINGS = 1000
export const MAX_RANDOM_STRING_LENGTH = 1000
export const MAX_RANDOM_TOTAL_SYMBOLS = 100000

const errorStatuses = new Set(['invalid-dfa', 'invalid-input', 'invalid-symbol', 'missing-transition'])

export function parseBatchInput(text) {
  if (typeof text !== 'string' || text.length === 0) return []
  const lines = text.split(/\r\n|\n|\r/)
  if (/(?:\r\n|\n|\r)$/.test(text)) lines.pop()
  return lines
}

export function runBatchTests(dfa, inputs) {
  if (!Array.isArray(inputs)) throw new TypeError('Batch inputs must be an array.')
  if (inputs.length > MAX_BATCH_STRINGS) {
    throw new RangeError(`A batch can contain at most ${MAX_BATCH_STRINGS} strings.`)
  }
  return inputs.map((input, index) => {
    const result = simulateDFA(dfa, input)
    const steps = Math.max(0, result.history.length - 1)
    const detail = result.errors.map((error) => error.message).join(' ')
    return {
      id: index,
      input,
      status: result.status,
      finalState: result.finalState,
      steps,
      detail,
      errors: result.errors,
    }
  })
}

export function runSingleTest(dfa, input) {
  return runBatchTests(dfa, [input])[0]
}

export function summarizeBatchResults(results) {
  const summary = results.reduce((totals, result) => {
    if (result.status === 'accepted') totals.accepted += 1
    else if (result.status === 'rejected') totals.rejected += 1
    else if (errorStatuses.has(result.status)) totals.errors += 1
    return totals
  }, { total: results.length, accepted: 0, rejected: 0, errors: 0 })

  return {
    ...summary,
    acceptancePercentage: summary.total === 0
      ? 0
      : Math.round((summary.accepted / summary.total) * 1000) / 10,
  }
}

// Hash the user seed into a deterministic 32-bit starting state for repeatable tests.
function hashSeed(seed) {
  let hash = 2166136261
  for (const character of String(seed)) {
    hash ^= character.codePointAt(0)
    hash = Math.imul(hash, 16777619)
  }
  return hash >>> 0
}

function createSeededRandom(seed) {
  let state = hashSeed(seed)
  return () => {
    state += 0x6D2B79F5
    let value = state
    value = Math.imul(value ^ (value >>> 15), value | 1)
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61)
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296
  }
}

export function generateRandomStrings(
  alphabet,
  { count, minLength, maxLength, seed = '' } = {},
) {
  if (!Array.isArray(alphabet)) throw new TypeError('The DFA alphabet must be an array.')
  if (!Number.isSafeInteger(count) || count < 1 || count > MAX_BATCH_STRINGS) {
    throw new RangeError(`Number of strings must be an integer from 1 to ${MAX_BATCH_STRINGS}.`)
  }
  if (!Number.isSafeInteger(minLength) || minLength < 0 || minLength > MAX_RANDOM_STRING_LENGTH) {
    throw new RangeError(`Minimum length must be an integer from 0 to ${MAX_RANDOM_STRING_LENGTH}.`)
  }
  if (!Number.isSafeInteger(maxLength) || maxLength < 0 || maxLength > MAX_RANDOM_STRING_LENGTH) {
    throw new RangeError(`Maximum length must be an integer from 0 to ${MAX_RANDOM_STRING_LENGTH}.`)
  }
  if (minLength > maxLength) throw new RangeError('Minimum length cannot exceed maximum length.')
  if (count * maxLength > MAX_RANDOM_TOTAL_SYMBOLS) {
    throw new RangeError(
      `The requested generation exceeds the ${MAX_RANDOM_TOTAL_SYMBOLS.toLocaleString()}-symbol safety limit.`,
    )
  }
  if (maxLength > 0 && alphabet.length === 0) {
    throw new Error('Add at least one alphabet symbol to generate non-empty strings.')
  }
  if (alphabet.some((symbol) => typeof symbol !== 'string' || Array.from(symbol).length !== 1)) {
    throw new Error('Every alphabet entry must be exactly one Unicode code point.')
  }

  const random = seed === '' || seed === null || seed === undefined
    ? Math.random
    : createSeededRandom(seed)

  return Array.from({ length: count }, () => {
    const length = minLength + Math.floor(random() * (maxLength - minLength + 1))
    let value = ''
    for (let index = 0; index < length; index += 1) {
      value += alphabet[Math.floor(random() * alphabet.length)]
    }
    return value
  })
}

export function toBatchResultsCsv(results, stateName = (stateId) => stateId ?? '') {
  const escape = (value) => {
    const text = String(value ?? '')
    return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text
  }
  const rows = [
    ['Input String', 'Result', 'Final State', 'Steps', 'Details'],
    ...results.map((result) => [
      result.input,
      result.status,
      result.finalState === null ? '' : stateName(result.finalState),
      result.steps,
      result.detail,
    ]),
  ]
  return rows.map((row) => row.map(escape).join(',')).join('\r\n')
}

export async function copyBatchResults(text, clipboard = globalThis.navigator?.clipboard) {
  if (!clipboard?.writeText) throw new Error('Clipboard access is unavailable in this browser.')
  await clipboard.writeText(text)
}
