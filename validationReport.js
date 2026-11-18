import { validateDFA } from './engine.js'

const suggestions = {
  'no-states': 'Add at least one state to the designer canvas.',
  'missing-initial-state': 'Select a state and mark it as the initial state.',
  'invalid-initial-state': 'Choose an existing state as the initial state.',
  'invalid-states': 'Recreate the malformed state data using the designer.',
  'invalid-alphabet': 'Edit the alphabet so it contains valid symbols.',
  'empty-alphabet': 'Add at least one symbol to the alphabet editor.',
  'duplicate-symbol': 'Remove duplicate symbols from the alphabet.',
  'invalid-symbol': 'Use exactly one Unicode code point per alphabet symbol.',
  'invalid-transition-source': 'Reconnect this transition from an existing state.',
  'invalid-transition-destination': 'Reconnect this transition to an existing state.',
  'invalid-transition-symbol': 'Change the transition symbol to one in the alphabet.',
  'missing-transition': 'Add a transition for this state and input symbol, or complete the DFA.',
  'duplicate-transition': 'Keep only one transition for each source state and input symbol.',
  'invalid-final-state': 'Remove the invalid final state or add that state to the DFA.',
  'duplicate-final-state': 'Remove duplicate final-state entries.',
  'invalid-transition-id': 'Recreate the transition so it has a unique ID.',
  'duplicate-transition-id': 'Recreate transitions with unique IDs.',
  'duplicate-state-id': 'Recreate states so each state has a unique ID.',
}

function affectedDetails(error, dfa) {
  if (error.code === 'missing-transition' || error.code === 'duplicate-transition') {
    const match = error.message.match(/from "([^"]+)" on "([^"]+)"/)
    if (match) return { state: match[1], symbol: match[2] }
  }
  if (error.code === 'invalid-transition-source') {
    return { state: error.message.match(/source "([^"]+)"/)?.[1] ?? null }
  }
  if (error.code === 'invalid-transition-destination') {
    return { state: error.message.match(/destination "([^"]+)"/)?.[1] ?? null }
  }
  if (error.code === 'invalid-transition-symbol') {
    return { symbol: error.message.match(/symbol "([^"]+)"/)?.[1] ?? null }
  }
  if (error.code === 'invalid-final-state') {
    return { state: error.message.match(/Final state "([^"]+)"/)?.[1] ?? null }
  }
  if (error.code === 'invalid-initial-state') return { state: dfa?.initialState ?? null }
  if (error.code === 'duplicate-symbol') {
    return { symbol: error.message.match(/symbol "([^"]+)"/)?.[1] ?? null }
  }
  return {}
}

export function getValidationReport(dfa) {
  const validation = validateDFA(dfa)
  const errors = [...validation.errors]
  if (Array.isArray(dfa?.alphabet) && dfa.alphabet.length === 0) {
    errors.push({
      code: 'empty-alphabet',
      message: 'The alphabet must contain at least one symbol.',
    })
  }
  const warnings = Array.isArray(dfa?.states) &&
    Array.isArray(dfa?.finalStates) &&
    dfa.states.length > 0 &&
    dfa.finalStates.length === 0
    ? [{
        code: 'no-final-states',
        message: 'No states are marked final, so no input string will be accepted.',
        suggestion: 'Mark one or more states as final if the DFA should accept strings.',
      }]
    : []

  return {
    valid: errors.length === 0,
    errorCount: errors.length,
    warningCount: warnings.length,
    errors: errors.map((error) => ({
      ...error,
      ...affectedDetails(error, dfa),
      suggestion: suggestions[error.code] ?? 'Review the DFA definition and correct this entry.',
    })),
    warnings,
  }
}
