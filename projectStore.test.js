import { describe, expect, it } from 'vitest'
import { createDFA } from './engine.js'
import {
  createProjectExport,
  deleteProject,
  duplicateProject,
  parseProjectImport,
  PROJECTS_STORAGE_KEY,
  readProjects,
  readWorkspace,
  renameProject,
  saveProject,
  STORAGE_VERSION,
  validateDfaData,
  writeProjects,
  writeWorkspace,
  WORKSPACE_STORAGE_KEY,
} from './projectStore.js'

function createMemoryStorage(entries = {}) {
  const values = new Map(Object.entries(entries))
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, String(value)),
    removeItem: (key) => values.delete(key),
  }
}

function validDfa() {
  return createDFA({
    id: 'persisted',
    name: 'Binary DFA',
    states: [{ id: 'q0', name: 'Start' }, { id: 'q1', name: 'Accept' }],
    alphabet: ['0', '1'],
    initialState: 'q0',
    finalStates: ['q1'],
    transitions: [
      { id: 't00', from: 'q0', symbol: '0', to: 'q0' },
      { id: 't01', from: 'q0', symbol: '1', to: 'q1' },
      { id: 't10', from: 'q1', symbol: '0', to: 'q0' },
      { id: 't11', from: 'q1', symbol: '1', to: 'q1' },
    ],
    positions: { q0: { x: 10, y: 20 }, q1: { x: 90, y: 20 } },
  })
}

function newProject(dfa = validDfa(), name = 'Project One') {
  return saveProject([], dfa, { name, description: 'First description' }).project
}

describe('LocalStorage workspace persistence', () => {
  it('saves and restores versioned DFA data and current project association', () => {
    const storage = createMemoryStorage()
    const dfa = validDfa()
    writeWorkspace(dfa, storage, 'project-one')

    const result = readWorkspace(storage)
    expect(result).toMatchObject({ dfa, activeProjectId: 'project-one', error: null })
    expect(JSON.parse(storage.getItem(WORKSPACE_STORAGE_KEY))).toMatchObject({
      version: STORAGE_VERSION,
      dfa,
    })
  })

  it('handles missing and corrupted workspace storage safely', () => {
    const storage = createMemoryStorage()
    expect(readWorkspace(storage)).toMatchObject({ dfa: null, error: null })

    storage.setItem(WORKSPACE_STORAGE_KEY, '{broken')
    expect(readWorkspace(storage)).toMatchObject({ dfa: null, error: expect.stringMatching(/invalid/) })
  })

  it('rejects unsupported workspace and project storage versions', () => {
    const storage = createMemoryStorage({
      [WORKSPACE_STORAGE_KEY]: JSON.stringify({ version: STORAGE_VERSION + 1, dfa: validDfa() }),
      [PROJECTS_STORAGE_KEY]: JSON.stringify({ version: STORAGE_VERSION + 1, projects: [] }),
    })
    expect(readWorkspace(storage).error).toMatch(/Unsupported workspace storage version/)
    expect(readProjects(storage)).toMatchObject({
      projects: [],
      error: expect.stringMatching(/Unsupported project storage version/),
    })
  })

  it('stores and reloads a versioned project list', () => {
    const storage = createMemoryStorage()
    const project = newProject()
    writeProjects([project], storage)
    expect(readProjects(storage)).toEqual({ projects: [project], error: null })
  })

  it('does not restore malformed project data from storage', () => {
    const project = newProject()
    const malformed = { ...project, dfa: { ...project.dfa, initialState: 'missing' } }
    const storage = createMemoryStorage({
      [PROJECTS_STORAGE_KEY]: JSON.stringify({ version: STORAGE_VERSION, projects: [malformed] }),
    })
    expect(readProjects(storage)).toMatchObject({
      projects: [],
      error: expect.stringMatching(/invalid and was not loaded/),
    })
  })

  it('refuses to overwrite unsupported project data during recovery', () => {
    const rawProjects = JSON.stringify({ version: STORAGE_VERSION + 1, projects: [{ id: 'legacy' }] })
    const storage = createMemoryStorage({ [PROJECTS_STORAGE_KEY]: rawProjects })

    expect(readProjects(storage).error).toMatch(/Unsupported project storage version/)
    expect(() => writeProjects([], storage)).toThrow(/left unchanged/)
    expect(storage.getItem(PROJECTS_STORAGE_KEY)).toBe(rawProjects)
  })
})

describe('saved DFA project management', () => {
  it('saves a named project with description and creation/modified dates', () => {
    const result = saveProject([], validDfa(), { name: '  My DFA  ', description: '  Notes  ' })
    expect(result.projects).toHaveLength(1)
    expect(result.project).toMatchObject({
      name: 'My DFA',
      description: 'Notes',
      dfa: validDfa(),
    })
    expect(Date.parse(result.project.createdAt)).not.toBeNaN()
    expect(result.project.updatedAt).toBe(result.project.createdAt)
  })

  it('updates an existing project while preserving its creation date', () => {
    const original = newProject()
    const changedDfa = { ...original.dfa, name: 'Changed DFA' }
    const result = saveProject([original], changedDfa, {
      name: original.name,
      description: 'Updated',
      projectId: original.id,
    })

    expect(result.projects).toHaveLength(1)
    expect(result.project).toMatchObject({
      id: original.id,
      createdAt: original.createdAt,
      description: 'Updated',
      dfa: changedDfa,
    })
  })

  it('preserves existing named projects when adding another project', () => {
    const first = newProject(validDfa(), 'First DFA')
    const secondDfa = { ...validDfa(), id: 'second-dfa', name: 'Second DFA' }
    const secondResult = saveProject([first], secondDfa, { name: 'Second DFA' })
    const storage = createMemoryStorage()
    writeProjects(secondResult.projects, storage)

    expect(readProjects(storage).projects.map((project) => project.name)).toEqual([
      'Second DFA',
      'First DFA',
    ])
    expect(secondResult.projects.find((project) => project.id === first.id)).toEqual(first)
  })

  it('saves an incomplete DFA exactly as-is without adding a dead state or transitions', () => {
    const incompleteDfa = {
      ...validDfa(),
      transitions: validDfa().transitions.slice(0, 3),
    }

    expect(() => validateDfaData(incompleteDfa)).toThrow(/Missing transition/)
    const { project } = saveProject([], incompleteDfa, { name: 'Incomplete DFA' })

    expect(project.dfa).toEqual(incompleteDfa)
    expect(project.dfa.states).toHaveLength(2)
    expect(project.dfa.transitions).toHaveLength(3)
  })

  it('restores, exports, and imports incomplete saved projects without completing them', () => {
    const storage = createMemoryStorage()
    const incompleteDfa = {
      ...validDfa(),
      transitions: validDfa().transitions.slice(0, 3),
    }
    const { project } = saveProject([], incompleteDfa, { name: 'Partial DFA' })
    writeProjects([project], storage)
    const restoredProject = readProjects(storage).projects[0]
    const exported = createProjectExport(restoredProject)
    const imported = parseProjectImport(JSON.stringify(exported))

    expect(restoredProject.dfa).toEqual(incompleteDfa)
    expect(imported.dfa).toEqual(incompleteDfa)
    expect(imported.dfa.states).toHaveLength(2)
    expect(imported.dfa.transitions).toHaveLength(3)
  })

  it('rejects empty and duplicate project names case-insensitively', () => {
    const original = newProject()
    expect(() => saveProject([original], validDfa(), { name: ' ' })).toThrow(/cannot be empty/)
    expect(() => saveProject([original], validDfa(), { name: 'project one' })).toThrow(/already exists/)
    expect(() => renameProject([original], original.id, '')).toThrow(/cannot be empty/)
    expect(() => renameProject([original], original.id, 'PROJECT ONE')).not.toThrow()
  })

  it('renames, duplicates, and deletes projects', () => {
    const original = newProject()
    const renamed = renameProject([original], original.id, 'Renamed')
    expect(renamed[0].name).toBe('Renamed')

    const duplicated = duplicateProject(renamed, original.id)
    expect(duplicated.project.name).toBe('Renamed copy')
    expect(duplicated.project.id).not.toBe(original.id)
    expect(duplicated.project.dfa).toEqual(original.dfa)
    expect(deleteProject(duplicated.projects, original.id).map((project) => project.id))
      .toEqual([duplicated.project.id])
  })
})

describe('DFA JSON import and export', () => {
  it('exports and re-imports complete DFA structure and metadata', () => {
    const project = newProject()
    const exported = createProjectExport(project)
    const imported = parseProjectImport(JSON.stringify(exported))
    expect(exported).toMatchObject({ format: 'dfa-studio', version: STORAGE_VERSION })
    expect(imported.dfa).toEqual(project.dfa)
    expect(imported.metadata).toMatchObject({ name: project.name, description: project.description })
  })

  it('rejects malformed JSON, unknown format, and incompatible versions', () => {
    expect(() => parseProjectImport('{oops')).toThrow(/not valid JSON/)
    expect(() => parseProjectImport(JSON.stringify({ format: 'other', version: STORAGE_VERSION })))
      .toThrow(/not a DFA Studio export/)
    expect(() => parseProjectImport(JSON.stringify({
      format: 'dfa-studio',
      version: STORAGE_VERSION + 1,
      dfa: validDfa(),
    }))).toThrow(/Unsupported DFA file version/)
  })

  it('rejects missing properties, invalid references, and malformed transitions', () => {
    const base = createProjectExport(null, validDfa())
    const missing = { ...base, dfa: { ...base.dfa } }
    delete missing.dfa.transitions
    expect(() => parseProjectImport(JSON.stringify(missing))).toThrow(/missing required properties/)

    const invalidReference = {
      ...base,
      dfa: { ...base.dfa, initialState: 'unknown' },
    }
    expect(() => parseProjectImport(JSON.stringify(invalidReference))).toThrow(/Initial state/)

    const invalidTransition = {
      ...base,
      dfa: {
        ...base.dfa,
        transitions: [{ id: 'bad', from: 'q0', symbol: '0', to: 'unknown' }],
      },
    }
    expect(() => parseProjectImport(JSON.stringify(invalidTransition))).toThrow(/destination/)
  })

  it('requires a valid initial state and non-empty alphabet for saved/imported projects', () => {
    expect(() => validateDfaData({ ...validDfa(), initialState: null })).toThrow(/initial state/)
    expect(() => validateDfaData({ ...validDfa(), alphabet: [] })).toThrow(/alphabet/)
  })
})
