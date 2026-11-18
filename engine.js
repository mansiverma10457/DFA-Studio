let fallbackId = 0

function createId(prefix) {
  const uuid = globalThis.crypto?.randomUUID?.()
  if (uuid) return `${prefix}-${uuid}`
  fallbackId += 1
  return `${prefix}-${Date.now().toString(36)}-${fallbackId.toString(36)}`
}

function assertDFA(dfa) {
  if (!dfa || typeof dfa !== 'object' || Array.isArray(dfa)) {
    throw new TypeError('Expected a DFA object.')
  }
}

function requireState(dfa, stateId) {
  const state = Array.isArray(dfa.states)
    ? dfa.states.find((candidate) => candidate?.id === stateId)
    : undefined
  if (!state) throw new Error(`Unknown state: ${String(stateId)}.`)
  return state
}

function requireTransition(dfa, transitionId) {
  const transition = Array.isArray(dfa.transitions)
    ? dfa.transitions.find((candidate) => candidate?.id === transitionId)
    : undefined
  if (!transition) throw new Error(`Unknown transition: ${String(transitionId)}.`)
  return transition
}

function validateTransitionEndpoints(dfa, from, symbol, to) {
  requireState(dfa, from)
  requireState(dfa, to)
  if (!Array.isArray(dfa.alphabet) || !dfa.alphabet.includes(symbol)) {
    throw new Error(`Symbol ${String(symbol)} is not in the DFA alphabet.`)
  }
}

// A DFA has at most one outgoing transition for each (state, symbol) pair.
function findTransition(dfa, stateId, symbol) {
  const matches = dfa.transitions.filter(
    (transition) => transition.from === stateId && transition.symbol === symbol,
  )
  if (matches.length > 1) {
    throw new Error(`DFA has duplicate transitions from "${stateId}" on "${symbol}".`)
  }
  return matches[0] ?? null
}

function isSingleCodePoint(symbol) {
  return typeof symbol === 'string' && Array.from(symbol).length === 1
}

export function createDFA({
  id = createId('dfa'),
  name = 'Untitled DFA',
  states = [],
  alphabet = [],
  initialState = null,
  finalStates = [],
  transitions = [],
  positions = {},
} = {}) {
  return {
    id,
    name,
    states: Array.isArray(states) ? states.map((state) => ({ ...state })) : states,
    alphabet: Array.isArray(alphabet) ? [...alphabet] : alphabet,
    initialState,
    finalStates: Array.isArray(finalStates) ? [...finalStates] : finalStates,
    transitions: Array.isArray(transitions)
      ? transitions.map((transition) => ({ ...transition }))
      : transitions,
    positions: positions && typeof positions === 'object' ? { ...positions } : positions,
  }
}

export function addState(dfa, name = `q${dfa?.states?.length ?? 0}`, { id, position } = {}) {
  assertDFA(dfa)
  if (!Array.isArray(dfa.states)) throw new TypeError('DFA states must be an array.')
  const stateId = id ?? createId('state')
  if (dfa.states.some((state) => state?.id === stateId)) {
    throw new Error(`State ID "${stateId}" already exists.`)
  }
  if (typeof name !== 'string' || name.trim() === '') {
    throw new TypeError('State name must be a non-empty string.')
  }

  const positions = { ...dfa.positions }
  if (position !== undefined) positions[stateId] = { ...position }

  return {
    ...dfa,
    states: [...dfa.states, { id: stateId, name }],
    positions,
  }
}

export function removeState(dfa, stateId) {
  assertDFA(dfa)
  requireState(dfa, stateId)
  const positions = { ...dfa.positions }
  delete positions[stateId]
  return {
    ...dfa,
    states: dfa.states.filter((state) => state.id !== stateId),
    initialState: dfa.initialState === stateId ? null : dfa.initialState,
    finalStates: dfa.finalStates.filter((id) => id !== stateId),
    transitions: dfa.transitions.filter(
      (transition) => transition.from !== stateId && transition.to !== stateId,
    ),
    positions,
  }
}

export function renameState(dfa, stateId, name) {
  assertDFA(dfa)
  requireState(dfa, stateId)
  if (typeof name !== 'string' || name.trim() === '') {
    throw new TypeError('State name must be a non-empty string.')
  }
  return {
    ...dfa,
    states: dfa.states.map((state) => (state.id === stateId ? { ...state, name } : state)),
  }
}

export function setInitialState(dfa, stateId) {
  assertDFA(dfa)
  requireState(dfa, stateId)
  return { ...dfa, initialState: stateId }
}

export function toggleFinalState(dfa, stateId) {
  assertDFA(dfa)
  requireState(dfa, stateId)
  const isFinal = dfa.finalStates.includes(stateId)
  return {
    ...dfa,
    finalStates: isFinal
      ? dfa.finalStates.filter((id) => id !== stateId)
      : [...dfa.finalStates, stateId],
  }
}

export function addTransition(dfa, { id, from, symbol, to } = {}) {
  assertDFA(dfa)
  if (!Array.isArray(dfa.transitions)) throw new TypeError('DFA transitions must be an array.')
  validateTransitionEndpoints(dfa, from, symbol, to)
  if (findTransition(dfa, from, symbol)) {
    throw new Error(`A transition from "${from}" on "${symbol}" already exists.`)
  }
  const transitionId = id ?? createId('transition')
  if (dfa.transitions.some((transition) => transition?.id === transitionId)) {
    throw new Error(`Transition ID "${transitionId}" already exists.`)
  }
  return {
    ...dfa,
    transitions: [...dfa.transitions, { id: transitionId, from, symbol, to }],
  }
}

export function updateTransition(dfa, transitionId, updates = {}) {
  assertDFA(dfa)
  const current = requireTransition(dfa, transitionId)
  const updated = { ...current, ...updates, id: current.id }
  validateTransitionEndpoints(dfa, updated.from, updated.symbol, updated.to)
  const conflicting = dfa.transitions.some(
    (transition) =>
      transition.id !== transitionId &&
      transition.from === updated.from &&
      transition.symbol === updated.symbol,
  )
  if (conflicting) {
    throw new Error(`A transition from "${updated.from}" on "${updated.symbol}" already exists.`)
  }
  return {
    ...dfa,
    transitions: dfa.transitions.map((transition) =>
      transition.id === transitionId ? updated : transition,
    ),
  }
}

export function removeTransition(dfa, transitionId) {
  assertDFA(dfa)
  requireTransition(dfa, transitionId)
  return {
    ...dfa,
    transitions: dfa.transitions.filter((transition) => transition.id !== transitionId),
  }
}

export function getNextState(dfa, stateId, symbol) {
  assertDFA(dfa)
  requireState(dfa, stateId)
  if (!Array.isArray(dfa.alphabet) || !dfa.alphabet.includes(symbol)) {
    throw new Error(`Symbol ${String(symbol)} is not in the DFA alphabet.`)
  }
  return findTransition(dfa, stateId, symbol)?.to ?? null
}

export function getTransitionTable(dfa) {
  assertDFA(dfa)
  if (!Array.isArray(dfa.states) || !Array.isArray(dfa.alphabet)) {
    throw new TypeError('DFA states and alphabet must be arrays.')
  }
  return dfa.states.map((state) => ({
    stateId: state.id,
    stateName: state.name,
    isInitial: state.id === dfa.initialState,
    isFinal: Array.isArray(dfa.finalStates) && dfa.finalStates.includes(state.id),
    transitions: Object.fromEntries(
      dfa.alphabet.map((symbol) => [
        symbol,
        findTransition(dfa, state.id, symbol)?.to ?? null,
      ]),
    ),
  }))
}

export function validateDFA(dfa) {
  const errors = []
  if (!dfa || typeof dfa !== 'object' || Array.isArray(dfa)) {
    return {
      valid: false,
      errors: [{ code: 'invalid-dfa', message: 'Expected a DFA object.' }],
    }
  }

  if (typeof dfa.id !== 'string' || dfa.id.trim() === '') {
    errors.push({ code: 'invalid-id', message: 'DFA must have a non-empty ID.' })
  }
  if (typeof dfa.name !== 'string' || dfa.name.trim() === '') {
    errors.push({ code: 'invalid-name', message: 'DFA must have a non-empty name.' })
  }

  const states = Array.isArray(dfa.states) ? dfa.states : []
  const alphabet = Array.isArray(dfa.alphabet) ? dfa.alphabet : []
  const transitions = Array.isArray(dfa.transitions) ? dfa.transitions : []
  const finalStates = Array.isArray(dfa.finalStates) ? dfa.finalStates : []
  if (!Array.isArray(dfa.states)) errors.push({ code: 'invalid-states', message: 'States must be an array.' })
  if (states.length === 0) errors.push({ code: 'no-states', message: 'A DFA must have at least one state.' })
  if (!Array.isArray(dfa.alphabet)) errors.push({ code: 'invalid-alphabet', message: 'Alphabet must be an array.' })
  if (!Array.isArray(dfa.transitions)) errors.push({ code: 'invalid-transitions', message: 'Transitions must be an array.' })
  if (!Array.isArray(dfa.finalStates)) errors.push({ code: 'invalid-final-states', message: 'Final states must be an array.' })

  const stateIds = new Set()
  const validStateIds = new Set()
  for (const state of states) {
    if (!state || typeof state !== 'object' || typeof state.id !== 'string' || state.id.trim() === '') {
      errors.push({ code: 'invalid-state', message: 'Every state must have a non-empty string ID.' })
      continue
    }
    if (stateIds.has(state.id)) {
      errors.push({ code: 'duplicate-state-id', message: `State ID "${state.id}" is duplicated.` })
    } else {
      stateIds.add(state.id)
      validStateIds.add(state.id)
    }
  }

  const alphabetSymbols = new Set()
  for (const symbol of alphabet) {
    if (!isSingleCodePoint(symbol)) {
      errors.push({ code: 'invalid-symbol', message: 'Every alphabet symbol must be one non-empty Unicode code point.' })
    } else if (alphabetSymbols.has(symbol)) {
      errors.push({ code: 'duplicate-symbol', message: `Alphabet symbol "${symbol}" is duplicated.` })
    } else {
      alphabetSymbols.add(symbol)
    }
  }

  if (dfa.initialState === null || dfa.initialState === undefined) {
    errors.push({ code: 'missing-initial-state', message: 'A DFA must have exactly one initial state.' })
  } else if (typeof dfa.initialState !== 'string' || !validStateIds.has(dfa.initialState)) {
    errors.push({ code: 'invalid-initial-state', message: 'Initial state must reference a state in the DFA.' })
  }

  const seenFinalStates = new Set()
  for (const stateId of finalStates) {
    if (!validStateIds.has(stateId)) {
      errors.push({ code: 'invalid-final-state', message: `Final state "${String(stateId)}" does not exist.` })
    } else if (seenFinalStates.has(stateId)) {
      errors.push({ code: 'duplicate-final-state', message: `Final state "${stateId}" is duplicated.` })
    } else {
      seenFinalStates.add(stateId)
    }
  }

  const transitionIds = new Set()
  const transitionPairs = new Set()
  for (const transition of transitions) {
    if (!transition || typeof transition !== 'object') {
      errors.push({ code: 'invalid-transition', message: 'Every transition must be an object.' })
      continue
    }
    if (typeof transition.id !== 'string' || transition.id.trim() === '') {
      errors.push({ code: 'invalid-transition-id', message: 'Every transition must have a non-empty string ID.' })
    } else if (transitionIds.has(transition.id)) {
      errors.push({ code: 'duplicate-transition-id', message: `Transition ID "${transition.id}" is duplicated.` })
    } else {
      transitionIds.add(transition.id)
    }
    if (!validStateIds.has(transition.from)) {
      errors.push({ code: 'invalid-transition-source', message: `Transition source "${String(transition.from)}" does not exist.` })
    }
    if (!validStateIds.has(transition.to)) {
      errors.push({ code: 'invalid-transition-destination', message: `Transition destination "${String(transition.to)}" does not exist.` })
    }
    if (!alphabetSymbols.has(transition.symbol)) {
      errors.push({ code: 'invalid-transition-symbol', message: `Transition symbol "${String(transition.symbol)}" is not in the alphabet.` })
    }
    if (typeof transition.from === 'string' && typeof transition.symbol === 'string') {
      const pair = JSON.stringify([transition.from, transition.symbol])
      if (transitionPairs.has(pair)) {
        errors.push({
          code: 'duplicate-transition',
          message: `More than one transition exists from "${transition.from}" on "${transition.symbol}".`,
        })
      } else {
        transitionPairs.add(pair)
      }
    }
  }

  // A complete DFA defines one transition for every state/alphabet-symbol pair.
  // Missing pairs are reported; they are not silently redirected to a trap state.
  for (const stateId of validStateIds) {
    for (const symbol of alphabetSymbols) {
      if (!transitionPairs.has(JSON.stringify([stateId, symbol]))) {
        errors.push({
          code: 'missing-transition',
          message: `Missing transition from "${stateId}" on "${symbol}".`,
        })
      }
    }
  }

  return { valid: errors.length === 0, errors }
}

export function simulateDFA(dfa, input) {
  const validation = validateDFA(dfa)
  const errors = validation.errors.filter((error) => error.code !== 'missing-transition')
  if (errors.length > 0) {
    return {
      accepted: false,
      status: 'invalid-dfa',
      history: [],
      finalState: null,
      errors,
    }
  }
  if (typeof input !== 'string') {
    return {
      accepted: false,
      status: 'invalid-input',
      history: [],
      finalState: dfa.initialState ?? null,
      errors: [{ code: 'invalid-input', message: 'Input must be a string.' }],
    }
  }

  // The initial configuration is recorded before consuming input. For the empty
  // string, this remains the final configuration and acceptance depends on it.
  let currentState = dfa.initialState
  const history = [{ index: 0, symbol: null, from: null, to: currentState }]
  const symbols = Array.from(input)

  for (let index = 0; index < symbols.length; index += 1) {
    const symbol = symbols[index]
    if (!dfa.alphabet.includes(symbol)) {
      return {
        accepted: false,
        status: 'invalid-symbol',
        history,
        finalState: currentState,
        errors: [{
          code: 'invalid-symbol',
          message: `Input symbol "${symbol}" at index ${index} is not in the DFA alphabet.`,
        }],
      }
    }

    const transition = findTransition(dfa, currentState, symbol)
    if (!transition) {
      return {
        accepted: false,
        status: 'missing-transition',
        history,
        finalState: currentState,
        errors: [{
          code: 'missing-transition',
          message: `No transition exists from "${currentState}" on "${symbol}" at index ${index}.`,
        }],
      }
    }

    history.push({ index: index + 1, symbol, from: currentState, to: transition.to })
    currentState = transition.to
  }

  const accepted = dfa.finalStates.includes(currentState)
  return {
    accepted,
    status: accepted ? 'accepted' : 'rejected',
    history,
    finalState: currentState,
    errors: [],
  }
}

export function completeDFA(dfa) {
  assertDFA(dfa)
  const validation = validateDFA(dfa)
  const blockingErrors = validation.errors.filter((error) => error.code !== 'missing-transition')
  if (blockingErrors.length > 0) {
    throw new Error(`Cannot complete an invalid DFA: ${blockingErrors.map((error) => error.message).join(' ')}`)
  }

  // Completion is explicit: collect every undefined transition before adding
  // one non-accepting dead state to receive those transitions.
  const missing = []
  for (const state of dfa.states) {
    for (const symbol of dfa.alphabet) {
      if (!findTransition(dfa, state.id, symbol)) missing.push({ from: state.id, symbol })
    }
  }
  if (missing.length === 0) return createDFA(dfa)

  let deadStateId = createId('state-dead')
  const stateIds = new Set(dfa.states.map((state) => state.id))
  while (stateIds.has(deadStateId)) deadStateId = createId('state-dead')
  const usedNames = new Set(dfa.states.map((state) => state.name))
  let deadStateName = 'Dead state'
  let suffix = 2
  while (usedNames.has(deadStateName)) {
    deadStateName = `Dead state ${suffix}`
    suffix += 1
  }

  let completed = {
    ...createDFA(dfa),
    states: [...dfa.states.map((state) => ({ ...state })), { id: deadStateId, name: deadStateName }],
    positions: { ...dfa.positions },
  }
  const missingPairs = new Set(missing.map(({ from, symbol }) => JSON.stringify([from, symbol])))
  for (const state of dfa.states) {
    for (const symbol of dfa.alphabet) {
      if (missingPairs.has(JSON.stringify([state.id, symbol]))) {
        completed = addTransition(completed, { from: state.id, symbol, to: deadStateId })
      }
    }
  }
  for (const symbol of dfa.alphabet) {
    completed = addTransition(completed, { from: deadStateId, symbol, to: deadStateId })
  }
  return completed
}
