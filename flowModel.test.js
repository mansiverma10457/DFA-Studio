import { describe, expect, it } from 'vitest'
import { addState, addTransition, createDFA, setInitialState, toggleFinalState } from '../dfa/engine.js'
import { getAutoLayoutPositions } from './layout.js'
import { toFlowEdges, toFlowNodes } from './flowModel.js'

describe('React Flow visualization model', () => {
  it('derives node status and saved canvas positions from the DFA model', () => {
    let dfa = createDFA({ id: 'flow', name: 'Flow', positions: { q0: { x: 25, y: 40 } } })
    dfa = addState(dfa, 'Start', { id: 'q0' })
    dfa = addState(dfa, 'Accept', { id: 'q1' })
    dfa = setInitialState(dfa, 'q0')
    dfa = toggleFinalState(dfa, 'q1')

    expect(toFlowNodes(dfa, { selectedStateId: 'q1' })).toEqual([
      {
        id: 'q0',
        type: 'dfaState',
        position: { x: 25, y: 40 },
        selected: false,
        data: { stateId: 'q0', name: 'Start', isInitial: true, isFinal: false },
      },
      {
        id: 'q1',
        type: 'dfaState',
        position: expect.objectContaining({ x: expect.any(Number), y: expect.any(Number) }),
        selected: true,
        data: { stateId: 'q1', name: 'Accept', isInitial: false, isFinal: true },
      },
    ])
  })

  it('maps each engine transition to a straight state-to-state edge', () => {
    let dfa = createDFA({ id: 'flow', name: 'Flow', alphabet: ['a', 'b'] })
    dfa = addState(dfa, 'First', { id: 'q0' })
    dfa = addState(dfa, 'Second', { id: 'q1' })
    dfa = addTransition(dfa, { id: 'a-forward', from: 'q0', symbol: 'a', to: 'q1' })
    dfa = addTransition(dfa, { id: 'b-forward', from: 'q0', symbol: 'b', to: 'q1' })
    dfa = addTransition(dfa, { id: 'a-back', from: 'q1', symbol: 'a', to: 'q0' })

    const edges = toFlowEdges(dfa, { selectedTransitionId: 'b-forward' })
    expect(edges).toHaveLength(dfa.transitions.length)
    expect(edges.map((edge) => edge.id)).toEqual(dfa.transitions.map((transition) => transition.id))
    expect(edges.map((edge) => edge.data.symbol)).toEqual(['a', 'b', 'a'])
    expect(edges.map((edge) => edge.data.parallelCount)).toEqual([3, 3, 3])
    expect(edges[1].selected).toBe(true)
    expect(edges.every((edge) => edge.markerEnd)).toBe(true)
    expect(edges[0].markerEnd).toMatchObject({
      type: 'arrowclosed',
      color: '#b69bff',
    })
    expect(edges[0].sourceHandle).toBe('edge-center-source')
    expect(edges[2].sourceHandle).toBe('edge-center-source')
    expect(edges[2].targetHandle).toBe('edge-center-target')
    expect(edges[2].data.reverseDirection).toBe(true)
  })

  it('maps self-loops to dedicated handles and auto-layouts every state', () => {
    let dfa = createDFA({ id: 'flow', name: 'Flow', alphabet: ['a'] })
    dfa = addState(dfa, 'Only', { id: 'q0' })
    dfa = addTransition(dfa, { id: 'loop', from: 'q0', symbol: 'a', to: 'q0' })

    expect(toFlowEdges(dfa)[0]).toMatchObject({
      sourceHandle: 'loop-source',
      targetHandle: 'loop-target',
      data: { symbol: 'a', parallelCount: 1 },
    })
    expect(Object.keys(getAutoLayoutPositions(dfa.states))).toEqual(['q0'])
  })
})
