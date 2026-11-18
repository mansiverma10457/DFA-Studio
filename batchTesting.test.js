import { describe, expect, it, vi } from 'vitest'
import { createDFA } from './engine.js'
import {
  copyBatchResults,
  generateRandomStrings,
  MAX_BATCH_STRINGS,
  parseBatchInput,
  runBatchTests,
  runSingleTest,
  summarizeBatchResults,
  toBatchResultsCsv,
} from './batchTesting.js'

function makeDFA({ states, initialState, finalStates, transitions, alphabet = ['a', 'b'] } = {}) {
  return createDFA({
    id: 'batch-test',
    name: 'Batch test',
    states: states ?? [{ id: 'q0', name: 'Start' }, { id: 'q1', name: 'Accept' }],
    alphabet,
    initialState: initialState === undefined ? 'q0' : initialState,
    finalStates: finalStates ?? ['q1'],
    transitions: transitions ?? [
      { id: 'a0', from: 'q0', symbol: 'a', to: 'q1' },
      { id: 'b0', from: 'q0', symbol: 'b', to: 'q0' },
      { id: 'a1', from: 'q1', symbol: 'a', to: 'q1' },
      { id: 'b1', from: 'q1', symbol: 'b', to: 'q0' },
    ],
  })
}

function makeBinaryEndingInZeroDFA() {
  return makeDFA({
    states: [{ id: 'q0', name: 'q0' }, { id: 'q1', name: 'q1' }],
    initialState: 'q0',
    finalStates: ['q1'],
    alphabet: ['0', '1'],
    transitions: [
      { id: 'q0-0', from: 'q0', symbol: '0', to: 'q1' },
      { id: 'q0-1', from: 'q0', symbol: '1', to: 'q0' },
      { id: 'q1-0', from: 'q1', symbol: '0', to: 'q1' },
      { id: 'q1-1', from: 'q1', symbol: '1', to: 'q0' },
    ],
  })
}

describe('batch string testing', () => {
  it('returns the exact expected results for binary strings ending in zero', () => {
    const inputs = ['0', '1', '10', '110', '01', '11', '100', '']
    const results = runBatchTests(makeBinaryEndingInZeroDFA(), inputs)

    expect(results.map((result) => result.status)).toEqual([
      'accepted', 'rejected', 'accepted', 'accepted',
      'rejected', 'rejected', 'accepted', 'rejected',
    ])
    expect(summarizeBatchResults(results)).toMatchObject({
      total: 8,
      accepted: 4,
      rejected: 4,
      errors: 0,
    })
  })

  it('recomputes result states when the active DFA changes', () => {
    const dfa = makeBinaryEndingInZeroDFA()
    const original = runBatchTests(dfa, ['0'])
    const changed = runBatchTests({ ...dfa, finalStates: ['q0'] }, ['0'])

    expect(original[0].status).toBe('accepted')
    expect(changed[0].status).toBe('rejected')
  })

  it('runs multiple accepted and rejected strings and includes empty strings', () => {
    const results = runBatchTests(makeDFA(), ['a', 'ba', 'b', '', 'bb'])

    expect(results.map((result) => result.status)).toEqual([
      'accepted', 'accepted', 'rejected', 'rejected', 'rejected',
    ])
    expect(results[3]).toMatchObject({ input: '', finalState: 'q0', steps: 0 })
  })

  it('reports invalid symbols, missing transitions, and invalid DFA configurations distinctly', () => {
    const dfa = makeDFA({
      transitions: [{ id: 'a0', from: 'q0', symbol: 'a', to: 'q1' }],
    })
    const results = runBatchTests(dfa, ['x', 'b'])
    expect(results.map((result) => result.status)).toEqual(['invalid-symbol', 'missing-transition'])
    expect(results[0].detail).toMatch(/not in the DFA alphabet/)
    expect(results[1].detail).toMatch(/No transition exists/)

    const invalid = runBatchTests(makeDFA({ initialState: 'missing' }), ['a'])
    expect(invalid[0].status).toBe('invalid-dfa')
  })

  it('computes totals without counting errors as rejected and uses all tests for the rate', () => {
    const results = runBatchTests(makeDFA(), ['a', 'b', 'x'])
    expect(summarizeBatchResults(results)).toEqual({
      total: 3,
      accepted: 1,
      rejected: 1,
      errors: 1,
      acceptancePercentage: 33.3,
    })
    expect(summarizeBatchResults([])).toMatchObject({ total: 0, acceptancePercentage: 0 })
  })

  it('parses line-separated inputs and supports empty lines as empty strings', () => {
    expect(parseBatchInput('a\r\nb\n\n')).toEqual(['a', 'b', ''])
    expect(parseBatchInput('')).toEqual([])
  })

  it('clears and reruns batches consistently', () => {
    const dfa = makeDFA()
    const firstRun = runBatchTests(dfa, ['a', 'b'])
    const cleared = runBatchTests(dfa, [])
    const rerun = runBatchTests(dfa, ['a', 'b'])

    expect(summarizeBatchResults(cleared).total).toBe(0)
    expect(rerun).toEqual(firstRun)
  })

  it('tests individual strings repeatedly and keeps each latest result tied to its input', () => {
    const dfa = makeDFA()
    const accepted = runSingleTest(dfa, 'a')
    const rejected = runSingleTest(dfa, 'b')

    expect(accepted).toMatchObject({ input: 'a', status: 'accepted', finalState: 'q1' })
    expect(rejected).toMatchObject({ input: 'b', status: 'rejected', finalState: 'q0' })
    expect(runSingleTest(dfa, 'x')).toMatchObject({ input: 'x', status: 'invalid-symbol' })
    expect(runSingleTest(dfa, 'a')).toEqual(accepted)
  })

  it('reruns all batch entries and handles additions, removals, and errors independently', () => {
    const dfa = makeDFA({
      transitions: [
        { id: 'a0', from: 'q0', symbol: 'a', to: 'q1' },
        { id: 'a1', from: 'q1', symbol: 'a', to: 'q1' },
      ],
    })
    const inputs = ['a', 'b', 'x']
    const first = runBatchTests(dfa, inputs)
    const rerun = runBatchTests(dfa, inputs)
    const appended = runBatchTests(dfa, [...inputs, 'aa'])
    const removedAndRerun = runBatchTests(dfa, inputs.filter((_, index) => index !== 1))

    expect(first.map((result) => result.status)).toEqual([
      'accepted', 'missing-transition', 'invalid-symbol',
    ])
    expect(rerun).toEqual(first)
    expect(appended).toHaveLength(4)
    expect(appended[3]).toMatchObject({ input: 'aa', status: 'accepted' })
    expect(removedAndRerun.map((result) => result.input)).toEqual(['a', 'x'])
    expect(summarizeBatchResults(removedAndRerun)).toMatchObject({
      total: 2,
      accepted: 1,
      rejected: 0,
      errors: 1,
    })
  })

  it('can clear displayed results and test the same retained input list again', () => {
    const dfa = makeDFA()
    const inputList = ['a', 'b']
    const firstResults = runBatchTests(dfa, inputList)
    const clearedResults = []
    const retestedResults = runBatchTests(dfa, inputList)

    expect(summarizeBatchResults(firstResults).total).toBe(2)
    expect(summarizeBatchResults(clearedResults).total).toBe(0)
    expect(inputList).toEqual(['a', 'b'])
    expect(retestedResults).toEqual(firstResults)
  })
})

describe('random string generation', () => {
  it('uses only the alphabet and respects inclusive length bounds', () => {
    const strings = generateRandomStrings(['x', '😀'], {
      count: 40,
      minLength: 2,
      maxLength: 5,
      seed: 'unicode-seed',
    })

    expect(strings).toHaveLength(40)
    for (const value of strings) {
      const symbols = Array.from(value)
      expect(symbols.length).toBeGreaterThanOrEqual(2)
      expect(symbols.length).toBeLessThanOrEqual(5)
      expect(symbols.every((symbol) => ['x', '😀'].includes(symbol))).toBe(true)
    }
    expect(new Set(strings.map((value) => Array.from(value).length)).size).toBeGreaterThan(1)
  })

  it('generates reproducible output with a seed and permits empty strings', () => {
    const options = { count: 12, minLength: 0, maxLength: 4, seed: 1729 }
    const first = generateRandomStrings(['a', 'b'], options)
    expect(generateRandomStrings(['a', 'b'], options)).toEqual(first)
    expect(first).toContain('')
    expect(generateRandomStrings([], { count: 1, minLength: 0, maxLength: 0, seed: 'empty' }))
      .toEqual([''])
  })

  it('supports repeated random generation and immediate independent testing', () => {
    const dfa = makeDFA()
    const options = { count: 8, minLength: 0, maxLength: 4, seed: 'repeat' }
    const first = generateRandomStrings(dfa.alphabet, options)
    const testedFirst = runBatchTests(dfa, first)
    const second = generateRandomStrings(dfa.alphabet, { ...options, seed: 'repeat-2' })
    const testedSecond = runBatchTests(dfa, second)

    expect(testedFirst).toHaveLength(8)
    expect(testedSecond).toHaveLength(8)
    expect(testedFirst.map((result) => result.input)).toEqual(first)
    expect(testedSecond.map((result) => result.input)).toEqual(second)
    expect(new Set(first).size).toBeGreaterThan(1)
  })

  it('validates generation parameters and limits oversized workloads', () => {
    expect(() => generateRandomStrings(['a'], { count: 0, minLength: 0, maxLength: 1 }))
      .toThrow(/Number of strings/)
    expect(() => generateRandomStrings(['a'], { count: 1, minLength: 3, maxLength: 2 }))
      .toThrow(/Minimum length/)
    expect(() => generateRandomStrings([], { count: 1, minLength: 0, maxLength: 1 }))
      .toThrow(/alphabet/)
    expect(() => generateRandomStrings(['a'], {
      count: MAX_BATCH_STRINGS,
      minLength: 0,
      maxLength: 101,
    })).toThrow(/safety limit/)
    expect(() => runBatchTests(makeDFA(), Array(MAX_BATCH_STRINGS + 1).fill('a')))
      .toThrow(/at most/)
  })
})

describe('batch result export', () => {
  it('formats CSV values with commas, quotes, Unicode, and line breaks safely', () => {
    const results = [{
      input: 'a,"b"\r\n😀',
      status: 'invalid-symbol',
      finalState: 'q,"1"',
      steps: 2,
      detail: 'Unexpected, "symbol"\nfound',
    }]
    expect(toBatchResultsCsv(results, (state) => `State ${state}`)).toBe(
      'Input String,Result,Final State,Steps,Details\r\n' +
      '"a,""b""\r\n😀",invalid-symbol,"State q,""1""",2,"Unexpected, ""symbol""\nfound"',
    )
  })

  it('copies CSV through the clipboard API and surfaces unavailable clipboard errors', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    await copyBatchResults('Input String,Result', { writeText })
    expect(writeText).toHaveBeenCalledWith('Input String,Result')
    await expect(copyBatchResults('data', {})).rejects.toThrow(/unavailable/)
  })
})
