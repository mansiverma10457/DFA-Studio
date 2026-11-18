import { useEffect, useMemo, useState } from 'react'
import { AlertTriangle, Clipboard, Download, Dices, Play, Plus, Trash2, X } from 'lucide-react'
import PageLayout from '../components/PageLayout.jsx'
import { useDfaWorkspace } from '../dfa/DfaWorkspaceContext.jsx'
import {
  copyBatchResults,
  generateRandomStrings,
  MAX_BATCH_STRINGS,
  MAX_RANDOM_TOTAL_SYMBOLS,
  MAX_RANDOM_STRING_LENGTH,
  parseBatchInput,
  runBatchTests,
  runSingleTest,
  summarizeBatchResults,
  toBatchResultsCsv,
} from '../dfa/batchTesting.js'
import { createDfaFilename, downloadBlob } from '../dfa/exports.js'

function displayInput(input) {
  return input === '' ? 'ε (empty string)' : input
}

function statusLabel(status) {
  return {
    accepted: 'Accepted',
    rejected: 'Rejected',
    'invalid-symbol': 'Invalid input symbol',
    'missing-transition': 'Missing transition',
    'invalid-dfa': 'Invalid DFA configuration',
    'invalid-input': 'Invalid input',
  }[status] ?? status
}

function ResultSummary({ results }) {
  const summary = summarizeBatchResults(results)
  return (
    <div className="batch-summary" aria-label="Test summary">
      <article><span>Total tested</span><strong>{summary.total}</strong></article>
      <article className="summary-accepted"><span>Accepted</span><strong>{summary.accepted}</strong></article>
      <article className="summary-rejected"><span>Rejected</span><strong>{summary.rejected}</strong></article>
      <article className="summary-errors"><span>Errors</span><strong>{summary.errors}</strong></article>
      <article className="summary-rate"><span>Acceptance</span><strong>{summary.acceptancePercentage}%</strong></article>
    </div>
  )
}

function ResultsTable({ results, stateNames, onExport, onCopy, copied, exportError, label }) {
  if (results.length === 0) {
    return (
      <div className="batch-results-empty">
        <span>{label ? `No ${label.toLowerCase()} to display yet.` : 'Run the batch to see results here.'}</span>
      </div>
    )
  }

  return (
    <>
      <div className="batch-results-actions">
        <button type="button" className="button button-secondary" onClick={onCopy}>
          <Clipboard size={14} />Copy results
        </button>
        <button type="button" className="button button-secondary" onClick={onExport}>
          <Download size={14} />Export CSV
        </button>
        {copied && <span className="batch-copy-status" role="status">Results copied.</span>}
        {exportError && <span className="batch-export-error" role="alert">{exportError}</span>}
      </div>
      <div className="batch-results-scroll">
        <table className="batch-results-table">
          <thead>
            <tr>
              <th scope="col">Input String</th>
              <th scope="col">Result</th>
              <th scope="col">Final State</th>
              <th scope="col">Steps</th>
              <th scope="col">Details</th>
            </tr>
          </thead>
          <tbody>
            {results.map((result) => (
              <tr key={result.id}>
                <td><code>{displayInput(result.input)}</code></td>
                <td><span className={`batch-result-pill ${result.status}`}>{statusLabel(result.status)}</span></td>
                <td>{result.finalState === null ? '—' : stateNames.get(result.finalState) ?? result.finalState}</td>
                <td>{result.steps}</td>
                <td className="batch-detail">{result.detail || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  )
}

export default function StringTesting() {
  const { dfa } = useDfaWorkspace()
  const [inputs, setInputs] = useState([])
  const [draftLines, setDraftLines] = useState('')
  const [individualInput, setIndividualInput] = useState('')
  const [individualResult, setIndividualResult] = useState(null)
  const [individualError, setIndividualError] = useState('')
  const [results, setResults] = useState([])
  const [generated, setGenerated] = useState([])
  const [randomResults, setRandomResults] = useState([])
  const [count, setCount] = useState('10')
  const [minLength, setMinLength] = useState('0')
  const [maxLength, setMaxLength] = useState('20')
  const [seed, setSeed] = useState('')
  const [generationError, setGenerationError] = useState('')
  const [batchError, setBatchError] = useState('')
  const [batchCopyStatus, setBatchCopyStatus] = useState(false)
  const [randomCopyStatus, setRandomCopyStatus] = useState(false)
  const [batchExportError, setBatchExportError] = useState('')
  const [randomExportError, setRandomExportError] = useState('')
  const stateNames = useMemo(
    () => new Map(dfa.states.map((state) => [state.id, state.name])),
    [dfa.states],
  )
  const alphabetLabel = dfa.alphabet.length ? dfa.alphabet.join(' ') : 'No symbols'

  useEffect(() => {
    setIndividualResult(null)
    setIndividualError('')
    setResults([])
    setRandomResults([])
    setGenerated([])
    setGenerationError('')
    setBatchCopyStatus(false)
    setRandomCopyStatus(false)
    setBatchExportError('')
    setRandomExportError('')
  }, [dfa])

  const resetResultFeedback = () => {
    setBatchCopyStatus(false)
    setRandomCopyStatus(false)
    setBatchExportError('')
    setRandomExportError('')
  }

  const addInputs = (newInputs) => {
    if (inputs.length + newInputs.length > MAX_BATCH_STRINGS) {
      setBatchError(`A batch can contain at most ${MAX_BATCH_STRINGS} strings.`)
      return false
    }
    setInputs((current) => [...current, ...newInputs])
    setResults([])
    setBatchError('')
    resetResultFeedback()
    return true
  }

  const testIndividual = () => {
    try {
      setIndividualResult(runSingleTest(dfa, individualInput))
      setIndividualError('')
    } catch (error) {
      setIndividualResult(null)
      setIndividualError(error instanceof Error ? error.message : 'Could not test this string.')
    }
  }

  const resetIndividual = () => {
    setIndividualResult(null)
    setIndividualError('')
  }

  const clearIndividual = () => {
    setIndividualInput('')
    setIndividualResult(null)
    setIndividualError('')
  }

  const addLines = (event) => {
    event.preventDefault()
    const newInputs = parseBatchInput(draftLines)
    if (newInputs.length === 0) {
      setBatchError('Enter at least one string, one per line.')
      return
    }
    if (addInputs(newInputs)) setDraftLines('')
  }

  const addIndividual = (event) => {
    event.preventDefault()
    if (addInputs([individualInput])) setIndividualInput('')
  }

  const removeInput = (indexToRemove) => {
    setInputs((current) => current.filter((_, index) => index !== indexToRemove))
    setResults([])
    setBatchError('')
    resetResultFeedback()
  }

  const clearInputs = () => {
    setInputs([])
    setResults([])
    setBatchError('')
    resetResultFeedback()
  }

  const runBatch = () => {
    try {
      setResults(runBatchTests(dfa, inputs))
      setBatchError('')
      resetResultFeedback()
    } catch (error) {
      setBatchError(error instanceof Error ? error.message : 'Could not run the batch.')
    }
  }

  const generate = (testImmediately) => {
    try {
      const generatedStrings = generateRandomStrings(dfa.alphabet, {
        count: Number(count),
        minLength: Number(minLength),
        maxLength: Number(maxLength),
        seed,
      })
      setGenerated(generatedStrings)
      setGenerationError('')
      setRandomCopyStatus(false)
      setRandomExportError('')
      if (testImmediately) {
        setRandomResults(runBatchTests(dfa, generatedStrings))
      } else {
        setRandomResults([])
      }
    } catch (error) {
      setGenerationError(error instanceof Error ? error.message : 'Could not generate strings.')
      setGenerated([])
      setRandomResults([])
    }
  }

  const addGenerated = () => {
    addInputs(generated)
  }
  const generatedExceedsBatchLimit = inputs.length + generated.length > MAX_BATCH_STRINGS

  const clearResults = () => {
    setIndividualResult(null)
    setIndividualError('')
    setResults([])
    setRandomResults([])
    resetResultFeedback()
  }

  const exportResults = (resultSet, kind) => {
    try {
      const csv = toBatchResultsCsv(resultSet, (stateId) => stateNames.get(stateId) ?? stateId)
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
      downloadBlob(blob, createDfaFilename(dfa.name, `${kind}-results`, 'csv'))
      if (kind === 'batch') setBatchExportError('')
      else setRandomExportError('')
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Could not export results.'
      if (kind === 'batch') setBatchExportError(message)
      else setRandomExportError(message)
    }
  }

  const copyResults = async (resultSet, kind) => {
    try {
      const csv = toBatchResultsCsv(resultSet, (stateId) => stateNames.get(stateId) ?? stateId)
      await copyBatchResults(csv)
      if (kind === 'batch') {
        setBatchCopyStatus(true)
        setBatchExportError('')
      } else {
        setRandomCopyStatus(true)
        setRandomExportError('')
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Could not copy results.'
      if (kind === 'batch') {
        setBatchCopyStatus(false)
        setBatchExportError(message)
      } else {
        setRandomCopyStatus(false)
        setRandomExportError(message)
      }
    }
  }

  const previewLimit = 20

  return (
    <PageLayout
      title="String Testing"
      description="Test a batch of strings or generate random inputs for the current DFA."
    >
      <div className="string-testing-layout">
        <div className="string-testing-main">
          <section className="string-testing-card individual-test-card">
            <div className="string-testing-heading">
              <div>
                <h2>Test one string</h2>
                <p>Each test uses the current DFA and can be repeated with a new input.</p>
              </div>
            </div>
            <form
              className="batch-individual-form"
              onSubmit={(event) => {
                event.preventDefault()
                testIndividual()
              }}
            >
              <label htmlFor="individual-string">Input string</label>
              <div className="batch-add-row">
                <input
                  id="individual-string"
                  value={individualInput}
                  onChange={(event) => {
                    setIndividualInput(event.target.value)
                    setIndividualResult(null)
                    setIndividualError('')
                  }}
                  placeholder="Empty input is allowed"
                  autoComplete="off"
                  spellCheck="false"
                />
                <button type="submit" className="button button-primary">
                  <Play size={14} />Test String
                </button>
                <button type="button" className="button button-secondary" onClick={resetIndividual}>
                  Reset Result
                </button>
                <button type="button" className="button button-secondary" onClick={clearIndividual}>
                  Clear Input
                </button>
              </div>
            </form>
            {individualError && <p className="string-testing-error" role="alert">{individualError}</p>}
            {individualResult && (
              <div className="individual-test-result" role="status" aria-label="Individual test result">
                <span className={`batch-result-pill ${individualResult.status}`}>
                  {statusLabel(individualResult.status)}
                </span>
                <span>Final state: {individualResult.finalState === null
                  ? '—'
                  : stateNames.get(individualResult.finalState) ?? individualResult.finalState}</span>
                <span>Steps: {individualResult.steps}</span>
                {individualResult.detail && <p>{individualResult.detail}</p>}
              </div>
            )}
          </section>

          <section className="string-testing-card batch-input-card">
            <div className="string-testing-heading">
              <div>
                <h2>Batch strings</h2>
                <p>Run each input against the DFA currently open in your workspace.</p>
              </div>
              <div className="batch-alphabet"><span>Alphabet</span><code>{alphabetLabel}</code></div>
            </div>

            <form className="batch-individual-form" onSubmit={addIndividual}>
              <label htmlFor="batch-single-string">Add one string</label>
              <div className="batch-add-row">
                <input
                  id="batch-single-string"
                  value={individualInput}
                  onChange={(event) => setIndividualInput(event.target.value)}
                  placeholder="Empty input is allowed"
                  autoComplete="off"
                  spellCheck="false"
                  disabled={inputs.length >= MAX_BATCH_STRINGS}
                />
                <button type="submit" className="button button-secondary" disabled={inputs.length >= MAX_BATCH_STRINGS}>
                  <Plus size={14} />Add string
                </button>
              </div>
            </form>

            <form className="batch-lines-form" onSubmit={addLines}>
              <label htmlFor="batch-lines">Add multiple strings, one per line</label>
              <textarea
                id="batch-lines"
                value={draftLines}
                onChange={(event) => setDraftLines(event.target.value)}
                placeholder={'aab\nbba\n(empty lines represent empty strings)'}
                rows={4}
                spellCheck="false"
                disabled={inputs.length >= MAX_BATCH_STRINGS}
              />
              <div className="batch-list-toolbar">
                <button type="submit" className="button button-secondary" disabled={inputs.length >= MAX_BATCH_STRINGS}>
                  <Plus size={14} />Add lines
                </button>
                <span>{inputs.length} / {MAX_BATCH_STRINGS} strings</span>
                <button type="button" className="text-button danger-text-button" onClick={clearInputs} disabled={inputs.length === 0}>
                  <Trash2 size={13} />Clear list
                </button>
              </div>
            </form>

            {batchError && <p className="string-testing-error" role="alert">{batchError}</p>}

            {inputs.length === 0 ? (
              <div className="batch-input-empty">Add strings above to build a batch. Empty strings can be added individually.</div>
            ) : (
              <ol className="batch-input-list" aria-label="Strings in batch">
                {inputs.map((value, index) => (
                  <li key={`${index}-${value}`}>
                    <span className="batch-input-index">{index + 1}</span>
                    <code>{displayInput(value)}</code>
                    <button type="button" aria-label={`Remove string ${index + 1}`} onClick={() => removeInput(index)}>
                      <X size={14} />
                    </button>
                  </li>
                ))}
              </ol>
            )}

            <div className="batch-run-actions">
              <button type="button" className="button button-primary" onClick={runBatch} disabled={inputs.length === 0}>
                <Play size={14} />Run Batch
              </button>
              <button type="button" className="button button-secondary" onClick={clearResults} disabled={individualResult === null && results.length === 0 && randomResults.length === 0}>
                Clear Results
              </button>
              {results.length > 0 && <button type="button" className="button button-secondary" onClick={runBatch}>Re-run Batch</button>}
            </div>
          </section>

          <section className="string-testing-card batch-result-card">
            <div className="string-testing-heading">
              <div><h2>Batch results</h2><p>Errors are counted separately from rejected strings.</p></div>
            </div>
            <ResultSummary results={results} />
            <ResultsTable
              results={results}
              stateNames={stateNames}
              onExport={() => exportResults(results, 'batch')}
              onCopy={() => copyResults(results, 'batch')}
              copied={batchCopyStatus}
              exportError={batchExportError}
              label="Results"
            />
          </section>
        </div>

        <aside className="string-testing-sidebar">
          <section className="string-testing-card random-generator-card">
            <div className="string-testing-heading">
              <div>
                <h2>Random string generator</h2>
                <p>Generate inputs using only the current DFA alphabet.</p>
              </div>
              <Dices size={17} className="random-icon" />
            </div>

            <div className="random-parameters">
              <label>
                <span>Number of strings</span>
                <input type="number" min="1" max={MAX_BATCH_STRINGS} step="1" value={count} onChange={(event) => setCount(event.target.value)} />
              </label>
              <label>
                <span>Minimum length</span>
                <input type="number" min="0" max={MAX_RANDOM_STRING_LENGTH} step="1" value={minLength} onChange={(event) => setMinLength(event.target.value)} />
              </label>
              <label>
                <span>Maximum length</span>
                <input type="number" min="0" max={MAX_RANDOM_STRING_LENGTH} step="1" value={maxLength} onChange={(event) => setMaxLength(event.target.value)} />
              </label>
              <label className="seed-field">
                <span>Random seed <small>Optional</small></span>
                <input type="text" value={seed} onChange={(event) => setSeed(event.target.value)} placeholder="Reproduce a run" />
              </label>
            </div>
            <p className="random-generation-limit">
              Up to {MAX_BATCH_STRINGS} strings, {MAX_RANDOM_STRING_LENGTH} symbols each, and {MAX_RANDOM_TOTAL_SYMBOLS.toLocaleString()} total generated symbols.
            </p>
            {generationError && <p className="string-testing-error" role="alert"><AlertTriangle size={13} />{generationError}</p>}
            <div className="random-actions">
              <button type="button" className="button button-secondary" onClick={() => generate(false)}>
                <Dices size={14} />Generate
              </button>
              <button type="button" className="button button-primary" onClick={() => generate(true)}>
                <Play size={14} />Generate &amp; Test
              </button>
            </div>

            {generated.length > 0 && (
              <div className="generated-strings">
                <div className="generated-heading">
                  <strong>Generated strings <span>{generated.length}</span></strong>
                  <button type="button" className="text-button" onClick={addGenerated} disabled={generatedExceedsBatchLimit}>
                    <Plus size={12} />Add to batch
                  </button>
                </div>
                {generatedExceedsBatchLimit && (
                  <p className="string-testing-error" role="status">Remove some batch strings before adding this generated set.</p>
                )}
                <div className="generated-preview">
                  {generated.slice(0, previewLimit).map((value, index) => (
                    <code key={`${index}-${value}`}>{displayInput(value)}</code>
                  ))}
                  {generated.length > previewLimit && <small>and {generated.length - previewLimit} more…</small>}
                </div>
              </div>
            )}
          </section>

          <section className="string-testing-card random-results-card">
            <div className="string-testing-heading">
              <div><h2>Random test results</h2><p>Generated tests use the same DFA engine.</p></div>
            </div>
            <ResultSummary results={randomResults} />
            <ResultsTable
              results={randomResults}
              stateNames={stateNames}
              onExport={() => exportResults(randomResults, 'random')}
              onCopy={() => copyResults(randomResults, 'random')}
              copied={randomCopyStatus}
              exportError={randomExportError}
              label="Random results"
            />
          </section>
        </aside>
      </div>
    </PageLayout>
  )
}
