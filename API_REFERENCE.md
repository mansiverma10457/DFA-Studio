# Core API Reference

This reference describes the exported functions in `src/dfa/`. It is based on the supplied implementation. Most model operations are pure: they return a new object and leave the input DFA unchanged.

## `engine.js` — DFA model and algorithms

| Function | Parameters | Return value / behavior | Errors and assumptions |
|---|---|---|---|
| `createDFA(options = {})` | Optional `id`, `name`, `states`, `alphabet`, `initialState`, `finalStates`, `transitions`, `positions`. | Returns a DFA object with copied arrays/objects and defaults for omitted fields. | It normalises/copies supported array fields; full validity is checked separately by `validateDFA`. |
| `addState(dfa, name, options)` | DFA, non-empty state name, optional `{ id, position }`. | New DFA with the state appended and optional position recorded. | Throws for a non-object DFA, non-array `states`, blank name, or duplicate ID. |
| `removeState(dfa, stateId)` | DFA and existing state ID. | New DFA without that state, its position, any incident transitions, or its final-state membership; clears the initial state if necessary. | Throws if the DFA or state ID is invalid. |
| `renameState(dfa, stateId, name)` | DFA, existing state ID, new non-empty name. | New DFA with the selected state renamed. | Throws for an unknown state or blank/non-string name. |
| `setInitialState(dfa, stateId)` | DFA and existing state ID. | New DFA with that state as the initial state. | Throws if the state does not exist. |
| `toggleFinalState(dfa, stateId)` | DFA and existing state ID. | New DFA with the state added to or removed from `finalStates`. | Throws if the state does not exist. |
| `addTransition(dfa, transition)` | `{ id?, from, symbol, to }`; source/destination states must exist and symbol must be in alphabet. | New DFA with the transition appended. | Throws for invalid endpoints/symbol, duplicate transition ID, or an existing transition for the same `(from, symbol)` pair. |
| `updateTransition(dfa, transitionId, updates)` | Existing transition ID and partial transition fields. | New DFA with the transition updated while retaining its ID. | Throws for unknown transition, invalid endpoints/symbol, or deterministic-pair conflict. |
| `removeTransition(dfa, transitionId)` | DFA and existing transition ID. | New DFA with the selected transition removed. | Throws if the transition does not exist. |
| `getNextState(dfa, stateId, symbol)` | DFA, existing state ID, alphabet symbol. | Destination state ID, or `null` if the transition is absent. | Throws for invalid DFA/state/symbol or duplicate matching transitions. |
| `getTransitionTable(dfa)` | DFA. | Array of rows containing state ID/name, initial/final flags, and symbol-to-destination mapping; absent transitions map to `null`. | Throws if DFA, states, or alphabet have invalid types; duplicate transition pairs are rejected by lookup. |
| `validateDFA(dfa)` | DFA-like value. | `{ valid, errors }`, with structured error codes/messages for malformed fields, duplicate IDs/symbols/transitions, invalid references, and missing transitions. | Returns validation errors rather than throwing for a non-object top-level value. |
| `simulateDFA(dfa, input)` | DFA and input string. | Structured result containing `accepted`, `status`, `history`, `finalState`, and `errors`. Status may be `accepted`, `rejected`, `invalid-dfa`, `invalid-input`, `invalid-symbol`, or `missing-transition`. | Does not add a trap state implicitly. Missing transitions produce a result status. |
| `completeDFA(dfa)` | A structurally valid DFA; missing transitions are allowed. | New DFA with a non-accepting dead state and all missing transitions routed to it; dead state loops for each alphabet symbol. | Throws if there are blocking validation errors other than missing transitions. This is completion, not minimisation. |

### Core algorithm assumptions

- Alphabet symbols are single Unicode code points, not arbitrary multi-character strings.
- Determinism means at most one transition for each `(state, symbol)` pair.
- A string is accepted only when all input symbols are consumed and the final current state is in `finalStates`.
- The empty string leaves the machine in its initial state; it is accepted only if that state is final.
- The simulator reports missing transitions. The user must explicitly invoke completion to add a trap state.

## `simulation.js` — Stepwise execution

| Function | Parameters | Return value / behavior |
|---|---|---|
| `createReadyExecution(dfa, input = '')` | DFA and optional input string. | Creates a ready execution state with initial state, symbols, cursor, empty history, and no error. |
| `startSimulation(dfa, input)` | DFA and input string. | Validates the definition and input, then returns an execution in `running`, terminal, or `error` status. |
| `advanceSimulation(dfa, execution)` | DFA and current execution object. | Advances one symbol, appends a transition-history row, or returns an error for invalid/missing transitions. |
| `previousSimulationStep(execution)` | Current execution object. | Moves the cursor back one processed step without changing the DFA. |
| `resetSimulation(dfa, input = '')` | DFA and optional input. | Returns a fresh ready execution. |
| `getExecutionRows(execution)` | Execution object. | Returns transition rows and, when applicable, a row describing the current error. |
| `getInputProgress(execution)` | Execution object. | Returns per-symbol status and processed/remaining/current progress values. |
| `isExecutionTerminal(execution)` | Execution object. | Boolean indicating whether status is `accepted`, `rejected`, or `error`. |

The execution state is separate from the DFA model. Step navigation changes the simulation cursor/history, not the automaton definition.

## `batchTesting.js` — Batch and generated strings

| Function / constant | Parameters | Return value / behavior |
|---|---|---|
| `parseBatchInput(text)` | Newline-delimited text. | Array of input strings, preserving blank lines within the supplied content and removing a final line terminator. |
| `runBatchTests(dfa, inputs)` | DFA and array of strings. | Array of per-input results with status, final state, step count, detail, and errors. Maximum 1,000 inputs. |
| `runSingleTest(dfa, input)` | DFA and one input string. | First result from the batch runner. |
| `summarizeBatchResults(results)` | Array of batch results. | Counts total, accepted, rejected, errors, and acceptance percentage. |
| `generateRandomStrings(alphabet, options)` | Alphabet and `{ count, minLength, maxLength, seed? }`. | Array of generated strings. A supplied seed makes generation reproducible. |
| `toBatchResultsCsv(results, stateName?)` | Results and optional state-ID-to-name function. | CSV text with quoted/escaped fields. |
| `copyBatchResults(text, clipboard?)` | CSV/text and optional clipboard implementation. | Promise resolving after clipboard write. |
| `MAX_BATCH_STRINGS` | — | Maximum 1,000 generated/tested strings per batch. |
| `MAX_RANDOM_STRING_LENGTH` | — | Maximum generated string length: 1,000. |
| `MAX_RANDOM_TOTAL_SYMBOLS` | — | Maximum generated symbols per request: 100,000. |

Invalid arrays, excessive counts/lengths, reversed length bounds, or invalid alphabet entries produce `TypeError`, `RangeError`, or `Error` as appropriate. Clipboard export requires browser clipboard access.

## `projectStore.js` — Persistence and project files

| Function | Parameters | Return value / behavior |
|---|---|---|
| `validateDfaData(dfa, options)` | DFA data and optional `{ allowDraft, allowMissingTransitions }`. | Validation result used when loading or importing project data. |
| `readWorkspace(storage?)` / `readProjects(storage?)` | Optional Storage-compatible object; defaults to browser LocalStorage. | Reads and validates the versioned active workspace or saved-project collection. |
| `writeWorkspace(dfa, storage?, activeProjectId?)` / `writeProjects(projects, storage?)` | Data and optional Storage-compatible object. | Writes versioned data to browser storage. |
| `saveProject(projects, dfa, options)` | Existing project list, DFA, and `{ name, description?, projectId? }`. | Updated project collection containing a saved project. |
| `renameProject(projects, projectId, name)` | Project list, project ID, new name. | Updated collection with renamed project. |
| `deleteProject(projects, projectId)` | Project list and project ID. | Updated collection without the selected project. |
| `duplicateProject(projects, projectId)` | Project list and project ID. | Updated collection with a duplicate project. |
| `createProjectExport(project, dfa?)` | Project and optional DFA override. | Versioned JSON-compatible export object. |
| `parseProjectImport(text)` | JSON text. | Parses and validates a supported project import; returns validated project data. |

Storage functions rely on a Storage-compatible API. Malformed JSON, unsupported format/version, invalid DFA data, unavailable storage, or unknown project IDs are handled as errors or validation failures by the relevant operation.

## Other DFA modules

- **`transitionTable.js`:** `createTransitionTableView(dfa)` derives table rows; `toTransitionTableCsv(dfa, table?)` returns CSV text; `copyTransitionTable(text, clipboard?)` writes text to the clipboard and returns a promise.
- **`validationReport.js`:** `getValidationReport(dfa)` converts validation output into a report suitable for the UI.
- **`exports.js`:** `createDfaSvg(dfa)` returns SVG output; `createDfaPngBlob(dfa, { scale = 2 })` asynchronously creates a PNG Blob; `createPrintableReport(dfa, metadata?, generatedAt?)` creates printable report content; `createDfaFilename(name, suffix, extension)` creates a safe filename; `downloadBlob(blob, filename)` initiates a browser download.

## Error-handling convention

Core model editing functions generally throw for invalid operations (unknown IDs, invalid names/symbols, duplicate transitions). Validation and simulation functions generally return structured error information so that the UI can display actionable messages. Batch generators additionally enforce explicit workload limits. Browser-only persistence, clipboard, canvas, and download functionality depends on browser APIs being available.
