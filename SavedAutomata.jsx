import { useMemo, useRef, useState } from 'react'
import {
  AlertTriangle,
  Check,
  Copy,
  Download,
  FileJson,
  FolderOpen,
  Pencil,
  Plus,
  Save,
  Trash2,
  Upload,
  X,
} from 'lucide-react'
import PageLayout from '../components/PageLayout.jsx'
import DfaActionModal from '../components/DfaActionModal.jsx'
import { useDfaWorkspace } from '../dfa/DfaWorkspaceContext.jsx'
import {
  createProjectExport,
  deleteProject,
  duplicateProject,
  parseProjectImport,
  renameProject,
  saveProject,
} from '../dfa/projectStore.js'
import { downloadBlob } from '../dfa/exports.js'
import { completeDFA } from '../dfa/engine.js'
import { getValidationReport } from '../dfa/validationReport.js'

function formatDate(value) {
  const date = new Date(value)
  return Number.isNaN(date.getTime())
    ? 'Unknown'
    : new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(date)
}

function downloadJson(value, filename) {
  const blob = new Blob([JSON.stringify(value, null, 2)], { type: 'application/json' })
  downloadBlob(blob, filename)
}

function safeFilename(name) {
  const filename = name.trim().replace(/[^\w-]+/g, '-').replace(/^-+|-+$/g, '')
  return filename || 'dfa-project'
}

export default function SavedAutomata() {
  const {
    dfa,
    projects,
    setProjects,
    activeProjectId,
    loadProject,
    replaceWorkspace,
    commit,
    projectStorageStatus,
    projectStorageError,
  } = useDfaWorkspace()
  const [saveFormOpen, setSaveFormOpen] = useState(false)
  const [saveChoiceOpen, setSaveChoiceOpen] = useState(false)
  const [saveAsNew, setSaveAsNew] = useState(false)
  const [projectName, setProjectName] = useState(dfa.name)
  const [description, setDescription] = useState('')
  const [editingProjectId, setEditingProjectId] = useState(null)
  const [editingName, setEditingName] = useState('')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [importing, setImporting] = useState(false)
  const fileInput = useRef(null)

  const activeProject = projects.find((project) => project.id === activeProjectId) ?? null
  const isUnsaved = activeProject
    ? JSON.stringify(activeProject.dfa) !== JSON.stringify(dfa)
    : dfa.states.length > 0 || dfa.alphabet.length > 0 || dfa.transitions.length > 0
  const sortedProjects = useMemo(
    () => [...projects].sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt)),
    [projects],
  )
  const validationReport = useMemo(() => getValidationReport(dfa), [dfa])
  const missingTransitionCount = validationReport.errors
    .filter((entry) => entry.code === 'missing-transition').length
  const canCompleteAndSave = missingTransitionCount > 0 &&
    validationReport.errors.every((entry) => entry.code === 'missing-transition') &&
    dfa.states.length > 0 &&
    dfa.alphabet.length > 0

  const clearFeedback = () => {
    setMessage('')
    setError('')
  }

  const openSaveForm = () => {
    clearFeedback()
    setProjectName(activeProject?.name ?? dfa.name)
    setDescription(activeProject?.description ?? '')
    setSaveFormOpen((open) => !open)
  }

  const persistProject = (dfaToSave, saveAsNewProject = false) => {
    clearFeedback()
    try {
      const { project, projects: nextProjects } = saveProject(projects, dfaToSave, {
        name: projectName,
        description,
        projectId: saveAsNewProject ? null : activeProject?.id ?? null,
      })
      setProjects(nextProjects, project.id)
      setSaveFormOpen(false)
      setSaveChoiceOpen(false)
      setMessage(`"${project.name}" saved successfully.`)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not save this DFA project.')
    }
  }

  const requestSaveProject = (event, saveAsNewProject = false) => {
    event.preventDefault()
    clearFeedback()
    setSaveAsNew(saveAsNewProject)
    if (missingTransitionCount > 0) {
      setSaveChoiceOpen(true)
      return
    }
    persistProject(dfa, saveAsNewProject)
  }

  const saveIncompleteAsIs = () => persistProject(dfa, saveAsNew)

  const completeAndSave = () => {
    if (!canCompleteAndSave) return
    clearFeedback()
    try {
      const completedDfa = completeDFA(dfa)
      const { project, projects: nextProjects } = saveProject(projects, completedDfa, {
        name: projectName,
        description,
        projectId: saveAsNew ? null : activeProject?.id ?? null,
      })
      setProjects(nextProjects, project.id)
      commit(completedDfa)
      setSaveFormOpen(false)
      setSaveChoiceOpen(false)
      setMessage(`"${project.name}" was completed and saved successfully.`)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not complete and save this DFA.')
    }
  }

  const confirmReplacement = (projectNameToLoad) => {
    if (!isUnsaved) return true
    return window.confirm(
      `Replace the current unsaved DFA with "${projectNameToLoad}"? Unsaved workspace changes will be lost.`,
    )
  }

  const handleOpen = (project) => {
    clearFeedback()
    if (!confirmReplacement(project.name)) return
    loadProject(project)
    setProjectName(project.name)
    setDescription(project.description)
    setMessage(`Opened "${project.name}". The Designer, Simulator, and tables now use this DFA.`)
  }

  const handleRename = (project) => {
    clearFeedback()
    try {
      const nextProjects = renameProject(projects, project.id, editingName)
      setProjects(nextProjects, activeProjectId)
      setEditingProjectId(null)
      setMessage(`Project renamed to "${editingName.trim()}".`)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not rename this project.')
    }
  }

  const handleDelete = (project) => {
    if (!window.confirm(`Delete "${project.name}"? This action cannot be undone.`)) return
    clearFeedback()
    try {
      const nextProjects = deleteProject(projects, project.id)
      setProjects(nextProjects, activeProjectId === project.id ? null : activeProjectId)
      setMessage(`"${project.name}" was deleted.`)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not delete this project.')
    }
  }

  const handleDuplicate = (project) => {
    clearFeedback()
    try {
      const result = duplicateProject(projects, project.id)
      setProjects(result.projects, activeProjectId)
      setMessage(`Created "${result.project.name}".`)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not duplicate this project.')
    }
  }

  const exportProject = (project) => {
    clearFeedback()
    try {
      downloadJson(createProjectExport(project), `${safeFilename(project.name)}.json`)
      setMessage(`Exported "${project.name}" as JSON.`)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not export this DFA.')
    }
  }

  const exportCurrent = () => {
    clearFeedback()
    try {
      downloadJson(
        createProjectExport(activeProject, dfa),
        `${safeFilename(activeProject?.name ?? dfa.name)}.json`,
      )
      setMessage('Current DFA exported as JSON.')
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not export the current DFA.')
    }
  }

  const importFile = async (event) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    clearFeedback()
    setImporting(true)
    try {
      const { dfa: importedDfa } = parseProjectImport(await file.text())
      if (!confirmReplacement(importedDfa.name)) return
      replaceWorkspace(importedDfa)
      setProjectName(importedDfa.name)
      setDescription('')
      setMessage(`Imported "${importedDfa.name}" into the current workspace. Save it as a project to keep it in Saved Automata.`)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not import this DFA file.')
    } finally {
      setImporting(false)
    }
  }

  const openRename = (project) => {
    clearFeedback()
    setEditingProjectId(project.id)
    setEditingName(project.name)
  }

  return (
    <PageLayout
      title="Saved Automata"
      description="Manage named DFA projects stored in this browser."
      actions={
        <>
          <button type="button" className="button button-secondary" onClick={() => fileInput.current?.click()} disabled={importing}>
            <Upload size={15} />{importing ? 'Importing…' : 'Import JSON'}
          </button>
          <button type="button" className="button button-secondary" onClick={exportCurrent}>
            <Download size={15} />Export Current
          </button>
          <button type="button" className="button button-primary" onClick={openSaveForm}>
            <Plus size={15} />Save Current DFA
          </button>
          <input
            ref={fileInput}
            className="visually-hidden-file-input"
            type="file"
            accept=".json,application/json"
            onChange={importFile}
            aria-label="Import DFA JSON file"
          />
        </>
      }
    >
      <div className="saved-automata-page">
        <div className="saved-page-status">
          <span className={`saved-storage-indicator ${projectStorageStatus}`} />
          <span>{projectStorageStatus === 'failed' ? 'Project storage unavailable' : 'Projects stored in this browser'}</span>
          <small>Current workspace autosaves separately.</small>
        </div>

        {(projectStorageError || error) && (
          <p className="saved-feedback error" role="alert">
            <AlertTriangle size={14} />{error || projectStorageError}
          </p>
        )}
        {message && <p className="saved-feedback success" role="status"><Check size={14} />{message}</p>}

        {saveFormOpen && (
          <form className="saved-project-form" onSubmit={(event) => requestSaveProject(event)}>
            <div className="saved-form-heading">
              <div>
                <h2>{activeProject ? 'Save changes to project' : 'Save DFA as a project'}</h2>
                <p>Project metadata is separate from the current working DFA.</p>
              </div>
              <button type="button" className="saved-icon-button" aria-label="Close save form" onClick={() => setSaveFormOpen(false)}>
                <X size={15} />
              </button>
            </div>
            <label>
              <span>Project name</span>
              <input value={projectName} onChange={(event) => setProjectName(event.target.value)} required maxLength={100} autoFocus />
            </label>
            <label>
              <span>Description <small>Optional</small></span>
              <textarea value={description} onChange={(event) => setDescription(event.target.value)} rows={2} maxLength={500} />
            </label>
            <div className="saved-form-actions">
              <button type="submit" className="button button-primary"><Save size={14} />{activeProject ? 'Save Changes' : 'Save Project'}</button>
              {activeProject && (
                <button type="button" className="button button-secondary" onClick={(event) => requestSaveProject(event, true)}>
                  Save as New Project
                </button>
              )}
              <span>{dfa.states.length} states · {dfa.transitions.length} transitions</span>
            </div>
          </form>
        )}

        {sortedProjects.length === 0 ? (
          <section className="saved-empty-state">
            <span className="saved-empty-icon"><FolderOpen size={23} /></span>
            <h2>No saved automata yet</h2>
            <p>Save the current DFA as a named project, or import a DFA Studio JSON file to continue working.</p>
            <button type="button" className="button button-primary" onClick={openSaveForm}><Plus size={14} />Save Current DFA</button>
          </section>
        ) : (
          <div className="saved-project-grid">
            {sortedProjects.map((project) => {
              const missing = getValidationReport(project.dfa).errors
                .filter((entry) => entry.code === 'missing-transition').length
              return (
                <article className={`saved-project-card${activeProjectId === project.id ? ' active-project' : ''}`} key={project.id}>
                  <div className="saved-project-card-head">
                    <div className="saved-project-mark"><FileJson size={17} /></div>
                    {activeProjectId === project.id && <span className="active-project-badge">Current project</span>}
                  </div>
                  {editingProjectId === project.id ? (
                    <form
                      className="saved-rename-form"
                      onSubmit={(event) => {
                        event.preventDefault()
                        handleRename(project)
                      }}
                    >
                      <input value={editingName} onChange={(event) => setEditingName(event.target.value)} autoFocus maxLength={100} aria-label={`New name for ${project.name}`} />
                      <button type="submit" aria-label="Save project name"><Check size={14} /></button>
                      <button type="button" aria-label="Cancel rename" onClick={() => setEditingProjectId(null)}><X size={14} /></button>
                    </form>
                  ) : (
                    <>
                      <h2>{project.name}</h2>
                      <p className="saved-project-description">{project.description || 'No description provided.'}</p>
                    </>
                  )}
                  <div className="saved-project-stats">
                    <span><strong>{project.dfa.states.length}</strong> states</span>
                    <span><strong>{project.dfa.alphabet.length}</strong> symbols</span>
                    <span><strong>{project.dfa.transitions.length}</strong> transitions</span>
                  </div>
                  {missing > 0 && (
                    <span className="saved-project-incomplete" aria-label={`${missing} missing transitions`}>
                      Incomplete · {missing} missing transition{missing === 1 ? '' : 's'}
                    </span>
                  )}
                  <div className="saved-project-dates">
                    <span>Created <time dateTime={project.createdAt}>{formatDate(project.createdAt)}</time></span>
                    <span>Modified <time dateTime={project.updatedAt}>{formatDate(project.updatedAt)}</time></span>
                  </div>
                  <div className="saved-project-actions">
                    <button type="button" className="button button-primary" onClick={() => handleOpen(project)}>
                      <FolderOpen size={13} />Open
                    </button>
                    <button type="button" className="saved-icon-button" aria-label={`Rename ${project.name}`} title="Rename" onClick={() => openRename(project)}>
                      <Pencil size={14} />
                    </button>
                    <button type="button" className="saved-icon-button" aria-label={`Duplicate ${project.name}`} title="Duplicate" onClick={() => handleDuplicate(project)}>
                      <Copy size={14} />
                    </button>
                    <button type="button" className="saved-icon-button" aria-label={`Export ${project.name} as JSON`} title="Export JSON" onClick={() => exportProject(project)}>
                      <Download size={14} />
                    </button>
                    <button type="button" className="saved-icon-button danger" aria-label={`Delete ${project.name}`} title="Delete" onClick={() => handleDelete(project)}>
                      <Trash2 size={14} />
                    </button>
                  </div>
                </article>
              )
            })}
          </div>
        )}
      </div>
      {saveChoiceOpen && (
        <DfaActionModal
          title="Save incomplete DFA?"
          description={`This DFA has ${missingTransitionCount} missing transition${missingTransitionCount === 1 ? '' : 's'}. Choose whether to preserve it as-is or complete it before saving.`}
          onClose={() => setSaveChoiceOpen(false)}
        >
          <div className="dfa-modal-actions dfa-save-choice-actions">
            <button type="button" className="button button-primary" onClick={saveIncompleteAsIs}>
              Save DFA as it is
            </button>
            <button
              type="button"
              className="button button-complete"
              onClick={completeAndSave}
              disabled={!canCompleteAndSave}
            >
              Complete DFA and Save
            </button>
            {!canCompleteAndSave && (
              <small>Correct other validation errors before completing this DFA.</small>
            )}
            <button type="button" className="button button-secondary" onClick={() => setSaveChoiceOpen(false)}>
              Cancel
            </button>
          </div>
        </DfaActionModal>
      )}
    </PageLayout>
  )
}
