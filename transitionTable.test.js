import { describe, expect, it, vi } from 'vitest'
import { createDFA } from './engine.js'
import { copyTransitionTable, createTransitionTableView, toTransitionTableCsv } from './transitionTable.js'

function sampleDFA() {
  return createDFA({
    id: 'table',
    name: 'Table',
    states: [{ id: 'q0', name: 'Start' }, { id: 'q1', name: 'Accept' }],
    alphabet: ['a', 'b'],
    initialState: 'q0',
    finalStates: ['q1'],
    transitions: [
      { id: 'a0', from: 'q0', symbol: 'a', to: 'q1' },
      { id: 'b0', from: 'q0', symbol: 'b', to: 'q0' },
      { id: 'a1', from: 'q1', symbol: 'a', to: 'q1' },
    ],
  })
}

describe('transition table presentation', () => {
  it('generates state rows, alphabet columns, flags, and missing cells from the DFA', () => {
    const dfa = sampleDFA()
    const table = createTransitionTableView(dfa)

    expect(table).toHaveLength(2)
    expect(table[0]).toMatchObject({
      stateId: 'q0',
      isInitial: true,
      isFinal: false,
      cells: {
        a: { destinationId: 'q1', destinationName: 'Accept', missing: false, invalid: false },
        b: { destinationId: 'q0', destinationName: 'Start', missing: false, invalid: false },
      },
    })
    expect(table[1].cells.b).toMatchObject({ missing: true, invalid: false })
    expect(createTransitionTableView({ ...dfa, states: [] })).toEqual([])
  })

  it('marks duplicate and invalid-destination cells as invalid', () => {
    const dfa = sampleDFA()
    const malformed = {
      ...dfa,
      transitions: [
        ...dfa.transitions,
        { id: 'duplicate', from: 'q0', symbol: 'a', to: 'q0' },
        { id: 'invalid-destination', from: 'q1', symbol: 'b', to: 'missing' },
      ],
    }
    const table = createTransitionTableView(malformed)

    expect(table[0].cells.a).toMatchObject({ duplicate: true, invalid: true })
    expect(table[1].cells.b).toMatchObject({ invalid: true, destinationName: 'missing' })
    expect(toTransitionTableCsv(malformed, table)).toContain('! Accept')
  })

  it('exports CSV with initial/final markers and a missing-transition marker', () => {
    expect(toTransitionTableCsv(sampleDFA())).toBe(
      'State,a,b\r\n→ Start,Accept,Start\r\nAccept *,Accept,— (missing)',
    )
  })

  it('copies the table text through the clipboard API', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    await copyTransitionTable('State,a', { writeText })
    expect(writeText).toHaveBeenCalledWith('State,a')
    await expect(copyTransitionTable('State,a', {})).rejects.toThrow(/unavailable/)
  })
})
