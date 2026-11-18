import { getStatePosition } from './layout.js'
import { MarkerType } from '@xyflow/react'

const transitionMarker = {
  type: MarkerType.ArrowClosed,
  color: '#b69bff',
  width: 16,
  height: 16,
}

export function toFlowNodes(dfa, { selectedStateId = null } = {}) {
  return dfa.states.map((state, index) => ({
    id: state.id,
    type: 'dfaState',
    position: dfa.positions[state.id] ?? getStatePosition(index, dfa.states.length),
    selected: state.id === selectedStateId,
    data: {
      stateId: state.id,
      name: state.name,
      isInitial: dfa.initialState === state.id,
      isFinal: dfa.finalStates.includes(state.id),
    },
  }))
}

export function toFlowEdges(dfa, { selectedTransitionId = null } = {}) {
  const stateOrder = new Map(dfa.states.map((state, index) => [state.id, index]))
  const grouped = new Map()
  for (const transition of dfa.transitions) {
    const fromOrder = stateOrder.get(transition.from)
    const toOrder = stateOrder.get(transition.to)
    const key = fromOrder <= toOrder
      ? JSON.stringify([transition.from, transition.to])
      : JSON.stringify([transition.to, transition.from])
    const group = grouped.get(key) ?? []
    group.push(transition)
    grouped.set(key, group)
  }

  return dfa.transitions.map((transition) => {
    const fromOrder = stateOrder.get(transition.from)
    const toOrder = stateOrder.get(transition.to)
    const key = fromOrder <= toOrder
      ? JSON.stringify([transition.from, transition.to])
      : JSON.stringify([transition.to, transition.from])
    const parallel = grouped.get(key)
    const parallelIndex = parallel.findIndex((candidate) => candidate.id === transition.id)
    const reverseDirection = fromOrder > toOrder
    const hasReverseDirection = parallel.some(
      (candidate) => candidate.from === transition.to && candidate.to === transition.from,
    )

    return {
      id: transition.id,
      type: 'dfaTransition',
      source: transition.from,
      target: transition.to,
      sourceHandle: transition.from === transition.to ? 'loop-source' : 'edge-center-source',
      targetHandle: transition.from === transition.to ? 'loop-target' : 'edge-center-target',
      selected: transition.id === selectedTransitionId,
      markerEnd: transitionMarker,
      data: {
        symbol: transition.symbol,
        parallelIndex,
        parallelCount: parallel.length,
        reverseDirection,
      },
    }
  })
}
