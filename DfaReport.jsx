import { useMemo } from 'react'
import { ArrowLeft, Printer } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useDfaWorkspace } from '../dfa/DfaWorkspaceContext.jsx'
import { createDfaSvg, createPrintableReport } from '../dfa/exports.js'

function displayDestination(cell, dfa) {
  if (cell.missing) return '— (missing)'
  if (cell.invalid) {
    const knownState = dfa.states.find((state) => state.id === cell.destinationId)
    return `Invalid: ${knownState?.name ?? 'Unknown state'}`
  }
  return cell.destinationName
}

function displayValidationMessage(message, states) {
  let displayMessage = message
  for (const state of states) {
    displayMessage = displayMessage.replaceAll(`"${state.id}"`, `"${state.name}"`)
  }
  return displayMessage.replaceAll(/"state-[^"]+"/g, '"unknown state"')
}

export default function DfaReport() {
  const { dfa, projects, activeProjectId } = useDfaWorkspace()
  const activeProject = projects.find((project) => project.id === activeProjectId) ?? null
  const report = useMemo(
    () => createPrintableReport(dfa, activeProject),
    [dfa, activeProject],
  )
  const diagram = useMemo(() => createDfaSvg(dfa), [dfa])
  const diagramUrl = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(diagram)}`
  const generatedDate = new Date(report.generatedAt)

  return (
    <article className="dfa-report-page">
      <div className="report-toolbar no-print">
        <Link className="button button-secondary" to="/designer"><ArrowLeft size={15} />Back to Designer</Link>
        <button type="button" className="button button-primary" onClick={() => window.print()}>
          <Printer size={15} />Print / Save as PDF
        </button>
      </div>

      <header className="report-title">
        <p className="eyebrow">DFA STUDIO · AUTOMATON REPORT</p>
        <h1>{report.projectName}</h1>
        {report.description && <p className="report-description">{report.description}</p>}
        <p className="report-generated">
          Generated {generatedDate.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}
        </p>
      </header>

      <section className="report-section">
        <h2>Overview</h2>
        <div className="report-metrics">
          <div><strong>{report.overview.stateCount}</strong><span>States</span></div>
          <div><strong>{report.overview.alphabetSize}</strong><span>Alphabet symbols</span></div>
          <div><strong>{report.overview.transitionCount}</strong><span>Transitions</span></div>
          <div><strong>{report.overview.finalStateCount}</strong><span>Final states</span></div>
        </div>
        <p><strong>Alphabet:</strong> {report.alphabet.length ? report.alphabet.join(', ') : 'None'}</p>
        <p><strong>Initial state:</strong> {dfa.states.find((state) => state.id === dfa.initialState)?.name ?? 'Not set'}</p>
        <p><strong>Final states:</strong> {
          report.states.filter((state) => state.final).map((state) => state.name).join(', ') || 'None'
        }</p>
      </section>

      <section className="report-section report-diagram-section">
        <h2>Diagram</h2>
        <div className="report-diagram">
          <img src={diagramUrl} alt={`DFA diagram for ${report.projectName}`} />
        </div>
      </section>

      <section className="report-section">
        <h2>States</h2>
        <table className="report-table">
          <thead><tr><th>State</th><th>Initial</th><th>Final</th><th>Canvas position</th></tr></thead>
          <tbody>
            {report.states.map((state) => (
              <tr key={state.id}>
                <td>{state.name}</td>
                <td>{state.initial ? 'Yes' : 'No'}</td>
                <td>{state.final ? 'Yes' : 'No'}</td>
                <td>{state.position ? `${state.position.x}, ${state.position.y}` : 'Default layout'}</td>
              </tr>
            ))}
            {report.states.length === 0 && <tr><td colSpan="4">No states have been created.</td></tr>}
          </tbody>
        </table>
      </section>

      <section className="report-section">
        <h2>Transition table</h2>
        {dfa.alphabet.length === 0
          ? <p>No alphabet symbols are defined.</p>
          : (
            <div className="report-table-wrap">
              <table className="report-table">
                <thead><tr><th>State</th>{dfa.alphabet.map((symbol) => <th key={symbol}>{symbol}</th>)}</tr></thead>
                <tbody>
                  {report.transitionTable.map((row, index) => (
                    <tr key={`${row.stateId}-${index}`}>
                      <th>{row.isInitial ? '→ ' : ''}{row.stateName}{row.isFinal ? ' *' : ''}</th>
                      {dfa.alphabet.map((symbol) => <td key={symbol}>{displayDestination(row.cells[symbol], dfa)}</td>)}
                    </tr>
                  ))}
                  {report.transitionTable.length === 0 && (
                    <tr><td colSpan={dfa.alphabet.length + 1}>No states have been created.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
      </section>

      <section className="report-section report-validation">
        <h2>Validation summary</h2>
        <p className={`report-validity ${report.validation.valid ? 'valid' : 'invalid'}`}>
          {report.validation.valid ? 'Valid DFA' : 'DFA needs attention'}
          {' · '}{report.validation.errorCount} errors · {report.validation.warningCount} warnings
        </p>
        {report.validation.errors.length + report.validation.warnings.length > 0 && (
          <ul>
            {[...report.validation.errors, ...report.validation.warnings].map((item, index) => (
              <li key={`${item.code}-${index}`}>
                <strong>{displayValidationMessage(item.message, dfa.states)}</strong>
                {item.suggestion && <span> — {item.suggestion}</span>}
              </li>
            ))}
          </ul>
        )}
      </section>
    </article>
  )
}
