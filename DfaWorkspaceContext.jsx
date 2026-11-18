import { createContext, useCallback, useContext, useEffect, useReducer, useRef } from 'react'
import { createDFA } from './engine.js'
import { readProjects, readWorkspace, writeProjects, writeWorkspace } from './projectStore.js'

const DfaWorkspaceContext = createContext(null)
export const WORKSPACE_HISTORY_LIMIT = 50

function getInitialState() {
  const fallbackDfa = createDFA({ name: 'Untitled DFA' })
  try {
    const workspace = readWorkspace()
    const savedProjects = readProjects()
    return {
      dfa: workspace.dfa ?? fallbackDfa,
      past: [],
      future: [],
      activeProjectId: savedProjects.projects.some((project) => project.id === workspace.activeProjectId)
        ? workspace.activeProjectId
        : null,
      projects: savedProjects.projects,
      projectStorageError: savedProjects.error,
      storageStatus: workspace.error ? 'failed' : 'saved',
      storageError: workspace.error,
      projectStorageStatus: savedProjects.error ? 'failed' : 'saved',
    }
  } catch (error) {
    return {
      dfa: fallbackDfa,
      past: [],
      future: [],
      activeProjectId: null,
      projects: [],
      projectStorageError: error instanceof Error ? error.message : 'Browser storage is unavailable.',
      storageStatus: 'failed',
      storageError: error instanceof Error ? error.message : 'Browser storage is unavailable.',
      projectStorageStatus: 'failed',
    }
  }
}

export function workspaceReducer(state, action) {
  if (action.type === 'commit') {
    if (JSON.stringify(state.dfa) === JSON.stringify(action.dfa)) return state
    return {
      dfa: action.dfa,
      past: [...state.past.slice(-(WORKSPACE_HISTORY_LIMIT - 1)), state.dfa],
      future: [],
      activeProjectId: state.activeProjectId,
      projects: state.projects,
      projectStorageError: state.projectStorageError,
      storageStatus: state.storageStatus,
      storageError: state.storageError,
      projectStorageStatus: state.projectStorageStatus,
    }
  }
  if (action.type === 'undo' && state.past.length > 0) {
    return {
      ...state,
      dfa: state.past[state.past.length - 1],
      past: state.past.slice(0, -1),
      future: [state.dfa, ...state.future].slice(0, WORKSPACE_HISTORY_LIMIT),
    }
  }
  if (action.type === 'redo' && state.future.length > 0) {
    return {
      ...state,
      dfa: state.future[0],
      past: [...state.past.slice(-(WORKSPACE_HISTORY_LIMIT - 1)), state.dfa],
      future: state.future.slice(1),
    }
  }
  if (action.type === 'load-project' || action.type === 'replace-workspace') {
    return {
      ...state,
      dfa: action.dfa,
      past: [],
      future: [],
      activeProjectId: action.type === 'load-project' ? action.projectId : null,
    }
  }
  if (action.type === 'set-projects') {
    return {
      ...state,
      projects: action.projects,
      activeProjectId: Object.hasOwn(action, 'activeProjectId')
        ? action.activeProjectId
        : state.activeProjectId,
      projectStorageError: action.error ?? null,
      projectStorageStatus: action.error ? 'failed' : 'saved',
    }
  }
  if (action.type === 'workspace-status') {
    return {
      ...state,
      storageStatus: action.error ? 'failed' : action.status ?? 'saved',
      storageError: action.error ?? null,
    }
  }
  return state
}

export function DfaWorkspaceProvider({ children }) {
  const [state, dispatch] = useReducer(
    workspaceReducer,
    null,
    getInitialState,
  )
  const persistedSnapshot = useRef(JSON.stringify([state.dfa, state.activeProjectId]))
  useEffect(() => {
    const snapshot = JSON.stringify([state.dfa, state.activeProjectId])
    if (persistedSnapshot.current === snapshot) return
    persistedSnapshot.current = snapshot
    dispatch({ type: 'workspace-status', status: 'saving' })
    try {
      writeWorkspace(state.dfa, globalThis.localStorage, state.activeProjectId)
      dispatch({ type: 'workspace-status', error: null })
    } catch (error) {
      persistedSnapshot.current = null
      dispatch({
        type: 'workspace-status',
        error: error instanceof Error ? error.message : 'Could not save the current workspace.',
      })
    }
  }, [state.dfa, state.activeProjectId])

  const commit = useCallback((dfa) => dispatch({ type: 'commit', dfa }), [])
  const undo = useCallback(() => dispatch({ type: 'undo' }), [])
  const redo = useCallback(() => dispatch({ type: 'redo' }), [])
  const loadProject = useCallback((project) => dispatch({
    type: 'load-project',
    dfa: project.dfa,
    projectId: project.id,
  }), [])
  const replaceWorkspace = useCallback((dfa) => dispatch({ type: 'replace-workspace', dfa }), [])
  const setProjects = useCallback((projects, activeProjectId, error) => {
    if (state.projectStorageError) {
      throw new Error(
        `Saved project storage could not be read, so it was left unchanged. ${state.projectStorageError}`,
      )
    }
    try {
      writeProjects(projects, globalThis.localStorage)
      dispatch({ type: 'set-projects', projects, activeProjectId, error: null })
    } catch (caught) {
      dispatch({
        type: 'set-projects',
        projects: state.projects,
        error: caught instanceof Error ? caught.message : 'Could not save project data.',
      })
      throw caught
    }
  }, [state.projectStorageError, state.projects])

  const value = {
    dfa: state.dfa,
    commit,
    undo,
    redo,
    loadProject,
    replaceWorkspace,
    projects: state.projects,
    setProjects,
    activeProjectId: state.activeProjectId,
    storageStatus: state.storageStatus,
    storageError: state.storageError,
    projectStorageStatus: state.projectStorageStatus,
    projectStorageError: state.projectStorageError,
    canUndo: state.past.length > 0,
    canRedo: state.future.length > 0,
  }

  return <DfaWorkspaceContext.Provider value={value}>{children}</DfaWorkspaceContext.Provider>
}

export function useDfaWorkspace() {
  const context = useContext(DfaWorkspaceContext)
  if (!context) throw new Error('useDfaWorkspace must be used within DfaWorkspaceProvider.')
  return context
}
