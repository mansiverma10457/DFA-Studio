import { useEffect, useMemo, useState } from 'react'
import {
  AlertTriangle,
  CheckCircle2,
  CirclePause,
  FastForward,
  Play,
  RotateCcw,
  StepBack,
  StepForward,
  XCircle,
} from 'lucide-react'
import {
  Background,
  BackgroundVariant,
  Controls,
  ReactFlow,
  ReactFlowProvider,
} from '@xyflow/react'
import PageLayout from '../components/PageLayout.jsx'
import DfaStateNode from '../components/designer/DfaStateNode.jsx'
import DfaTransitionEdge from '../components/designer/DfaTransitionEdge.jsx'
import { useDfaWorkspace } from '../dfa/DfaWorkspaceContext.jsx'
import {
  advanceSimulation,
  createReadyExecution,
  getInputProgress,
  getExecutionRows,
  previousSimulationStep,
  resetSimulation,
  startSimulation,
} from '../dfa/simulation.js'
import { getValidationReport } from '../dfa/validationReport.js'
import { toFlowEdges, toFlowNodes } from '../designer/flowModel.js'

const nodeTypes = { dfaState: DfaStateNode }
const edgeTypes = { dfaTransition: DfaTransitionEdge }
const AUTO_STEP_INTERVAL = 650

function SimulatorWorkspace() {
  const { dfa } = useDfaWorkspace()
  const [input, setInput] = useState('')
  const [execution, setExecution] = useState(() => createReadyExecution(dfa))
  const [autoRunning, setAutoRunning] = useState(false)
  const [runSequence, setRunSequence] = useState(0)
  const validation = useMemo(() => getValidationReport(dfa), [dfa])
  const missingTransitionCount = validation.errors.filter(
    (error) => error.code === 'missing-transition',
  ).length
  const executionRows = useMemo(() => getExecutionRows(execution), [execution])
  const inputProgress = useMemo(() => getInputProgress(execution), [execution])
  const stateNames = useMemo(
    () => new Map(dfa.states.map((state) => [state.id, state.name])),
    [dfa.states],
  )

  const visitedStateIds = useMemo(() => {
    const visited = new Set()
    if (execution.status !== 'ready' && execution.currentState) visited.add(execution.currentState)
    for (const row of execution.history.slice(0, execution.cursor)) {
      visited.add(row.from)
      visited.add(row.to)
    }
    return visited
  }, [execution.history, execution.cursor, execution.currentState, execution.status])
  const visitedTransitionIds = useMemo(
    () => new Set(
      execution.history
        .slice(0, execution.cursor)
        .map((row) => row.transitionId)
        .filter(Boolean),
    ),
    [execution.history, execution.cursor],
  )
  const currentTransitionId = execution.cursor > 0
    ? execution.history[execution.cursor - 1]?.transitionId
    : null
  const currentStateIsFinal = dfa.finalStates.includes(execution.currentState)
  const graphNodes = useMemo(() => toFlowNodes(dfa).map((node) => ({
    ...node,
    data: {
      ...node.data,
      connectMode: false,
      isVisited: visitedStateIds.has(node.id),
      isCurrent: node.id === execution.currentState,
      executionStatus: node.id === execution.currentState &&
        ['accepted', 'rejected'].includes(execution.status)
        ? execution.status
        : null,
    },
  })), [dfa, visitedStateIds, execution.currentState, execution.status])
  const graphEdges = useMemo(() => toFlowEdges(dfa).map((edge) => ({
    ...edge,
    data: {
      ...edge.data,
      isVisited: visitedTransitionIds.has(edge.id),
      isCurrent: edge.id === currentTransitionId,
      animateToken: edge.id === currentTransitionId && execution.cursor > 0,
      animationKey: `${runSequence}:${execution.cursor}:${edge.id}`,
    },
  })), [dfa, visitedTransitionIds, currentTransitionId, runSequence, execution.cursor])

  useEffect(() => {
    if (!autoRunning || execution.status !== 'running') return undefined
    const timerId = window.setInterval(() => {
      setExecution((current) => advanceSimulation(dfa, current))
    }, AUTO_STEP_INTERVAL)
    return () => window.clearInterval(timerId)
  }, [autoRunning, execution.status, dfa])

  useEffect(() => {
    setAutoRunning(false)
    setExecution(createReadyExecution(dfa, input))
  }, [dfa])

  useEffect(() => {
    if (autoRunning && execution.status !== 'running') setAutoRunning(false)
  }, [autoRunning, execution.status])

  const start = () => {
    setAutoRunning(false)
    setRunSequence((sequence) => sequence + 1)
    setExecution(startSimulation(dfa, input))
  }

  const nextStep = () => {
    setExecution((current) => advanceSimulation(dfa, current))
  }

  const previousStep = () => {
    setExecution((current) => previousSimulationStep(current))
  }

  const reset = () => {
    setAutoRunning(false)
    setExecution(resetSimulation(dfa, input))
  }

  const changeInput = (value) => {
    setAutoRunning(false)
    setInput(value)
    setExecution(createReadyExecution(dfa, value))
  }

  const clearInput = () => {
    setAutoRunning(false)
    setInput('')
    setExecution(createReadyExecution(dfa))
  }

  const statusLabel = {
    ready: 'Ready',
    running: 'Running',
    accepted: 'Accepted',
    rejected: 'Rejected',
    error: 'Error',
  }[execution.status]
  const statusMessage = execution.error?.message ??
    (execution.status === 'accepted'
      ? 'The input ended in a final state.'
      : execution.status === 'rejected'
        ? 'The input ended in a non-final state.'
        : execution.status === 'running'
          ? 'Step through the input or run the simulation automatically.'
          : 'Enter an input string to begin.')
  const currentSymbol = execution.currentSymbol ?? '—'
  const currentStateName = stateNames.get(execution.currentState) ?? '—'
  const inputLocked = execution.status === 'running'
  const hasRewind = execution.cursor > 0
  const canStep = execution.status === 'running' && !autoRunning
  const historyRows = executionRows

  return (
    <PageLayout
      title="DFA Simulator"
      description="Run strings through the DFA currently open in your workspace."
    >
      <div className="simulator-layout">
        <section className="simulator-main">
          <section className="simulator-card simulator-input-card" aria-label="Simulation input">
            <div className="simulator-section-heading">
              <div>
                <h2>Input string</h2>
                <p>Enter symbols from the current DFA alphabet.</p>
              </div>
              <div className="simulator-alphabet" aria-label="Supported alphabet">
                <span>Alphabet</span>
                {dfa.alphabet.length
                  ? dfa.alphabet.map((symbol) => <code key={symbol}>{symbol}</code>)
                  : <small>None</small>}
              </div>
            </div>
            <label className="simulator-input-label" htmlFor="simulation-input">String to test</label>
            <input
              id="simulation-input"
              className="simulator-input"
              value={input}
              onChange={(event) => changeInput(event.target.value)}
              placeholder="Type a string, e.g. abba"
              disabled={inputLocked}
              autoComplete="off"
              spellCheck="false"
            />
            <div className="simulator-actions">
              <button
                type="button"
                className="button button-primary"
                onClick={start}
                disabled={inputLocked}
              >
                <Play size={15} />Start Simulation
              </button>
              <button
                type="button"
                className="button button-secondary"
                onClick={clearInput}
                disabled={!input}
              >
                Clear Input
              </button>
            </div>
            {missingTransitionCount > 0 && (
              <div className="simulator-notice warning" role="status">
                <AlertTriangle size={15} />
                <span>
                  This DFA has {missingTransitionCount} missing transition{missingTransitionCount === 1 ? '' : 's'}.
                  Simulation is allowed and will stop with an error only if the input path needs one.
                </span>
              </div>
            )}
            <section className="simulator-progress" aria-label="Input progress">
              <div className="simulator-progress-heading">
                <strong>Input progress</strong>
                <span>{inputProgress.processed} processed · {inputProgress.remaining} remaining</span>
              </div>
              <div className="simulator-progress-symbols" aria-label={`Input ${input || 'empty string'}`}>
                {inputProgress.symbols.length === 0
                  ? <span className="simulator-empty-input">Empty string (ε)</span>
                  : inputProgress.symbols.map(({ symbol, index, status }) => (
                    <span
                      key={`${index}-${symbol}`}
                      className={`progress-symbol ${status}`}
                      aria-label={`${symbol}: ${status}`}
                    >
                      {status === 'processed' ? <span aria-hidden="true">✓</span> : null}
                      <code>{symbol}</code>
                    </span>
                  ))}
              </div>
              <div className="simulator-progress-caption" aria-live="polite">
                <span>Current symbol: <strong>{inputProgress.current ?? '—'}</strong></span>
                <span>Step {execution.cursor} of {execution.symbols.length}</span>
              </div>
            </section>
          </section>

          <section className="simulator-card simulator-graph-card" aria-label="DFA execution graph">
            <div className="simulator-section-heading graph-heading">
              <div>
                <h2>Execution graph</h2>
                <p>Visited states and transitions are highlighted as the string runs.</p>
              </div>
              <div className="graph-legend">
                <span><i className="legend-current" />Current</span>
                <span><i className="legend-visited" />Visited</span>
                <span><i className="legend-final" />Final</span>
              </div>
            </div>
            <div className="simulator-graph">
              {dfa.states.length === 0 ? (
                <div className="simulator-graph-empty">
                  <strong>No DFA states</strong>
                  <span>Create a DFA in the designer before running a simulation.</span>
                </div>
              ) : (
                <ReactFlow
                  nodes={graphNodes}
                  edges={graphEdges}
                  nodeTypes={nodeTypes}
                  edgeTypes={edgeTypes}
                  fitView
                  fitViewOptions={{ padding: 0.22 }}
                  nodesDraggable={false}
                  nodesConnectable={false}
                  elementsSelectable={false}
                  nodesFocusable={false}
                  edgesFocusable={false}
                  panOnDrag
                  zoomOnScroll
                >
                  <Background variant={BackgroundVariant.Dots} gap={20} size={1} />
                  <Controls showInteractive={false} />
                </ReactFlow>
              )}
            </div>
          </section>

          <section className="simulator-card simulator-history-card">
            <div className="simulator-section-heading">
              <div>
                <h2>Execution history</h2>
                <p>Each row represents one traversed input symbol.</p>
              </div>
              <span className="history-step-count">{execution.cursor} / {execution.symbols.length} steps</span>
            </div>
            {historyRows.length === 0 ? (
              <div className="simulator-history-empty">
                <span>Execution steps will appear here after you start a simulation.</span>
              </div>
            ) : (
              <div className="simulator-history-scroll">
                <table className="simulator-history-table">
                  <thead>
                    <tr>
                      <th scope="col">Step</th>
                      <th scope="col">Current State</th>
                      <th scope="col">Input Symbol</th>
                      <th scope="col">Next State</th>
                      <th scope="col">Result</th>
                    </tr>
                  </thead>
                  <tbody>
                    {historyRows.map((row) => (
                      <tr
                        key={`${row.step}-${row.transitionId ?? row.result}`}
                          className={`${(row.step === Math.max(1, execution.cursor) && execution.history.length > 0) || (execution.status === 'error' && row.result === 'Error') ? 'current-history-row' : ''}${row.step > execution.cursor && row.result !== 'Error' ? ' future-history-row' : ''}${row.result === 'Error' ? ' error-history-row' : ''}`}
                          aria-current={(row.step === Math.max(1, execution.cursor) && execution.history.length > 0) || (execution.status === 'error' && row.result === 'Error') ? 'step' : undefined}
                      >
                        <td>{row.step}</td>
                        <td>{stateNames.get(row.from) ?? row.from}</td>
                        <td><code>{row.symbol}</code></td>
                        <td>{row.to ? stateNames.get(row.to) ?? row.to : '—'}</td>
                        <td>
                          <span className={`history-result ${row.result.toLowerCase().replaceAll(' ', '-')}`}>
                            {row.result}
                          </span>
                          {row.error && <small className="history-error-detail">{row.error}</small>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </section>

        <aside className="simulator-sidebar">
          <section className={`simulator-card execution-status-card status-${execution.status}`} aria-live="polite">
            <div className="simulator-status-heading">
              {execution.status === 'accepted'
                ? <CheckCircle2 size={18} />
                : execution.status === 'rejected'
                  ? <XCircle size={18} />
                  : execution.status === 'error'
                    ? <AlertTriangle size={18} />
                    : <span className={`status-pulse${execution.status === 'running' ? ' active' : ''}`} />}
              <h2>{statusLabel}</h2>
            </div>
            <p className="status-message">{statusMessage}</p>
            <div className="execution-metrics">
              <div><span>Current state</span><strong>{currentStateName}</strong></div>
              <div><span>Input symbol</span><strong>{currentSymbol}</strong></div>
              <div><span>Step</span><strong>{execution.cursor} / {execution.symbols.length}</strong></div>
              <div><span>State type</span><strong>{execution.currentState === null ? '—' : currentStateIsFinal ? 'Final' : 'Non-final'}</strong></div>
              <div><span>Processed</span><strong>{inputProgress.processed}</strong></div>
              <div><span>Remaining</span><strong>{inputProgress.remaining}</strong></div>
            </div>
          </section>

          <section className="simulator-card simulator-controls-card">
            <div className="simulator-section-heading">
              <div><h2>Controls</h2><p>Advance or replay execution.</p></div>
            </div>
            <div className="simulation-controls">
              <button type="button" className="button button-primary" onClick={start} disabled={inputLocked}>
                <Play size={14} />Start
              </button>
              <button type="button" className="button button-secondary" onClick={nextStep} disabled={!canStep}>
                <StepForward size={15} />Next Step
              </button>
              <button type="button" className="button button-secondary" onClick={previousStep} disabled={!hasRewind || autoRunning}>
                <StepBack size={15} />Previous Step
              </button>
              {!autoRunning ? (
                <button
                  type="button"
                  className="button button-secondary"
                  onClick={() => setAutoRunning(true)}
                  disabled={execution.status !== 'running'}
                >
                  <FastForward size={15} />Run Automatically
                </button>
              ) : (
                <button type="button" className="button button-warning" onClick={() => setAutoRunning(false)}>
                  <CirclePause size={15} />Pause
                </button>
              )}
              <button
                type="button"
                className="button button-secondary"
                onClick={reset}
                disabled={execution.status === 'ready' && execution.cursor === 0 && !execution.error}
              >
                <RotateCcw size={14} />Reset
              </button>
            </div>
            {autoRunning && <p className="auto-run-note">Automatic execution advances every {AUTO_STEP_INTERVAL / 1000} seconds.</p>}
          </section>

          {!validation.valid && validation.errors.some((error) => error.code !== 'missing-transition') && (
            <section className="simulator-card simulator-validation-card">
              <div className="simulator-section-heading">
                <div><h2>DFA validation</h2><p>Invalid references block execution; an empty alphabet still permits empty-string tests.</p></div>
              </div>
              <ul>
                {validation.errors
                  .filter((error) => error.code !== 'missing-transition')
                  .map((error, index) => <li key={`${error.code}-${index}`}>{error.message}</li>)}
              </ul>
            </section>
          )}
        </aside>
      </div>
    </PageLayout>
  )
}

export default function Simulator() {
  return (
    <ReactFlowProvider>
      <SimulatorWorkspace />
    </ReactFlowProvider>
  )
}
