import { validateDFA } from './engine.js'

export const STORAGE_VERSION = 1
export const WORKSPACE_STORAGE_KEY = 'dfa-studio.workspace'
export const PROJECTS_STORAGE_KEY = 'dfa-studio.projects'

function createId(prefix) {
  const uuid = globalThis.crypto?.randomUUID?.()
  return uuid ? `${prefix}-${uuid}` : `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`
}

function assertStorage(storage) {
  if (!storage || typeof storage.getItem !== 'function' || typeof storage.setItem !== 'function') {
    throw new Error('Browser storage is unavailable.')
  }
}

function cloneDfa(dfa) {
  return JSON.parse(JSON.stringify(dfa))
}

export function validateDfaData(dfa, { allowDraft = false, allowMissingTransitions = false } = {}) {
  const requiredProperties = [
    'id',
    'name',
    'states',
    'alphabet',
    'initialState',
    'finalStates',
    'transitions',
    'positions',
  ]
  if (!dfa || typeof dfa !== 'object' || Array.isArray(dfa)) {
    throw new Error('DFA data must be a JSON object.')
  }
  const missing = requiredProperties.filter((property) => !Object.hasOwn(dfa, property))
  if (missing.length) {
    throw new Error(`DFA data is missing required properties: ${missing.join(', ')}.`)
  }
  if (typeof dfa.id !== 'string' || !dfa.id.trim()) throw new Error('DFA ID must be a non-empty string.')
  if (typeof dfa.name !== 'string' || !dfa.name.trim()) throw new Error('DFA name must be a non-empty string.')
  if (!Array.isArray(dfa.states)) throw new Error('DFA states must be an array.')
  if (!Array.isArray(dfa.alphabet)) throw new Error('DFA alphabet must be an array.')
  if (!(typeof dfa.initialState === 'string' || dfa.initialState === null)) {
    throw new Error('DFA initialState must be a state ID or null.')
  }
  if (!Array.isArray(dfa.finalStates)) throw new Error('DFA finalStates must be an array.')
  if (!Array.isArray(dfa.transitions)) throw new Error('DFA transitions must be an array.')
  if (!dfa.positions || typeof dfa.positions !== 'object' || Array.isArray(dfa.positions)) {
    throw new Error('DFA positions must be an object.')
  }

  for (const [index, state] of dfa.states.entries()) {
    if (!state || typeof state !== 'object' || Array.isArray(state)) {
      throw new Error(`State ${index + 1} must be an object.`)
    }
    if (typeof state.id !== 'string' || !state.id.trim()) {
      throw new Error(`State ${index + 1} must have a non-empty string ID.`)
    }
    if (typeof state.name !== 'string' || !state.name.trim()) {
      throw new Error(`State "${state.id}" must have a non-empty name.`)
    }
  }
  for (const [index, symbol] of dfa.alphabet.entries()) {
    if (typeof symbol !== 'string' || Array.from(symbol).length !== 1) {
      throw new Error(`Alphabet symbol ${index + 1} must be one Unicode code point.`)
    }
  }
  for (const [index, transition] of dfa.transitions.entries()) {
    if (!transition || typeof transition !== 'object' || Array.isArray(transition)) {
      throw new Error(`Transition ${index + 1} must be an object.`)
    }
    if (typeof transition.id !== 'string' || !transition.id.trim()) {
      throw new Error(`Transition ${index + 1} must have a non-empty string ID.`)
    }
    if (typeof transition.from !== 'string' || typeof transition.to !== 'string') {
      throw new Error(`Transition ${index + 1} must reference source and destination state IDs.`)
    }
    if (typeof transition.symbol !== 'string') {
      throw new Error(`Transition ${index + 1} must have a string symbol.`)
    }
  }
  for (const [stateId, position] of Object.entries(dfa.positions)) {
    if (!dfa.states.some((state) => state.id === stateId) || !position || typeof position !== 'object' ||
      !Number.isFinite(position.x) || !Number.isFinite(position.y)) {
      throw new Error(`Position for state "${stateId}" must contain finite x and y values.`)
    }
  }

  const validation = validateDFA(dfa)
  const allowedErrorCodes = new Set()
  if (allowDraft) {
    allowedErrorCodes.add('no-states')
    allowedErrorCodes.add('missing-initial-state')
  }
  if (allowDraft || allowMissingTransitions) allowedErrorCodes.add('missing-transition')
  const errors = validation.errors.filter((error) => !allowedErrorCodes.has(error.code))
  if (errors.length) {
    throw new Error(`Invalid DFA: ${errors.map((error) => error.message).join(' ')}`)
  }
  if (!allowDraft && dfa.alphabet.length === 0) {
    throw new Error('DFA alphabet must contain at least one symbol.')
  }
  return dfa
}

export function readWorkspace(storage = globalThis.localStorage) {
  assertStorage(storage)
  let serialized
  try {
    serialized = storage.getItem(WORKSPACE_STORAGE_KEY)
  } catch (error) {
    return { dfa: null, error: `Could not read the saved workspace: ${error.message}` }
  }
  if (serialized === null) return { dfa: null, error: null }
  try {
    const stored = JSON.parse(serialized)
    if (stored?.version !== STORAGE_VERSION) {
      return { dfa: null, error: `Unsupported workspace storage version: ${String(stored?.version)}.` }
    }
    validateDfaData(stored.dfa, { allowDraft: true })
    return {
      dfa: stored.dfa,
      activeProjectId: typeof stored.activeProjectId === 'string' ? stored.activeProjectId : null,
      error: null,
    }
  } catch (error) {
    return {
      dfa: null,
      error: `Saved workspace data is invalid and was not restored. ${error instanceof Error ? error.message : ''}`.trim(),
    }
  }
}

export function writeWorkspace(dfa, storage = globalThis.localStorage, activeProjectId = null) {
  assertStorage(storage)
  validateDfaData(dfa, { allowDraft: true })
  storage.setItem(WORKSPACE_STORAGE_KEY, JSON.stringify({
    version: STORAGE_VERSION,
    savedAt: new Date().toISOString(),
    activeProjectId,
    dfa,
  }))
}

function validateProject(project) {
  if (!project || typeof project !== 'object' || Array.isArray(project)) {
    throw new Error('Saved project must be an object.')
  }
  if (typeof project.id !== 'string' || !project.id.trim()) throw new Error('Project ID is invalid.')
  if (typeof project.name !== 'string' || !project.name.trim()) throw new Error('Project name cannot be empty.')
  if (typeof project.description !== 'string') throw new Error(`Description for "${project.name}" must be text.`)
  if (typeof project.createdAt !== 'string' || Number.isNaN(Date.parse(project.createdAt))) {
    throw new Error(`Creation date for "${project.name}" is invalid.`)
  }
  if (typeof project.updatedAt !== 'string' || Number.isNaN(Date.parse(project.updatedAt))) {
    throw new Error(`Last modified date for "${project.name}" is invalid.`)
  }
  validateDfaData(project.dfa, { allowMissingTransitions: true })
  return project
}

export function readProjects(storage = globalThis.localStorage) {
  assertStorage(storage)
  let serialized
  try {
    serialized = storage.getItem(PROJECTS_STORAGE_KEY)
  } catch (error) {
    return { projects: [], error: `Could not read saved projects: ${error.message}` }
  }
  if (serialized === null) return { projects: [], error: null }
  try {
    const stored = JSON.parse(serialized)
    if (stored?.version !== STORAGE_VERSION) {
      return { projects: [], error: `Unsupported project storage version: ${String(stored?.version)}.` }
    }
    if (!Array.isArray(stored.projects)) throw new Error('Saved projects must be an array.')
    const projects = stored.projects.map(validateProject)
    return { projects, error: null }
  } catch (error) {
    return {
      projects: [],
      error: `Saved project data is invalid and was not loaded. ${error instanceof Error ? error.message : ''}`.trim(),
    }
  }
}

export function writeProjects(projects, storage = globalThis.localStorage) {
  assertStorage(storage)
  const existing = readProjects(storage)
  if (existing.error) {
    throw new Error(`Saved project storage could not be read, so it was left unchanged. ${existing.error}`)
  }
  if (!Array.isArray(projects)) throw new TypeError('Projects must be an array.')
  projects.forEach(validateProject)
  storage.setItem(PROJECTS_STORAGE_KEY, JSON.stringify({
    version: STORAGE_VERSION,
    projects,
  }))
}

function assertUniqueName(projects, name, ignoredId = null) {
  const normalized = name.trim().toLocaleLowerCase()
  if (!normalized) throw new Error('Project name cannot be empty.')
  if (projects.some((project) => project.id !== ignoredId &&
    project.name.trim().toLocaleLowerCase() === normalized)) {
    throw new Error(`A project named "${name.trim()}" already exists.`)
  }
}

export function saveProject(projects, dfa, { name, description = '', projectId = null } = {}) {
  if (typeof name !== 'string') throw new Error('Project name cannot be empty.')
  if (typeof description !== 'string') throw new Error('Project description must be text.')
  validateDfaData(dfa, { allowMissingTransitions: true })
  assertUniqueName(projects, name, projectId)

  const existing = projectId ? projects.find((project) => project.id === projectId) : null
  if (projectId && !existing) throw new Error('The saved project no longer exists.')
  const now = new Date().toISOString()
  const project = {
    id: existing?.id ?? createId('project'),
    name: name.trim(),
    description: description.trim(),
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
    dfa: cloneDfa(dfa),
  }
  return {
    project,
    projects: existing
      ? projects.map((candidate) => candidate.id === existing.id ? project : candidate)
      : [project, ...projects],
  }
}

export function renameProject(projects, projectId, name) {
  if (typeof name !== 'string') throw new Error('Project name cannot be empty.')
  const project = projects.find((candidate) => candidate.id === projectId)
  if (!project) throw new Error('The saved project no longer exists.')
  assertUniqueName(projects, name, projectId)
  const renamed = { ...project, name: name.trim(), updatedAt: new Date().toISOString() }
  return projects.map((candidate) => candidate.id === projectId ? renamed : candidate)
}

export function deleteProject(projects, projectId) {
  if (!projects.some((project) => project.id === projectId)) {
    throw new Error('The saved project no longer exists.')
  }
  return projects.filter((project) => project.id !== projectId)
}

export function duplicateProject(projects, projectId) {
  const original = projects.find((project) => project.id === projectId)
  if (!original) throw new Error('The saved project no longer exists.')
  const baseName = `${original.name} copy`
  let name = baseName
  let suffix = 2
  while (projects.some((project) => project.name.toLocaleLowerCase() === name.toLocaleLowerCase())) {
    name = `${baseName} ${suffix}`
    suffix += 1
  }
  const now = new Date().toISOString()
  const duplicate = {
    ...original,
    id: createId('project'),
    name,
    createdAt: now,
    updatedAt: now,
    dfa: cloneDfa(original.dfa),
  }
  return { project: duplicate, projects: [duplicate, ...projects] }
}

export function createProjectExport(project, dfa = project?.dfa) {
  validateDfaData(dfa, { allowMissingTransitions: true })
  return {
    format: 'dfa-studio',
    version: STORAGE_VERSION,
    exportedAt: new Date().toISOString(),
    metadata: project
      ? {
          name: project.name,
          description: project.description,
          createdAt: project.createdAt,
          updatedAt: project.updatedAt,
        }
      : null,
    dfa,
  }
}

export function parseProjectImport(text) {
  let file
  try {
    file = JSON.parse(text)
  } catch {
    throw new Error('The selected file is not valid JSON.')
  }
  if (!file || typeof file !== 'object' || Array.isArray(file)) {
    throw new Error('The import file must contain a JSON object.')
  }
  if (file.format !== 'dfa-studio') throw new Error('This file is not a DFA Studio export.')
  if (file.version !== STORAGE_VERSION) {
    throw new Error(`Unsupported DFA file version: ${String(file.version)}.`)
  }
  validateDfaData(file.dfa, { allowMissingTransitions: true })
  const metadata = file.metadata ?? {}
  if (typeof metadata !== 'object' || Array.isArray(metadata)) {
    throw new Error('Project metadata must be an object.')
  }
  if (metadata.name !== undefined && typeof metadata.name !== 'string') {
    throw new Error('Project name metadata must be text.')
  }
  if (metadata.description !== undefined && typeof metadata.description !== 'string') {
    throw new Error('Project description metadata must be text.')
  }
  for (const property of ['createdAt', 'updatedAt']) {
    if (metadata[property] !== undefined &&
      (typeof metadata[property] !== 'string' || Number.isNaN(Date.parse(metadata[property])))) {
      throw new Error(`Project ${property} metadata must be a valid date string.`)
    }
  }
  return { dfa: file.dfa, metadata }
}
