# DFA Studio — Automata Theory Simulator

**Course:** CSET302 – Automata Theory and Computability  
**Institution:** Bennett University, School of Computer Science & Engineering  
**Project:** DFA Studio (Deterministic Finite Automaton Simulator)  
**Group ID / Members / Faculty:** *Add the officially assigned details before submission.*

## 1. Overview

DFA Studio is a browser-based application for constructing, validating, visualising, and testing deterministic finite automata (DFAs). Users can create states and alphabet symbols, define transitions on an interactive graph, inspect a transition table, execute input strings step by step, run batches of strings, and manage DFA projects in the browser.

The application is implemented with React and Vite. The DFA model and algorithms are kept in reusable JavaScript modules under `src/dfa/`, while React pages provide the user interface.

## 2. Supported features

- **Visual DFA designer:** Create, rename, move, and remove states; define the alphabet; set the initial state and accepting states; create, edit, and remove transitions; create self-loops; zoom, pan, and arrange the graph.
- **DFA validation:** Check state identifiers, alphabet symbols, initial/final states, transition endpoints, duplicate transitions, and missing state-symbol transitions.
- **DFA completion:** Optionally add a non-accepting dead/trap state and the missing transitions needed to complete a valid partial DFA. This is a completion operation, not DFA minimisation.
- **Transition table:** View transitions for each state and alphabet symbol, and export the table as CSV.
- **Step-by-step simulator:** Start, advance, move backward, reset, and auto-run a string; inspect the current state, traversed transitions, execution history, and final result.
- **String testing:** Test individual strings or batches; generate random strings with optional reproducible seeds; view accepted, rejected, and error results; export CSV or copy results.
- **Project management:** Autosave the active workspace in browser LocalStorage; save, open, rename, duplicate, and delete named projects; import and export versioned JSON project files.
- **History:** Undo and redo workspace edits (up to 50 history snapshots during the current session).
- **Exports and report:** Export DFA diagrams as SVG or PNG and generate a printable DFA report. The browser print dialog can be used to save the report as PDF.
- **Documentation and dashboard:** Dashboard, in-app documentation, and report pages.

**Not implemented / out of scope:** DFA minimisation, DFA equivalence checking, and a predefined DFA example library. The application models DFAs; it does not implement NFA, ε-NFA, regular-expression conversion, CFG/PDA, or Turing-machine simulation.

## 3. Technology stack and dependencies

Versions below are taken from the committed `package.json` and `package-lock.json` at the time this repository package was prepared.

| Technology / package | Version |
|---|---:|
| Node.js | 22.12 or later (required by the locked Vitest 5 release) |
| npm | A version compatible with the installed Node.js |
| React | 18.3.1 |
| React DOM | 18.3.1 |
| Vite | 6.4.5 (lockfile) |
| React Router DOM | 7.18.5 |
| `@xyflow/react` | 12.12.1 |
| `lucide-react` | 0.468.0 |
| `@vitejs/plugin-react` | 4.3.4 |
| Vitest | 5.0.5 |

The lockfile is committed so that dependency resolution can be reproduced with `npm ci`. Use a modern browser with JavaScript enabled. LocalStorage is required for browser-based workspace and project persistence.

## 4. Installation

1. Install Node.js 22.12 or later and npm.
2. Clone or download this repository.
3. Open a terminal in the repository root (the directory containing `package.json`).
4. Install the exact locked dependencies:

   ```bash
   npm ci
   ```

If `npm ci` is unavailable because the lockfile has intentionally been changed, use `npm install` and commit the updated lockfile.

## 5. Run the application

Start the Vite development server:

```bash
npm run dev
```

Open the local URL printed in the terminal (Vite commonly uses `http://localhost:5173`).

Build and preview the production version:

```bash
npm run build
npm run preview
```

The HTML entry document is `index.html`. The JavaScript application entry point is `src/main.jsx`, which mounts `src/App.jsx` inside React Strict Mode and BrowserRouter.

## 6. Example DFA

The following DFA accepts all binary strings that end in `1`.

- States: `q0`, `q1`
- Alphabet: `{0, 1}`
- Initial state: `q0`
- Accepting states: `{q1}`
- Transitions:
  - `δ(q0, 0) = q0`
  - `δ(q0, 1) = q1`
  - `δ(q1, 0) = q0`
  - `δ(q1, 1) = q1`

| Input | State trace | Expected result |
|---|---|---|
| `1` | `q0 → q1` | Accepted |
| `101` | `q0 → q1 → q0 → q1` | Accepted |
| `100` | `q0 → q1 → q0 → q0` | Rejected |
| `ε` (empty input) | `q0` | Rejected |

To try it, create the two states, set the alphabet to `0` and `1`, choose `q0` as the initial state, mark `q1` as accepting, and add all four transitions. Then test the inputs in Simulator or String Testing.

## 7. Repository map

```text
DFA-SIMULATOR/
├── index.html
├── package.json
├── package-lock.json
├── vite.config.js
├── README.md
├── .gitignore
├── docs/
│   └── API_REFERENCE.md
└── src/
    ├── main.jsx
    ├── App.jsx
    ├── styles.css
    ├── components/
    │   ├── designer/
    │   │   ├── DfaStateNode.jsx
    │   │   └── DfaTransitionEdge.jsx
    │   └── shared UI components...
    ├── data/
    │   ├── dashboard.js
    │   └── navigation.js
    ├── designer/
    │   ├── flowModel.js
    │   └── layout.js
    ├── dfa/
    │   ├── engine.js
    │   ├── simulation.js
    │   ├── batchTesting.js
    │   ├── transitionTable.js
    │   ├── validationReport.js
    │   ├── projectStore.js
    │   ├── exports.js
    │   ├── DfaWorkspaceContext.jsx
    │   └── *.test.js
    └── pages/
        ├── Dashboard.jsx
        ├── Designer.jsx
        ├── Simulator.jsx
        ├── StringTesting.jsx
        ├── TransitionTable.jsx
        ├── SavedAutomata.jsx
        ├── Documentation.jsx
        └── DfaReport.jsx
```

### Main folders and files

| Path | Responsibility |
|---|---|
| `index.html` | Vite HTML document and root DOM element. |
| `src/main.jsx` | Browser entry point; mounts React, router, styles, and application. |
| `src/App.jsx` | Application shell, route registration, navigation layout, and workspace provider. |
| `src/components/` | Reusable UI components, including graph state and transition renderers. |
| `src/data/` | Navigation definitions and dashboard data. |
| `src/designer/flowModel.js` | Converts between the DFA model and graph-canvas node/edge representation. |
| `src/designer/layout.js` | Automatic graph layout helpers. |
| `src/dfa/engine.js` | Core DFA data operations, validation, transition lookup, simulation, and completion. |
| `src/dfa/simulation.js` | Stateful, stepwise execution helpers used by the Simulator page. |
| `src/dfa/batchTesting.js` | Batch parsing/execution, random input generation, summaries, and CSV/clipboard helpers. |
| `src/dfa/transitionTable.js` | Transition-table view model and CSV/clipboard export. |
| `src/dfa/validationReport.js` | User-facing validation messages and suggestions. |
| `src/dfa/projectStore.js` | Versioned LocalStorage and project JSON import/export operations. |
| `src/dfa/DfaWorkspaceContext.jsx` | Shared active DFA state, workspace operations, undo/redo, and autosave integration. |
| `src/dfa/exports.js` | SVG/PNG diagram generation, printable report data, filenames, and downloads. |
| `src/pages/` | Route-level screens and page composition. |
| `*.test.js`, `*.test.jsx` | Unit/component tests for core logic and graph components. |
| `vite.config.js` | Vite and Vitest configuration. |

## 8. DFA model, algorithms, and error handling

### DFA representation

The core model uses these fields:

- `states`: array of state objects with unique string `id` and display `name`.
- `alphabet`: array of unique one-Unicode-code-point strings.
- `initialState`: ID of the single initial state, or `null` while the definition is incomplete.
- `finalStates`: array of accepting state IDs.
- `transitions`: array of objects `{ id, from, symbol, to }`.
- `positions`: optional state-position map used by the visual designer.

### Transition lookup

For a state `q` and symbol `a`, `getNextState(dfa, q, a)` checks that the DFA and state exist and that `a` belongs to the alphabet. It returns the destination state ID, or `null` when no matching transition exists. More than one transition for the same `(state, symbol)` pair is treated as an invalid deterministic definition.

### Acceptance algorithm

`simulateDFA(dfa, input)` validates the DFA structure (while allowing missing transitions to be handled during execution), checks the input type, and processes the input as Unicode code points from the initial state. For each symbol it:
1. checks that the symbol belongs to the alphabet;
2. finds the unique transition for the current state and symbol;
3. records the transition in the execution history;
4. moves to the destination state.

After all symbols are consumed, the string is accepted exactly when the current state is in `finalStates`. Therefore, the empty string is accepted if and only if the initial state is accepting.

### Incomplete DFA and trap-state behavior

The validator reports every missing `(state, alphabet symbol)` transition. The simulator does **not** silently invent a trap state: if execution reaches a missing transition, it returns a `missing-transition` result and records the error. The explicit **Complete DFA** operation can add a new non-accepting dead state and route missing transitions to it; the dead state loops to itself for the alphabet symbols.

### Alphabet and empty-input behavior

Each alphabet entry must be exactly one Unicode code point. An input containing a symbol outside the alphabet returns `invalid-symbol`. The empty string is represented by an empty input string; it is not an alphabet symbol and no ε-transition is created or traversed. This project is a DFA simulator, not an ε-NFA simulator.

### Stepwise simulation

`simulation.js` maintains a separate execution object containing the input symbols, cursor, current state, status, transition history, and error. Advancing and moving backward update this execution object without changing the underlying DFA definition.

## 9. Function and module documentation

The core exported functions are documented in [`docs/API_REFERENCE.md`](docs/API_REFERENCE.md). In general:

- Functions that create or update DFA data return a new DFA object rather than mutating the supplied model.
- Lookup functions return derived data or `null` where documented.
- Validation returns `{ valid, errors }`; it reports malformed definitions instead of repairing them.
- Simulation functions return structured result objects with a status, state/history information, and error details.
- Invalid types, unknown IDs, duplicate deterministic transitions, invalid symbols, and exceeded batch limits are handled with explicit errors or structured result statuses.

## 10. Testing

Run the automated test suite:

```bash
npm test
```

Run a production build:

```bash
npm run build
```

The repository includes test files for:
- DFA engine operations and validation;
- stepwise simulation;
- batch parsing, random string generation, summaries, and CSV;
- transition-table generation;
- validation report generation;
- project persistence and JSON import/export;
- workspace undo/redo history;
- graph-model conversion and transition-edge rendering;
- diagram/report exports.

A passing test is reported by Vitest as `✓` / `PASS`. A failing test is reported with the failing test name and assertion details; resolve failures before treating the build as verified. Tests should be run from a clean dependency installation (`npm ci`).

## 11. Known limitations and troubleshooting

- This project supports DFA construction and simulation only. DFA minimisation, equivalence checking, NFA/ε-NFA, CFG/PDA, and Turing-machine features are not included.
- Named projects and the active workspace are stored in the current browser profile's LocalStorage; they are not synchronised across devices or browsers.
- Undo/redo history is session memory and is not restored after a page refresh.
- The simulator reports a missing transition unless the user explicitly completes the DFA.
- Random string generation has safety limits: at most 1,000 strings, maximum individual length 1,000, and at most 100,000 generated symbols per request.
- Browser storage may be unavailable or full; in that case persistence can fail and the UI reports the storage status.
- If `npm` commands fail, check that Node.js 22.12 or later is installed, reopen the terminal, and run `npm ci`.
- If the development port is occupied, use the alternative local URL printed by Vite.

## 12. Team contributions and acknowledgements

**Group ID:** *Fill in*  
**Member names and university IDs:** *Fill in accurately*  
**Faculty mentor:** *Fill in accurately*  

Add a short, honest member-wise description of implementation, testing, documentation, and presentation contributions. Do not claim work that a member did not perform.

## 13. References, attribution, and licensing

- React: https://react.dev/
- Vite: https://vite.dev/
- React Router: https://reactrouter.com/
- XYFlow / React Flow: https://reactflow.dev/
- Lucide: https://lucide.dev/
- Vitest: https://vitest.dev/

Third-party libraries are declared in `package.json` and resolved by `package-lock.json`. No project-specific open-source license was present in the supplied source archive. Before making the repository public, the project owner/group should decide whether to add a license; do not assume that the code is released under an open-source license merely because it is on GitHub.
