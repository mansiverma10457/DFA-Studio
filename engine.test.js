import { describe, expect, it } from 'vitest'
import {
  addState,
  addTransition,
  completeDFA,
  createDFA,
  getNextState,
  getTransitionTable,
  removeState,
  removeTransition,
  renameState,
  setInitialState,
  simulateDFA,
  toggleFinalState,
  updateTransition,
  validateDFA,
} from './engine.js'

function createBinaryDFA() {
  let dfa = createDFA({ id: 'binary', name: 'Binary DFA', alphabet: ['0', '1'] })
  dfa = addState(dfa, 'start', { id: 'q0' })
  dfa = addState(dfa, 'accept', { id: 'q1' })
  dfa = setInitialState(dfa, 'q0')
  dfa = toggleFinalState(dfa, 'q1')
  dfa = addTransition(dfa, { id: 't00', from: 'q0', symbol: '0', to: 'q0' })
  dfa = addTransition(dfa, { id: 't01', from: 'q0', symbol: '1', to: 'q1' })
  dfa = addTransition(dfa, { id: 't10', from: 'q1', symbol: '0', to: 'q0' })
  dfa = addTransition(dfa, { id: 't11', from: 'q1', symbol: '1', to: 'q1' })
  return dfa
}

describe('DFA model operations', () => {
  it('creates the documented model shape with independent collection values', () => {
    const sourceStates = [{ id: 'q0', name: 'start' }]
    const dfa = createDFA({ states: sourceStates, alphabet: ['a'] })

    expect(dfa).toEqual({
      id: expect.any(String),
      name: 'Untitled DFA',
      states: sourceStates,
      alphabet: ['a'],
      initialState: null,
      finalStates: [],
      transitions: [],
      positions: {},
    })
    expect(dfa.states).not.toBe(sourceStates)
  })

  it('adds states with unique IDs and optional position data without mutating input', () => {
    const dfa = createDFA()
    const updated = addState(dfa, 'Start', { id: 'q0', position: { x: 10, y: 20 } })

    expect(updated.states).toEqual([{ id: 'q0', name: 'Start' }])
    expect(updated.positions.q0).toEqual({ x: 10, y: 20 })
    expect(dfa.states).toEqual([])
    expect(() => addState(updated, 'Duplicate', { id: 'q0' })).toThrow(/already exists/)
  })

  it('renames and removes states and dependent data', () => {
    let dfa = createBinaryDFA()
    dfa = renameState(dfa, 'q0', 'Beginning')
    dfa = { ...dfa, positions: { q0: { x: 1, y: 2 } } }
    const updated = removeState(dfa, 'q0')

    expect(dfa.states[0].name).toBe('Beginning')
    expect(updated.states).toEqual([{ id: 'q1', name: 'accept' }])
    expect(updated.initialState).toBeNull()
    expect(updated.finalStates).toEqual(['q1'])
    expect(updated.transitions).toEqual([
      { id: 't11', from: 'q1', symbol: '1', to: 'q1' },
    ])
    expect(updated.positions).toEqual({})
  })

  it('sets initial states and toggles multiple final states', () => {
    let dfa = createBinaryDFA()
    dfa = toggleFinalState(dfa, 'q0')
    expect(dfa.finalStates).toEqual(['q1', 'q0'])
    dfa = toggleFinalState(dfa, 'q1')
    expect(dfa.finalStates).toEqual(['q0'])
    expect(setInitialState(dfa, 'q1').initialState).toBe('q1')
    expect(() => setInitialState(dfa, 'missing')).toThrow(/Unknown state/)
    expect(() => toggleFinalState(dfa, 'missing')).toThrow(/Unknown state/)
  })

  it('adds, updates, removes and looks up transitions', () => {
    let dfa = createBinaryDFA()
    expect(getNextState(dfa, 'q0', '1')).toBe('q1')
    expect(() => addTransition(dfa, { from: 'q0', symbol: '1', to: 'q0' })).toThrow(/already exists/)
    expect(() => addTransition(dfa, { from: 'q0', symbol: 'x', to: 'q0' })).toThrow(/not in the DFA alphabet/)
    dfa = updateTransition(dfa, 't01', { to: 'q0' })
    expect(getNextState(dfa, 'q0', '1')).toBe('q0')
    expect(() => updateTransition(dfa, 't00', { symbol: '1' })).toThrow(/already exists/)
    dfa = removeTransition(dfa, 't01')
    expect(getNextState(dfa, 'q0', '1')).toBeNull()
    expect(() => removeTransition(dfa, 'unknown')).toThrow(/Unknown transition/)
  })

  it('builds a transition table including missing transitions and state flags', () => {
    const dfa = createBinaryDFA()
    const table = getTransitionTable(dfa)

    expect(table).toEqual([
      {
        stateId: 'q0',
        stateName: 'start',
        isInitial: true,
        isFinal: false,
        transitions: { 0: 'q0', 1: 'q1' },
      },
      {
        stateId: 'q1',
        stateName: 'accept',
        isInitial: false,
        isFinal: true,
        transitions: { 0: 'q0', 1: 'q1' },
      },
    ])
    const partial = removeTransition(dfa, 't00')
    expect(getTransitionTable(partial)[0].transitions['0']).toBeNull()
  })
})

describe('DFA validation', () => {
  it('accepts a complete DFA and allows an empty alphabet', () => {
    expect(validateDFA(createBinaryDFA())).toEqual({ valid: true, errors: [] })
    const emptyAlphabetDFA = setInitialState(addState(createDFA(), 'only', { id: 'q0' }), 'q0')
    expect(validateDFA(emptyAlphabetDFA)).toEqual({ valid: true, errors: [] })
  })

  it('reports an empty state set and a missing initial state', () => {
    const result = validateDFA(createDFA())
    expect(result.valid).toBe(false)
    expect(result.errors.map((error) => error.code)).toContain('no-states')
    expect(result.errors.map((error) => error.code)).toContain('missing-initial-state')
  })

  it('reports duplicate alphabet symbols, invalid final states and missing transitions', () => {
    const dfa = createDFA({
      id: 'partial',
      name: 'Partial',
      states: [{ id: 'q0', name: 'Start' }],
      alphabet: ['a', 'a', 'bc'],
      initialState: 'q0',
      finalStates: ['missing'],
    })
    const codes = validateDFA(dfa).errors.map((error) => error.code)

    expect(codes).toContain('duplicate-symbol')
    expect(codes).toContain('invalid-symbol')
    expect(codes).toContain('invalid-final-state')
    expect(codes).toContain('missing-transition')
  })

  it('reports duplicate state IDs and an initial state outside the state set', () => {
    const dfa = createDFA({
      id: 'invalid-state-ids',
      name: 'Invalid state IDs',
      states: [{ id: 'q0', name: 'First' }, { id: 'q0', name: 'Duplicate' }],
      alphabet: [],
      initialState: 'missing',
    })
    const codes = validateDFA(dfa).errors.map((error) => error.code)

    expect(codes).toContain('duplicate-state-id')
    expect(codes).toContain('invalid-initial-state')
  })

  it('reports invalid transition endpoints and duplicate state-symbol transitions', () => {
    const dfa = createDFA({
      id: 'bad',
      name: 'Bad DFA',
      states: [{ id: 'q0', name: 'Start' }],
      alphabet: ['a'],
      initialState: 'q0',
      transitions: [
        { id: 't0', from: 'q0', symbol: 'a', to: 'q0' },
        { id: 't1', from: 'q0', symbol: 'a', to: 'missing' },
      ],
    })
    const codes = validateDFA(dfa).errors.map((error) => error.code)

    expect(codes).toContain('invalid-transition-destination')
    expect(codes).toContain('duplicate-transition')
  })
})

describe('DFA simulation', () => {
  it('accepts and rejects strings while retaining step-by-step history', () => {
    const dfa = createBinaryDFA()
    const accepted = simulateDFA(dfa, '101')
    const rejected = simulateDFA(dfa, '100')
    const reverseStates = accepted.history
      .slice(1)
      .reverse()
      .map((step) => step.from)

    expect(accepted.status).toBe('accepted')
    expect(accepted.accepted).toBe(true)
    expect(accepted.finalState).toBe('q1')
    expect(accepted.history).toEqual([
      { index: 0, symbol: null, from: null, to: 'q0' },
      { index: 1, symbol: '1', from: 'q0', to: 'q1' },
      { index: 2, symbol: '0', from: 'q1', to: 'q0' },
      { index: 3, symbol: '1', from: 'q0', to: 'q1' },
    ])
    expect(reverseStates).toEqual(['q0', 'q1', 'q0'])
    expect(accepted.history.at(-1).to).toBe(accepted.finalState)
    expect(rejected.status).toBe('rejected')
    expect(rejected.accepted).toBe(false)
  })

  it('handles the empty string and an initial state that is also final', () => {
    const dfa = createBinaryDFA()
    expect(simulateDFA(dfa, '').status).toBe('rejected')
    const acceptingStart = toggleFinalState(dfa, 'q0')
    expect(simulateDFA(acceptingStart, '').status).toBe('accepted')
    expect(simulateDFA(acceptingStart, '').history).toHaveLength(1)
    expect(simulateDFA(toggleFinalState(acceptingStart, 'q1'), '0').status).toBe('accepted')
  })

  it('reports invalid symbols and partial-transition failures distinctly', () => {
    const dfa = createBinaryDFA()
    expect(simulateDFA(dfa, '2').status).toBe('invalid-symbol')
    expect(simulateDFA(removeTransition(dfa, 't01'), '1').status).toBe('missing-transition')
    expect(simulateDFA(removeTransition(dfa, 't00'), '1').status).toBe('accepted')
  })

  it('distinguishes duplicate-transition DFAs from valid rejecting executions', () => {
    const dfa = createBinaryDFA()
    const duplicate = {
      ...dfa,
      transitions: [...dfa.transitions, { id: 'duplicate', from: 'q0', symbol: '0', to: 'q1' }],
    }

    expect(simulateDFA(duplicate, '0').status).toBe('invalid-dfa')
    expect(simulateDFA(duplicate, '0').errors.map((error) => error.code)).toContain('duplicate-transition')
    expect(() => getNextState(duplicate, 'q0', '0')).toThrow(/duplicate transitions/)
    expect(simulateDFA(dfa, '0').status).toBe('rejected')
    expect(simulateDFA(removeTransition(dfa, 't00'), '0').status).toBe('missing-transition')
  })

  it('handles self-loops, empty alphabets, and invalid input types', () => {
    const dfa = createBinaryDFA()
    expect(simulateDFA(dfa, '000').finalState).toBe('q0')
    const emptyAlphabet = setInitialState(addState(createDFA(), 'only', { id: 'q0' }), 'q0')
    expect(simulateDFA(toggleFinalState(emptyAlphabet, 'q0'), '').status).toBe('accepted')
    expect(simulateDFA(emptyAlphabet, 'a').status).toBe('invalid-symbol')
    expect(completeDFA(emptyAlphabet).states).toHaveLength(1)
    expect(simulateDFA(dfa, null).status).toBe('invalid-input')
  })

  it('processes a supplementary Unicode alphabet symbol as one symbol', () => {
    let dfa = createDFA({ id: 'unicode', name: 'Unicode DFA', alphabet: ['😀'] })
    dfa = addState(dfa, 'start', { id: 'q0' })
    dfa = setInitialState(dfa, 'q0')
    dfa = toggleFinalState(dfa, 'q0')
    dfa = addTransition(dfa, { id: 'loop', from: 'q0', symbol: '😀', to: 'q0' })

    expect(validateDFA(dfa).valid).toBe(true)
    expect(simulateDFA(dfa, '😀😀').history).toHaveLength(3)
    expect(simulateDFA(dfa, '😀😀').status).toBe('accepted')
  })

  it('reports multi-code-point alphabet entries as unsupported symbols', () => {
    const combinedCharacter = 'e\u0301'
    const dfa = createDFA({
      id: 'combined-unicode',
      name: 'Combined Unicode DFA',
      states: [{ id: 'q0', name: 'Start' }],
      alphabet: [combinedCharacter],
      initialState: 'q0',
      finalStates: ['q0'],
    })

    expect(validateDFA(dfa).errors.map((error) => error.code)).toContain('invalid-symbol')
    expect(simulateDFA(dfa, combinedCharacter).status).toBe('invalid-dfa')
  })

  it('rejects invalid DFA configurations before execution', () => {
    const dfa = createDFA()
    const result = simulateDFA(dfa, '')
    expect(result.status).toBe('invalid-dfa')
    expect(result.errors.map((error) => error.code)).toContain('no-states')
  })
})

describe('DFA completion', () => {
  it('fills missing transitions through a trap state with alphabet self-loops', () => {
    const dfa = removeTransition(createBinaryDFA(), 't00')
    const completed = completeDFA(dfa)
    const deadState = completed.states.find((state) => state.name === 'Dead state')

    expect(deadState).toBeDefined()
    expect(validateDFA(completed)).toEqual({ valid: true, errors: [] })
    expect(getNextState(completed, 'q0', '0')).toBe(deadState.id)
    expect(getNextState(completed, deadState.id, '0')).toBe(deadState.id)
    expect(getNextState(completed, deadState.id, '1')).toBe(deadState.id)
    expect(simulateDFA(completed, '0').status).toBe('rejected')
    expect(dfa.states.some((state) => state.id === deadState.id)).toBe(false)
  })

  it('does not add a trap state when no transitions are missing', () => {
    expect(completeDFA(createBinaryDFA()).states).toHaveLength(2)
  })

  it('does not silently repair duplicate transitions or other invalid configurations', () => {
    const dfa = createBinaryDFA()
    const duplicate = {
      ...dfa,
      transitions: [...dfa.transitions, { id: 'duplicate', from: 'q0', symbol: '0', to: 'q1' }],
    }

    expect(() => completeDFA(duplicate)).toThrow(/Cannot complete an invalid DFA/)
  })
})
