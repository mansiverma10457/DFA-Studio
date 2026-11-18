import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  applyEdgeChanges,
  applyNodeChanges,
  Background,
  BackgroundVariant,
  ReactFlow,
  ReactFlowProvider,
  useEdgesState,
  useNodesState,
  useReactFlow,
} from '@xyflow/react'
import {
  AlignHorizontalSpaceAround,
  ArrowDownToLine,
  ArrowLeftRight,
  CheckCircle2,
  CirclePlus,
  Download,
  Eraser,
  ExternalLink,
  Image as ImageIcon,
  Minus,
  Plus,
  Redo2,
  Trash2,
  Undo2,
  ZoomIn,
  ZoomOut,
} from 'lucide-react'
import PageLayout from '../components/PageLayout.jsx'
import DfaActionModal from '../components/DfaActionModal.jsx'
import DfaStateNode from '../components/designer/DfaStateNode.jsx'
import DfaTransitionEdge from '../components/designer/DfaTransitionEdge.jsx'
import { Link } from 'react-router-dom'
import { useDfaWorkspace } from '../dfa/DfaWorkspaceContext.jsx'
import {
  addState,
  addTransition,
  completeDFA,
  removeState,
  removeTransition,
  renameState,
  setInitialState,
  toggleFinalState,
  updateTransition,
} from '../dfa/engine.js'
import { toFlowEdges, toFlowNodes } from '../designer/flowModel.js'
import { getAutoLayoutPositions } from '../designer/layout.js'
import { getValidationReport } from '../dfa/validationReport.js'
import { createDfaFilename, createDfaPngBlob, createDfaSvg, downloadBlob } from '../dfa/exports.js'

const nodeTypes = { dfaState: DfaStateNode }
const edgeTypes = { dfaTransition: DfaTransitionEdge }

function DesignerWorkspace() {
  const { dfa, commit, undo, redo, canUndo, canRedo } = useDfaWorkspace()
  const [selectedStateId, setSelectedStateId] = useState(null)
  const [selectedTransitionId, setSelectedTransitionId] = useState(null)
  const [connectMode, setConnectMode] = useState(false)
  const [connectFrom, setConnectFrom] = useState(null)
  const [symbolDraft, setSymbolDraft] = useState('')
  const [selectedSymbol, setSelectedSymbol] = useState('')
  const [nameDraft, setNameDraft] = useState('')
  const [transitionSymbolDraft, setTransitionSymbolDraft] = useState('')
  const [error, setError] = useState('')
  const [exportFeedback, setExportFeedback] = useState('')
  const [completionModalOpen, setCompletionModalOpen] = useState(false)
  const [nodes, setNodes] = useNodesState([])
  const [edges, setEdges] = useEdgesState([])
  const { fitView, zoomIn, zoomOut } = useReactFlow()

  const selectedState = dfa.states.find((state) => state.id === selectedStateId) ?? null
  const selectedTransition = dfa.transitions.find(
    (transition) => transition.id === selectedTransitionId,
  ) ?? null
  const outgoingTransitions = selectedState
    ? dfa.transitions.filter((transition) => transition.from === selectedState.id)
    : []
  const currentSymbol = selectedSymbol && dfa.alphabet.includes(selectedSymbol)
    ? selectedSymbol
    : dfa.alphabet[0] ?? ''
  const validationReport = getValidationReport(dfa)
  const missingTransitionCount = validationReport.errors.filter(
    (error) => error.code === 'missing-transition',
  ).length

  const graphNodes = useMemo(
    () => toFlowNodes(dfa, { selectedStateId }).map((node) => ({
      ...node,
      data: { ...node.data, connectMode },
    })),
    [dfa, selectedStateId, connectMode],
  )

  const graphEdges = useMemo(
    () => toFlowEdges(dfa, { selectedTransitionId }).map((edge) => ({
      ...edge,
      data: {
        ...edge.data,
        onSelect: () => {
          setSelectedTransitionId(edge.id)
          setSelectedStateId(null)
        },
      },
    })),
    [dfa, selectedTransitionId],
  )

  useEffect(() => setNodes(graphNodes), [graphNodes, setNodes])
  useEffect(() => setEdges(graphEdges), [graphEdges, setEdges])
  useEffect(() => {
    setNameDraft(selectedState?.name ?? '')
  }, [selectedStateId, selectedState?.name])
  useEffect(() => {
    setTransitionSymbolDraft(selectedTransition?.symbol ?? '')
  }, [selectedTransitionId, selectedTransition?.symbol])
  useEffect(() => {
    if (!dfa.alphabet.includes(selectedSymbol)) setSelectedSymbol(dfa.alphabet[0] ?? '')
  }, [dfa.alphabet, selectedSymbol])

  const perform = useCallback((operation) => {
    try {
      operation()
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'The DFA operation could not be completed.')
    }
  }, [])

  const createConnection = useCallback((from, to) => {
    if (!currentSymbol) {
      setError('Add an alphabet symbol before creating transitions.')
      return
    }
    perform(() => {
      const updated = addTransition(dfa, { from, to, symbol: currentSymbol })
      const transition = updated.transitions[updated.transitions.length - 1]
      commit(updated)
      setSelectedStateId(null)
      setSelectedTransitionId(transition.id)
      setConnectFrom(null)
    })
  }, [commit, currentSymbol, dfa, perform])

  const addNewState = () => perform(() => {
    const name = `q${dfa.states.length}`
    const position = {
      x: 340 + (dfa.states.length % 4) * 145,
      y: 210 + Math.floor(dfa.states.length / 4) * 135,
    }
    const updated = addState(dfa, name, { position })
    const state = updated.states[updated.states.length - 1]
    commit(updated)
    setSelectedStateId(state.id)
    setSelectedTransitionId(null)
  })

  const deleteSelected = () => {
    if (selectedTransitionId) {
      perform(() => commit(removeTransition(dfa, selectedTransitionId)))
      setSelectedTransitionId(null)
      return
    }
    if (selectedStateId) {
      perform(() => commit(removeState(dfa, selectedStateId)))
      setSelectedStateId(null)
      setConnectFrom(null)
    }
  }

  const handleNodeClick = (_event, node) => {
    setSelectedTransitionId(null)
    setSelectedStateId(node.id)
    if (!connectMode) return
    if (!connectFrom) {
      setConnectFrom(node.id)
      return
    }
    createConnection(connectFrom, node.id)
  }

  const handleConnect = (connection) => {
    if (!connectMode) return
    createConnection(connection.source, connection.target)
  }

  const handleNodesChange = (changes) => setNodes((current) => applyNodeChanges(changes, current))
  const handleEdgesChange = (changes) => setEdges((current) => applyEdgeChanges(changes, current))

  const savePositions = (_event, _node, movedNodes) => {
    const positions = { ...dfa.positions }
    for (const node of movedNodes) positions[node.id] = { ...node.position }
    commit({ ...dfa, positions })
  }

  const addAlphabetSymbol = (event) => {
    event.preventDefault()
    const symbol = symbolDraft
    if (Array.from(symbol).length !== 1) {
      setError('Enter exactly one Unicode character for an alphabet symbol.')
      return
    }
    if (dfa.alphabet.includes(symbol)) {
      setError(`Symbol "${symbol}" is already in the alphabet.`)
      return
    }
    commit({ ...dfa, alphabet: [...dfa.alphabet, symbol] })
    setSymbolDraft('')
  }

  const removeAlphabetSymbol = (symbol) => {
    if (dfa.transitions.some((transition) => transition.symbol === symbol)) {
      setError(`Cannot remove "${symbol}" while transitions use it.`)
      return
    }
    commit({ ...dfa, alphabet: dfa.alphabet.filter((entry) => entry !== symbol) })
  }

  const saveStateName = (event) => {
    event.preventDefault()
    if (nameDraft === selectedState?.name) return
    perform(() => commit(renameState(dfa, selectedStateId, nameDraft)))
  }

  const saveTransitionSymbol = (event) => {
    event.preventDefault()
    if (transitionSymbolDraft === selectedTransition?.symbol) return
    perform(() => commit(updateTransition(dfa, selectedTransitionId, { symbol: transitionSymbolDraft })))
  }

  const clearCanvas = () => {
    if (dfa.states.length === 0) return
    let updated = dfa
    for (const state of [...dfa.states]) updated = removeState(updated, state.id)
    commit(updated)
    setSelectedStateId(null)
    setSelectedTransitionId(null)
    setConnectFrom(null)
  }

  const autoLayout = () => {
    if (dfa.states.length === 0) return
    commit({ ...dfa, positions: getAutoLayoutPositions(dfa.states) })
    window.requestAnimationFrame(() => fitView({ padding: 0.22, duration: 250 }))
  }

  const completeAutomaton = () => {
    if (missingTransitionCount === 0) return
    const blockingErrors = validationReport.errors.filter((error) => error.code !== 'missing-transition')
    if (blockingErrors.length > 0) {
      setError('Correct duplicate transitions and invalid references before completing this DFA.')
      return
    }
    setCompletionModalOpen(true)
  }

  const confirmCompletion = () => {
    try {
      commit(completeDFA(dfa))
      setCompletionModalOpen(false)
      setError('')
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not complete the DFA.')
    }
  }

  const handleUndo = () => {
    undo()
    setSelectedStateId(null)
    setSelectedTransitionId(null)
    setError('')
  }

  const handleRedo = () => {
    redo()
    setSelectedStateId(null)
    setSelectedTransitionId(null)
    setError('')
  }

  const exportSvg = () => {
    try {
      downloadBlob(
        new Blob([createDfaSvg(dfa)], { type: 'image/svg+xml;charset=utf-8' }),
        createDfaFilename(dfa.name, 'diagram', 'svg'),
      )
      setExportFeedback('SVG diagram exported.')
      setError('')
    } catch (caught) {
      setExportFeedback('')
      setError(caught instanceof Error ? caught.message : 'SVG export failed.')
    }
  }

  const exportPng = async () => {
    try {
      const blob = await createDfaPngBlob(dfa)
      downloadBlob(blob, createDfaFilename(dfa.name, 'diagram', 'png'))
      setExportFeedback('PNG diagram exported.')
      setError('')
    } catch (caught) {
      setExportFeedback('')
      setError(caught instanceof Error ? caught.message : 'PNG export failed.')
    }
  }

  return (
    <PageLayout
      title="DFA Designer"
      description="Build a deterministic finite automaton on the canvas."
      actions={
        <>
          <Link className="button button-secondary" to="/transition-table">
            <ExternalLink size={15} />Table &amp; validation
          </Link>
          <Link className="button button-secondary" to="/report">
            <ExternalLink size={15} />Printable report
          </Link>
        </>
      }
    >
      <div className="designer-toolbar" aria-label="Designer toolbar">
        <button type="button" className="designer-tool primary-tool" onClick={addNewState}>
          <CirclePlus size={16} /> Add State
        </button>
        <button
          type="button"
          className={`designer-tool${connectMode ? ' active' : ''}`}
          aria-pressed={connectMode}
          onClick={() => {
            setConnectMode((enabled) => !enabled)
            setConnectFrom(null)
            setError('')
          }}
        >
          <ArrowLeftRight size={15} /> Connect Mode
        </button>
        <label className="connect-symbol">
          <span>Symbol</span>
          <select
            aria-label="Transition symbol"
            value={currentSymbol}
            onChange={(event) => setSelectedSymbol(event.target.value)}
            disabled={dfa.alphabet.length === 0}
          >
            {dfa.alphabet.map((symbol) => <option key={symbol} value={symbol}>{symbol}</option>)}
          </select>
        </label>
        <span className="designer-toolbar-divider" />
        <button
          type="button"
          className="designer-tool"
          onClick={deleteSelected}
          disabled={!selectedStateId && !selectedTransitionId}
        >
          <Trash2 size={15} /> Delete Selected
        </button>
        <div className="designer-tool-group">
          <button type="button" className="designer-tool icon-tool" onClick={() => zoomIn()} aria-label="Zoom in" title="Zoom in">
            <ZoomIn size={16} />
          </button>
          <button type="button" className="designer-tool icon-tool" onClick={() => zoomOut()} aria-label="Zoom out" title="Zoom out">
            <ZoomOut size={16} />
          </button>
          <button type="button" className="designer-tool icon-tool" onClick={() => fitView({ padding: 0.22, duration: 250 })} aria-label="Fit view" title="Fit view">
            <ArrowDownToLine size={15} />
          </button>
          <button type="button" className="designer-tool icon-tool" onClick={autoLayout} disabled={dfa.states.length === 0} aria-label="Auto layout" title="Auto layout">
            <AlignHorizontalSpaceAround size={16} />
          </button>
        </div>
        <span className="designer-toolbar-divider" />
        <div className="designer-tool-group">
          <button type="button" className="designer-tool icon-tool" onClick={handleUndo} disabled={!canUndo} aria-label="Undo" title="Undo">
            <Undo2 size={16} />
          </button>
          <button type="button" className="designer-tool icon-tool" onClick={handleRedo} disabled={!canRedo} aria-label="Redo" title="Redo">
            <Redo2 size={16} />
          </button>
          <button type="button" className="designer-tool icon-tool danger-tool" onClick={clearCanvas} disabled={dfa.states.length === 0} aria-label="Clear canvas" title="Clear canvas">
            <Eraser size={15} />
          </button>
          <button type="button" className="designer-tool" onClick={exportSvg} aria-label="Export SVG diagram" title="Export SVG diagram">
            <Download size={14} /> SVG
          </button>
          <button type="button" className="designer-tool" onClick={exportPng} aria-label="Export PNG diagram" title="Export PNG diagram">
            <ImageIcon size={14} /> PNG
          </button>
          <button
            type="button"
            className="designer-tool complete-tool"
            onClick={completeAutomaton}
            disabled={missingTransitionCount === 0 || !dfa.states.length || !dfa.alphabet.length}
            title={missingTransitionCount ? `Complete ${missingTransitionCount} missing transitions` : 'No missing transitions'}
          >
            <CheckCircle2 size={15} /> Complete DFA
          </button>
        </div>
        {connectMode && (
          <span className="connect-hint">
            {connectFrom ? 'Choose a destination state (same state creates a loop)' : 'Choose a source state'}
          </span>
        )}
      </div>
      {exportFeedback && <p className="designer-export-feedback" role="status">{exportFeedback}</p>}

      <div className="designer-workspace">
        <section className="designer-canvas-panel" aria-label="DFA canvas">
          <ReactFlow
            nodes={nodes}
            edges={edges}
            nodeTypes={nodeTypes}
            edgeTypes={edgeTypes}
            onNodesChange={handleNodesChange}
            onEdgesChange={handleEdgesChange}
            onNodeClick={handleNodeClick}
            onEdgeClick={(_event, edge) => {
              setSelectedTransitionId(edge.id)
              setSelectedStateId(null)
            }}
            onConnect={handleConnect}
            onNodeDragStop={savePositions}
            onPaneClick={() => {
              setSelectedStateId(null)
              setSelectedTransitionId(null)
            }}
            nodesConnectable={connectMode}
            elementsSelectable
            deleteKeyCode={null}
            fitView
            fitViewOptions={{ padding: 0.22 }}
            minZoom={0.15}
            maxZoom={2}
          >
            <Background variant={BackgroundVariant.Lines} gap={24} size={1} color="#272b38" />
          </ReactFlow>
          {dfa.states.length === 0 && (
            <div className="canvas-empty-state">
              <span className="canvas-empty-icon"><CirclePlus size={22} /></span>
              <strong>Your canvas is empty</strong>
              <span>Add a state to start designing your DFA.</span>
              <button type="button" onClick={addNewState}><Plus size={15} /> Add first state</button>
            </div>
          )}
          <span className="canvas-count">{dfa.states.length} states <span>·</span> {dfa.transitions.length} transitions</span>
        </section>

        <aside className="designer-inspector">
          <section className="inspector-section alphabet-section">
            <div className="inspector-section-heading">
              <div><h2>Alphabet</h2><p>Input symbols (Σ)</p></div>
              <span className="inspector-count">{dfa.alphabet.length}</span>
            </div>
            <form className="alphabet-form" onSubmit={addAlphabetSymbol}>
              <input
                aria-label="New alphabet symbol"
                value={symbolDraft}
                onChange={(event) => setSymbolDraft(event.target.value)}
                placeholder="Add symbol"
                maxLength={2}
              />
              <button type="submit" aria-label="Add alphabet symbol" title="Add alphabet symbol"><Plus size={16} /></button>
            </form>
            <div className="alphabet-list" aria-label="Current alphabet">
              {dfa.alphabet.length > 0
                ? dfa.alphabet.map((symbol) => {
                    const used = dfa.transitions.some((transition) => transition.symbol === symbol)
                    return (
                      <span className="alphabet-chip" key={symbol}>
                        <code>{symbol}</code>
                        <button
                          type="button"
                          aria-label={`Remove alphabet symbol ${symbol}`}
                          title={used ? 'Remove transitions using this symbol first' : `Remove ${symbol}`}
                          disabled={used}
                          onClick={() => removeAlphabetSymbol(symbol)}
                        >
                          <Minus size={12} />
                        </button>
                      </span>
                    )
                  })
                : <span className="inspector-muted">Add symbols to enable transitions.</span>}
            </div>
          </section>

          <section className="inspector-section properties-section">
            <div className="inspector-section-heading">
              <div><h2>Properties</h2><p>{selectedState ? 'Selected state' : selectedTransition ? 'Selected transition' : 'Selection details'}</p></div>
            </div>
            {selectedState && (
              <div className="property-content">
                <div className="property-readonly"><span>State ID</span><code>{selectedState.id}</code></div>
                <form className="property-form" onSubmit={saveStateName}>
                  <label htmlFor="state-name">State name</label>
                  <div className="property-input-row">
                    <input id="state-name" value={nameDraft} onChange={(event) => setNameDraft(event.target.value)} />
                    <button type="submit" disabled={!nameDraft.trim() || nameDraft === selectedState.name}>Save</button>
                  </div>
                </form>
                <button
                  type="button"
                  className={`state-toggle${dfa.initialState === selectedState.id ? ' checked' : ''}`}
                  aria-pressed={dfa.initialState === selectedState.id}
                  onClick={() => perform(() => commit(setInitialState(dfa, selectedState.id)))}
                >
                  <span className="toggle-indicator" /> Initial state
                  <small>{dfa.initialState === selectedState.id ? 'Yes' : 'Set'}</small>
                </button>
                <button
                  type="button"
                  className={`state-toggle${dfa.finalStates.includes(selectedState.id) ? ' checked' : ''}`}
                  aria-pressed={dfa.finalStates.includes(selectedState.id)}
                  onClick={() => perform(() => commit(toggleFinalState(dfa, selectedState.id)))}
                >
                  <span className="toggle-indicator" /> Final state
                  <small>{dfa.finalStates.includes(selectedState.id) ? 'Yes' : 'Set'}</small>
                </button>
                <div className="outgoing-heading">OUTGOING TRANSITIONS <span>{outgoingTransitions.length}</span></div>
                {outgoingTransitions.length > 0
                  ? outgoingTransitions.map((transition) => (
                      <button
                        type="button"
                        className="outgoing-transition"
                        key={transition.id}
                        onClick={() => {
                          setSelectedStateId(null)
                          setSelectedTransitionId(transition.id)
                        }}
                      >
                        <code>{transition.symbol}</code>
                        <ArrowLeftRight size={13} />
                        <span>{dfa.states.find((state) => state.id === transition.to)?.name ?? transition.to}</span>
                      </button>
                    ))
                  : <p className="inspector-muted">No outgoing transitions.</p>}
                <button type="button" className="inspector-delete" onClick={deleteSelected}><Trash2 size={14} /> Delete state</button>
              </div>
            )}

            {selectedTransition && (
              <div className="property-content">
                <div className="property-readonly"><span>Source state</span><code>{dfa.states.find((state) => state.id === selectedTransition.from)?.name}</code></div>
                <div className="property-readonly"><span>Destination state</span><code>{dfa.states.find((state) => state.id === selectedTransition.to)?.name}</code></div>
                <form className="property-form transition-symbol-form" onSubmit={saveTransitionSymbol}>
                  <label htmlFor="transition-symbol">Input symbol</label>
                  <select
                    id="transition-symbol"
                    value={transitionSymbolDraft}
                    onChange={(event) => setTransitionSymbolDraft(event.target.value)}
                  >
                    {dfa.alphabet.map((symbol) => <option key={symbol} value={symbol}>{symbol}</option>)}
                  </select>
                  <button type="submit" disabled={!transitionSymbolDraft || transitionSymbolDraft === selectedTransition.symbol}>Save symbol</button>
                </form>
                <button type="button" className="inspector-delete" onClick={deleteSelected}><Trash2 size={14} /> Delete transition</button>
              </div>
            )}

            {!selectedState && !selectedTransition && (
              <p className="inspector-empty">Select a state or transition on the canvas to inspect and edit its properties.</p>
            )}
          </section>
          {error && <div className="designer-error" role="alert">{error}</div>}
          <section className="designer-validation-summary">
            <div className="designer-validation-title">
              <span className={`validation-dot ${validationReport.valid ? 'valid' : 'invalid'}`} />
              <strong>{validationReport.valid ? 'DFA is valid' : 'DFA needs attention'}</strong>
            </div>
            <p>{validationReport.errorCount} errors · {validationReport.warningCount} warnings</p>
            <Link to="/transition-table">Review validation <ExternalLink size={12} /></Link>
          </section>
        </aside>
      </div>
      {completionModalOpen && (
        <DfaActionModal
          title="Complete DFA?"
          description={`Completion will add a dead state and ${missingTransitionCount} missing transition${missingTransitionCount === 1 ? '' : 's'}. This changes the active DFA and can be undone.`}
          onClose={() => setCompletionModalOpen(false)}
        >
          <div className="dfa-modal-actions">
            <button type="button" className="button button-complete" onClick={confirmCompletion}>
              Confirm Completion
            </button>
            <button type="button" className="button button-secondary" onClick={() => setCompletionModalOpen(false)}>
              Cancel
            </button>
          </div>
        </DfaActionModal>
      )}
    </PageLayout>
  )
}

export default function Designer() {
  return (
    <ReactFlowProvider>
      <DesignerWorkspace />
    </ReactFlowProvider>
  )
}
