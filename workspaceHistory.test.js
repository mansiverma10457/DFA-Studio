import { describe, expect, it } from 'vitest'
import {
  addState,
  addTransition,
  completeDFA,
  createDFA,
  removeState,
  removeTransition,
  renameState,
  setInitialState,
  toggleFinalState,
} from './engine.js'
import {
  WORKSPACE_HISTORY_LIMIT,
  workspaceReducer,
} from './DfaWorkspaceContext.jsx'
import { readWorkspace, writeWorkspace } from './projectStore.js'

function createWorkspaceState(dfa = createDFA({
  id: 'history-test',
  name: 'History DFA',
  states: [{ id: 'q0', name: 'Start' }, { id: 'q1', name: 'Final' }],
  alphabet: ['a'],
  initialState: 'q0',
  finalStates: ['q1'],
  positions: { q0: { x: 10, y: 20 }, q1: { x: 160, y: 20 } },
})) {
  return {
    dfa,
    past: [],
    future: [],
    activeProjectId: null,
    projects: [],
    projectStorageError: null,
    storageStatus: 'saved',
    storageError: null,
    projectStorageStatus: 'saved',
  }
}

function commit(state, dfa) {
  return workspaceReducer(state, { type: 'commit', dfa })
}

function undo(state) {
  return workspaceReducer(state, { type: 'undo' })
}

function redo(state) {
  return workspaceReducer(state, { type: 'redo' })
}

function createMemoryStorage() {
  const entries = new Map()
  return {
    getItem: (key) => entries.get(key) ?? null,
    setItem: (key, value) => entries.set(key, String(value)),
  }
}

describe('shared DFA workspace history', () => {
  it('undoes and redoes state creation and deletion with exact state data', () => {
    const initial = createWorkspaceState()
    const created = commit(initial, addState(initial.dfa, 'Middle', {
      id: 'q2',
      position: { x: 320, y: 88 },
    }))

    expect(created.dfa.states).toHaveLength(3)
    const undoneCreation = undo(created)
    expect(undoneCreation.dfa).toEqual(initial.dfa)
    expect(redo(undoneCreation).dfa).toEqual(created.dfa)

    const deleted = commit(created, removeState(created.dfa, 'q2'))
    expect(deleted.dfa.positions.q2).toBeUndefined()
    expect(undo(deleted).dfa).toEqual(created.dfa)
    expect(redo(undo(deleted)).dfa).toEqual(deleted.dfa)
  })

  it('undoes and redoes transitions and exact canvas movement', () => {
    const initial = createWorkspaceState()
    const connected = commit(initial, addTransition(initial.dfa, {
      id: 't0',
      from: 'q0',
      symbol: 'a',
      to: 'q1',
    }))
    expect(undo(connected).dfa.transitions).toEqual([])
    expect(redo(undo(connected)).dfa.transitions).toEqual(connected.dfa.transitions)
    expect(removeTransition(redo(undo(connected)).dfa, 't0').transitions).toEqual([])

    const movedDfa = {
      ...connected.dfa,
      positions: { ...connected.dfa.positions, q0: { x: 777, y: -42 } },
    }
    const moved = commit(connected, movedDfa)
    expect(undo(moved).dfa.positions.q0).toEqual({ x: 10, y: 20 })
    expect(redo(undo(moved)).dfa.positions.q0).toEqual({ x: 777, y: -42 })
  })

  it('records renames, alphabet edits, initial/final changes, and clearing the DFA', () => {
    const initial = createWorkspaceState()
    const renamed = commit(initial, renameState(initial.dfa, 'q0', 'Renamed'))
    const alphabetEdited = commit(renamed, { ...renamed.dfa, alphabet: ['a', 'b'] })
    const initialChanged = commit(alphabetEdited, setInitialState(alphabetEdited.dfa, 'q1'))
    const finalChanged = commit(initialChanged, toggleFinalState(initialChanged.dfa, 'q0'))
    const clearedDfa = finalChanged.dfa.states.reduce(
      (dfa, state) => removeState(dfa, state.id),
      finalChanged.dfa,
    )
    const cleared = commit(finalChanged, clearedDfa)

    expect(undo(cleared).dfa).toEqual(finalChanged.dfa)
    expect(redo(undo(cleared)).dfa).toEqual(cleared.dfa)
    let restored = cleared
    for (let index = 0; index < 5; index += 1) restored = undo(restored)
    expect(restored.dfa).toEqual(initial.dfa)
  })

  it('supports multiple undo and redo operations and clears redo after a new edit', () => {
    const initial = createWorkspaceState()
    const first = commit(initial, { ...initial.dfa, name: 'First edit' })
    const second = commit(first, { ...first.dfa, name: 'Second edit' })
    const third = commit(second, { ...second.dfa, name: 'Third edit' })
    const rewound = undo(undo(third))

    expect(rewound.dfa.name).toBe('First edit')
    expect(redo(redo(rewound)).dfa.name).toBe('Third edit')

    const branched = commit(rewound, { ...rewound.dfa, name: 'New branch' })
    expect(branched.dfa.name).toBe('New branch')
    expect(branched.future).toEqual([])
    expect(redo(branched)).toBe(branched)
  })

  it('does not record duplicate snapshots and limits history size', () => {
    let state = createWorkspaceState()
    expect(commit(state, state.dfa)).toBe(state)
    for (let index = 0; index < WORKSPACE_HISTORY_LIMIT + 10; index += 1) {
      state = commit(state, { ...state.dfa, name: `Edit ${index}` })
    }
    expect(state.past).toHaveLength(WORKSPACE_HISTORY_LIMIT)
    for (let index = 0; index < WORKSPACE_HISTORY_LIMIT; index += 1) state = undo(state)
    expect(state.dfa.name).toBe('Edit 9')
    expect(state.future).toHaveLength(WORKSPACE_HISTORY_LIMIT)
  })

  it('persists undo and redo results as the active workspace without mutating projects', () => {
    const initial = createWorkspaceState()
    const edited = commit(initial, { ...initial.dfa, name: 'Edited DFA' })
    const undone = undo(edited)
    const storage = createMemoryStorage()
    writeWorkspace(undone.dfa, storage, 'named-project')
    expect(readWorkspace(storage)).toMatchObject({
      dfa: initial.dfa,
      activeProjectId: 'named-project',
      error: null,
    })

    const redone = redo(undone)
    writeWorkspace(redone.dfa, storage, 'named-project')
    expect(readWorkspace(storage).dfa).toEqual(edited.dfa)
    expect(redone.projects).toEqual(initial.projects)
  })

  it('autosaves incomplete structures unchanged and keeps explicit completion undoable', () => {
    const initial = createWorkspaceState()
    const incompleteDfa = addTransition(initial.dfa, {
      id: 'only-one-symbol-transition',
      from: 'q0',
      symbol: 'a',
      to: 'q1',
    })
    const edited = commit(initial, incompleteDfa)
    const storage = createMemoryStorage()

    writeWorkspace(edited.dfa, storage)
    expect(readWorkspace(storage).dfa).toEqual(incompleteDfa)
    expect(readWorkspace(storage).dfa.states).toHaveLength(2)
    expect(readWorkspace(storage).dfa.transitions).toHaveLength(1)

    const completed = commit(edited, completeDFA(edited.dfa))
    expect(completed.dfa.states).toHaveLength(3)
    expect(undo(completed).dfa).toEqual(incompleteDfa)
    expect(redo(undo(completed)).dfa).toEqual(completed.dfa)
  })

  it('loads a saved incomplete DFA without completing or repairing it', () => {
    const state = createWorkspaceState()
    const incompleteDfa = addTransition(state.dfa, {
      id: 'one-transition',
      from: 'q0',
      symbol: 'a',
      to: 'q1',
    })
    const loaded = workspaceReducer(state, {
      type: 'load-project',
      projectId: 'partial-project',
      dfa: incompleteDfa,
    })

    expect(loaded.dfa).toEqual(incompleteDfa)
    expect(loaded.activeProjectId).toBe('partial-project')
    expect(loaded.dfa.states).toHaveLength(2)
    expect(loaded.dfa.transitions).toHaveLength(1)
  })
})
