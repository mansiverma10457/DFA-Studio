import { describe, expect, it } from 'vitest'
import { createDFA, simulateDFA } from './engine.js'
import { runBatchTests } from './batchTesting.js'
import {
  advanceSimulation,
  createReadyExecution,
  getExecutionRows,
  getInputProgress,
  isExecutionTerminal,
  previousSimulationStep,
  resetSimulation,
  startSimulation,
} from './simulation.js'

function makeDFA({
  finalStates = ['q1'],
  transitions = [
    { id: 'a0', from: 'q0', symbol: 'a', to: 'q1' },
    { id: 'a1', from: 'q1', symbol: 'a', to: 'q1' },
    { id: 'b0', from: 'q0', symbol: 'b', to: 'q0' },
    { id: 'b1', from: 'q1', symbol: 'b', to: 'q0' },
  ],
  initialState = 'q0',
} = {}) {
  return createDFA({
    id: 'simulation-test',
    name: 'Simulation test',
    states: [{ id: 'q0', name: 'Start' }, { id: 'q1', name: 'Accept' }],
    alphabet: ['a', 'b'],
    initialState,
    finalStates,
    transitions,
  })
}

function makeBinaryEndingInZeroDFA() {
  return createDFA({
    id: 'binary-ending-in-zero',
    name: 'Binary strings ending in 0',
    states: [{ id: 'q0', name: 'q0' }, { id: 'q1', name: 'q1' }],
    alphabet: ['0', '1'],
    initialState: 'q0',
    finalStates: ['q1'],
    transitions: [
      { id: 'q0-0', from: 'q0', symbol: '0', to: 'q1' },
      { id: 'q0-1', from: 'q0', symbol: '1', to: 'q0' },
      { id: 'q1-0', from: 'q1', symbol: '0', to: 'q1' },
      { id: 'q1-1', from: 'q1', symbol: '1', to: 'q0' },
    ],
  })
}

describe('step-by-step DFA simulation', () => {
  it('matches the binary-strings-ending-in-zero test DFA across full and stepped execution', () => {
    const dfa = makeBinaryEndingInZeroDFA()
    const cases = [
      ['0', 'accepted'],
      ['1', 'rejected'],
      ['10', 'accepted'],
      ['110', 'accepted'],
      ['01', 'rejected'],
      ['11', 'rejected'],
      ['100', 'accepted'],
      ['', 'rejected'],
    ]

    for (const [input, expected] of cases) {
      expect(simulateDFA(dfa, input).status).toBe(expected)
      let execution = startSimulation(dfa, input)
      while (execution.status === 'running') execution = advanceSimulation(dfa, execution)
      expect(execution.status).toBe(expected)
    }

    expect(runBatchTests(dfa, cases.map(([input]) => input)).map((result) => result.status))
      .toEqual(cases.map(([, expected]) => expected))
  })

  it('starts a clean second simulation after a terminal result', () => {
    const dfa = makeBinaryEndingInZeroDFA()
    let first = startSimulation(dfa, '0')
    first = advanceSimulation(dfa, first)
    expect(first.status).toBe('accepted')

    let second = startSimulation(dfa, '1')
    expect(second).toMatchObject({ status: 'running', currentState: 'q0', cursor: 0, history: [] })
    second = advanceSimulation(dfa, second)
    expect(second.status).toBe('rejected')
  })

  it('initializes execution from the newly active DFA instead of retaining old state IDs', () => {
    const firstDfa = makeBinaryEndingInZeroDFA()
    const nextDfa = createDFA({
      ...firstDfa,
      id: 'alternate-active-dfa',
      states: [{ id: 'start', name: 'Start' }, { id: 'accept', name: 'Accept' }],
      initialState: 'start',
      finalStates: ['accept'],
      transitions: [
        { id: 'zero', from: 'start', symbol: '0', to: 'accept' },
        { id: 'one', from: 'start', symbol: '1', to: 'start' },
        { id: 'zero-loop', from: 'accept', symbol: '0', to: 'accept' },
        { id: 'one-back', from: 'accept', symbol: '1', to: 'start' },
      ],
    })
    let oldExecution = startSimulation(firstDfa, '0')
    oldExecution = advanceSimulation(firstDfa, oldExecution)
    const currentExecution = startSimulation(nextDfa, '1')

    expect(oldExecution.currentState).toBe('q1')
    expect(currentExecution).toMatchObject({
      status: 'running',
      currentState: 'start',
      cursor: 0,
      history: [],
    })
    expect(advanceSimulation(nextDfa, currentExecution).status).toBe('rejected')
  })

  it('accepts and rejects the empty string based on the initial state', () => {
    expect(startSimulation(makeDFA({ finalStates: ['q0'] }), '').status).toBe('accepted')
    expect(startSimulation(makeDFA(), '').status).toBe('rejected')
  })

  it('supports accepted, rejected, multiple-final, and self-loop executions', () => {
    const dfa = makeDFA({ finalStates: ['q0', 'q1'] })
    let execution = startSimulation(dfa, 'aaa')
    execution = advanceSimulation(dfa, execution)
    execution = advanceSimulation(dfa, execution)
    execution = advanceSimulation(dfa, execution)
    expect(execution.status).toBe('accepted')
    expect(execution.history.map((row) => row.to)).toEqual(['q1', 'q1', 'q1'])
    expect(execution.history[1].transitionId).toBe('a1')

    let rejected = startSimulation(makeDFA(), 'ab')
    rejected = advanceSimulation(makeDFA(), rejected)
    rejected = advanceSimulation(makeDFA(), rejected)
    expect(rejected.status).toBe('rejected')
  })

  it('reports an invalid input symbol before execution', () => {
    const execution = startSimulation(makeDFA(), 'ac')
    expect(execution.status).toBe('error')
    expect(execution.error).toMatchObject({ code: 'invalid-symbol', symbol: 'c', index: 1 })
    expect(execution.history).toEqual([])
  })

  it('reports a missing transition with its source and symbol', () => {
    const dfa = makeDFA({
      transitions: [{ id: 'a0', from: 'q0', symbol: 'a', to: 'q1' }],
    })
    let execution = startSimulation(dfa, 'b')
    execution = advanceSimulation(dfa, execution)
    expect(execution.status).toBe('error')
    expect(execution.error).toMatchObject({
      code: 'missing-transition',
      state: 'q0',
      symbol: 'b',
      step: 1,
    })
    expect(getExecutionRows(execution)[0].result).toBe('Error')
  })

  it('blocks a missing or invalid initial state', () => {
    expect(startSimulation(makeDFA({ initialState: null }), 'a').error.code)
      .toBe('missing-initial-state')
    expect(startSimulation(makeDFA({ initialState: 'missing' }), 'a').status)
      .toBe('error')
  })

  it('allows an incomplete DFA when the selected execution path has transitions', () => {
    const dfa = makeDFA({
      transitions: [{ id: 'a0', from: 'q0', symbol: 'a', to: 'q1' }],
    })
    let execution = startSimulation(dfa, 'a')
    expect(execution.status).toBe('running')
    execution = advanceSimulation(dfa, execution)
    expect(execution.status).toBe('accepted')
  })

  it('tracks history and restores exact state when moving backward and replaying', () => {
    const dfa = makeDFA()
    let execution = startSimulation(dfa, 'ab')
    execution = advanceSimulation(dfa, execution)
    execution = advanceSimulation(dfa, execution)
    expect(execution.currentState).toBe('q0')
    expect(getExecutionRows(execution)).toHaveLength(2)

    execution = previousSimulationStep(execution)
    expect(execution).toMatchObject({ cursor: 1, currentState: 'q1', currentSymbol: 'b', status: 'running' })
    expect(getExecutionRows(execution)).toHaveLength(2)
    expect(getExecutionRows(execution)[1].step).toBe(2)
    expect(getInputProgress(execution)).toMatchObject({
      processed: 1,
      current: 'b',
      remaining: 0,
      symbols: [
        { symbol: 'a', status: 'processed' },
        { symbol: 'b', status: 'current' },
      ],
    })
    execution = advanceSimulation(dfa, execution)
    expect(execution).toMatchObject({ cursor: 2, currentState: 'q0', status: 'rejected' })
    expect(execution.history).toHaveLength(2)
    expect(getInputProgress(execution)).toMatchObject({
      processed: 2,
      current: null,
      remaining: 0,
      symbols: [
        { symbol: 'a', status: 'processed' },
        { symbol: 'b', status: 'processed' },
      ],
    })
  })

  it('resets progress with execution history and identifies invalid symbols', () => {
    const dfa = makeDFA()
    const reset = resetSimulation(dfa, 'ab')
    expect(getInputProgress(reset)).toMatchObject({
      processed: 0,
      current: null,
      remaining: 2,
      symbols: [
        { symbol: 'a', status: 'remaining' },
        { symbol: 'b', status: 'remaining' },
      ],
    })

    const invalid = startSimulation(dfa, 'ac')
    expect(getInputProgress(invalid).symbols).toEqual([
      { symbol: 'a', index: 0, status: 'remaining' },
      { symbol: 'c', index: 1, status: 'current' },
    ])
  })

  it('resets without changing the DFA model', () => {
    const dfa = makeDFA()
    const snapshot = JSON.stringify(dfa)
    let execution = startSimulation(dfa, 'a')
    execution = advanceSimulation(dfa, execution)
    execution = resetSimulation(dfa, 'a')
    expect(execution).toMatchObject({ status: 'ready', cursor: 0, currentState: 'q0', history: [] })
    expect(JSON.stringify(dfa)).toBe(snapshot)
  })

  it('stops automatic-style advancement at terminal status and can be paused by retaining state', () => {
    const dfa = makeDFA()
    let execution = startSimulation(dfa, 'a')
    execution = advanceSimulation(dfa, execution)
    expect(execution.status).toBe('accepted')
    expect(isExecutionTerminal(execution)).toBe(true)
    expect(advanceSimulation(dfa, execution)).toBe(execution)

    const paused = startSimulation(dfa, 'aa')
    expect(advanceSimulation(dfa, paused)).toMatchObject({ cursor: 1, status: 'running' })
    expect(paused.cursor).toBe(0)
  })

  it('creates a ready execution with the initial state when available', () => {
    expect(createReadyExecution(makeDFA(), '').currentState).toBe('q0')
  })
})
