import { useMemo, useState } from 'react'
import { AlertTriangle, CheckCircle2, Clipboard, Download, ExternalLink, ShieldAlert } from 'lucide-react'
import { Link } from 'react-router-dom'
import PageLayout from '../components/PageLayout.jsx'
import DfaActionModal from '../components/DfaActionModal.jsx'
import { completeDFA as completeDfaModel } from '../dfa/engine.js'
import { useDfaWorkspace } from '../dfa/DfaWorkspaceContext.jsx'
import { getValidationReport } from '../dfa/validationReport.js'
import { copyTransitionTable, createTransitionTableView, toTransitionTableCsv } from '../dfa/transitionTable.js'
import { createDfaFilename, downloadBlob } from '../dfa/exports.js'

function ValidationPanel({ dfa, report, onComplete, compact = false }) {
  const missingTransitions = report.errors.filter((error) => error.code === 'missing-transition').length
  const canComplete = missingTransitions > 0 &&
    report.errors.every((error) => error.code === 'missing-transition') &&
    dfa.states.length > 0 &&
    dfa.alphabet.length > 0

  return (
    <section className={`validation-panel${compact ? ' compact' : ''}`} aria-label="DFA validation">
      <div className="validation-heading">
        <div>
          <h2>Validation</h2>
          <p>Checks against the current DFA model</p>
        </div>
        <span className={`validation-status ${report.valid ? 'valid' : 'invalid'}`}>
          {report.valid ? <CheckCircle2 size={14} /> : <ShieldAlert size={14} />}
          {report.valid ? 'Valid' : 'Invalid'}
        </span>
      </div>
      <div className="validation-counts">
        <span className={report.errorCount ? 'has-errors' : ''}>{report.errorCount} errors</span>
        <span className={report.warningCount ? 'has-warnings' : ''}>{report.warningCount} warnings</span>
      </div>
      {canComplete && (
        <button type="button" className="complete-dfa-button" onClick={onComplete}>
          <CheckCircle2 size={15} /> Complete DFA
          <small>{missingTransitions} missing transition{missingTransitions === 1 ? '' : 's'}</small>
        </button>
      )}
      {!canComplete && missingTransitions > 0 && (
        <p className="completion-blocked">
          Correct duplicate transitions and invalid references before completing this DFA.
        </p>
      )}
      {report.errorCount === 0 && report.warningCount === 0
        ? <p className="validation-empty">No validation issues found.</p>
        : (
          <ul className="validation-issues">
            {report.errors.map((error, index) => (
              <li className="validation-issue error" key={`${error.code}-${error.state ?? ''}-${error.symbol ?? ''}-${index}`}>
                <AlertTriangle size={14} />
                <div>
                  <strong>{error.message}</strong>
                  {(error.state || error.symbol) && (
                    <span className="issue-context">
                      {error.state && <>State: <code>{error.state}</code></>}
                      {error.symbol && <>Symbol: <code>{error.symbol}</code></>}
                    </span>
                  )}
                  <small>Suggestion: {error.suggestion}</small>
                </div>
              </li>
            ))}
            {report.warnings.map((warning) => (
              <li className="validation-issue warning" key={warning.code}>
                <AlertTriangle size={14} />
                <div>
                  <strong>{warning.message}</strong>
                  <small>Suggestion: {warning.suggestion}</small>
                </div>
              </li>
            ))}
          </ul>
        )}
    </section>
  )
}

export default function TransitionTable() {
  const { dfa, commit } = useDfaWorkspace()
  const [copyStatus, setCopyStatus] = useState('')
  const [exportError, setExportError] = useState('')
  const [completionModalOpen, setCompletionModalOpen] = useState(false)
  const table = useMemo(() => createTransitionTableView(dfa), [dfa])
  const report = useMemo(() => getValidationReport(dfa), [dfa])
  const csv = useMemo(() => toTransitionTableCsv(dfa, table), [dfa, table])
  const missingTransitionCount = report.errors
    .filter((error) => error.code === 'missing-transition').length

  const exportCsv = () => {
    try {
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
      downloadBlob(blob, createDfaFilename(dfa.name, 'transition-table', 'csv'))
      setExportError('')
    } catch (error) {
      setExportError(error instanceof Error ? error.message : 'CSV export failed.')
    }
  }

  const copyTable = async () => {
    try {
      await copyTransitionTable(csv)
      setCopyStatus('Table copied.')
      setExportError('')
    } catch (error) {
      setCopyStatus('')
      setExportError(error instanceof Error ? error.message : 'Could not copy the table.')
    }
  }

  const completeDFA = () => {
    if (missingTransitionCount === 0) return
    setCompletionModalOpen(true)
  }

  const confirmCompletion = () => {
    try {
      commit(completeDfaModel(dfa))
      setExportError('')
      setCompletionModalOpen(false)
    } catch (error) {
      setExportError(error instanceof Error ? error.message : 'Could not complete the DFA.')
    }
  }

  return (
    <PageLayout
      title="Transition Table"
      description="Generated directly from the DFA currently open in the designer."
      actions={
        <>
          <Link className="button button-secondary" to="/designer"><ExternalLink size={15} />Open Designer</Link>
          <button type="button" className="button button-secondary" onClick={copyTable}><Clipboard size={15} />Copy table</button>
          <button type="button" className="button button-primary" onClick={exportCsv}><Download size={15} />Export CSV</button>
        </>
      }
    >
      <section className="transition-table-panel">
        <div className="table-panel-heading">
          <div>
            <h2>{dfa.name}</h2>
            <p>{dfa.states.length} states <span>·</span> {dfa.alphabet.length} symbols <span>·</span> {dfa.transitions.length} transitions</p>
          </div>
          <div className="table-legend">
            <span><b>→</b> Initial state</span>
            <span><b>*</b> Final state</span>
            <span><b>—</b> Missing transition</span>
          </div>
        </div>
        {dfa.alphabet.length === 0 && (
          <p className="table-empty-note">Add at least one alphabet symbol in the designer to create transition columns.</p>
        )}
        {table.length === 0 ? (
          <div className="table-empty-state">
            <strong>No states to display</strong>
            <span>Create states in the designer. This table updates automatically as you edit the DFA.</span>
            <Link to="/designer" className="button button-primary">Open Designer</Link>
          </div>
        ) : (
          <div className="transition-table-scroll">
            <table className="transition-table">
              <thead>
                <tr>
                  <th scope="col">State</th>
                  {dfa.alphabet.map((symbol) => <th scope="col" key={symbol}><code>{symbol}</code></th>)}
                </tr>
              </thead>
              <tbody>
                {table.map((row, rowIndex) => (
                  <tr key={`${row.stateId}-${rowIndex}`}>
                    <th scope="row">
                      <span className="table-state-marker">
                        {row.isInitial && <span className="table-initial" title="Initial state">→</span>}
                        <span>{row.stateName}</span>
                        {row.isFinal && <span className="table-final" title="Final state">*</span>}
                      </span>
                      <small>{row.stateId}</small>
                    </th>
                    {dfa.alphabet.map((symbol) => {
                      const cell = row.cells[symbol]
                      return (
                        <td
                          key={symbol}
                          className={`${cell.missing ? 'missing-cell' : ''}${cell.invalid ? ' invalid-cell' : ''}`}
                          aria-label={`${row.stateName} on ${symbol}: ${cell.missing ? 'missing transition' : cell.destinationName}`}
                        >
                          {cell.missing ? <span className="missing-marker">— Missing</span>
                            : cell.invalid ? <span className="invalid-marker">! {cell.destinationName}</span>
                              : <span>{cell.destinationName}</span>}
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <ValidationPanel dfa={dfa} report={report} onComplete={completeDFA} />
      {copyStatus && <p className="table-copy-status" role="status">{copyStatus}</p>}
      {exportError && <p className="designer-error table-error" role="alert">{exportError}</p>}
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

export { ValidationPanel }
