import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, BookOpen, CheckCircle2, Lightbulb } from 'lucide-react'
import PageLayout from '../components/PageLayout.jsx'

const guides = [
  {
    id: 'dfa-basics',
    title: 'What is a DFA?',
    content: (
      <>
        <p>
          A deterministic finite automaton (DFA) is a finite-state machine that reads an input
          string one symbol at a time. For each state and alphabet symbol, at most one transition
          determines the next state. A string is accepted when the machine finishes in a final
          state.
        </p>
        <p>
          A DFA is defined by a set of states, an input alphabet, a transition function, one
          initial state, and a set of final states. DFA Studio uses a single shared workspace so
          the designer, simulator, table, and testing tools all use the same automaton.
        </p>
      </>
    ),
  },
  {
    id: 'create-dfa',
    title: 'Create a DFA',
    content: (
      <>
        <ol>
          <li>Open <Link to="/designer">DFA Designer</Link> and choose <strong>Add State</strong>. Repeat for each state.</li>
          <li>In the Alphabet panel, add one symbol at a time. Each symbol is one Unicode code point; duplicate symbols are not allowed.</li>
          <li>Select a state in the canvas and use the state properties to set its name, initial status, and final status. You can have multiple final states, but exactly one initial state is required for a valid DFA.</li>
          <li>Choose an alphabet symbol in the toolbar, turn on <strong>Connect Mode</strong>, and select the source and destination states. Selecting the same state creates a self-loop. You can also drag from a state handle to another state.</li>
          <li>Select a transition to change its symbol or delete it. A DFA can have no more than one outgoing transition for a given source state and symbol.</li>
        </ol>
        <p>Drag states to arrange the diagram. Use Auto layout, Fit view, zoom, and pan to navigate the canvas.</p>
      </>
    ),
  },
  {
    id: 'validation-table',
    title: 'Validate and inspect the transition table',
    content: (
      <>
        <p>
          The designer shows a live validation summary. Open <Link to="/transition-table">Transition Table</Link>
          {' '}for a full report and a table generated from the current DFA. Rows represent states;
          columns represent alphabet symbols. The arrow marks the initial state, an asterisk marks
          final states, and a missing marker identifies an undefined transition.
        </p>
        <p>
          Validation checks state and alphabet structure, the initial and final states, transition
          references, duplicate source-symbol entries, and missing transitions. To complete an
          otherwise valid DFA, choose <strong>Complete DFA</strong> in the designer or table and
          confirm. Missing transitions are redirected to a generated trap state. Invalid
          references and duplicates must be corrected first.
        </p>
        <p>The table can be copied or exported as CSV.</p>
      </>
    ),
  },
  {
    id: 'simulate',
    title: 'Simulate an input string',
    content: (
      <>
        <p>
          Open <Link to="/simulator">Simulator</Link>, enter a string using the current alphabet,
          then choose <strong>Start Simulation</strong>. Step forward and backward, run
          automatically, pause, or reset. Empty input is supported: it is accepted when the initial
          state is final.
        </p>
        <p>
          The execution graph highlights visited states and transitions, and the history table
          records each processed symbol. Invalid symbols, missing transitions on the selected path,
          or an invalid DFA configuration are reported as errors rather than ordinary rejection.
          Simulation never repairs or changes the DFA.
        </p>
      </>
    ),
  },
  {
    id: 'string-testing',
    title: 'Batch and random string testing',
    content: (
      <>
        <p>
          On <Link to="/string-testing">String Testing</Link>, enter strings one per line or add
          them individually. Empty lines represent the empty string. Run the batch to see each
          result, final state, step count, details, and summary totals. Errors are counted separately
          from rejected strings. Results can be copied or exported as CSV.
        </p>
        <p>
          The random generator uses only the current DFA alphabet. Set the quantity, inclusive
          minimum and maximum lengths, and an optional seed for reproducible strings. Set the
          minimum length to zero to allow empty strings. Generation is capped at 1,000 strings and
          100,000 total requested symbols to keep the page responsive. Generated strings can be
          added to the batch or tested immediately.
        </p>
      </>
    ),
  },
  {
    id: 'projects',
    title: 'Save, load, and exchange automata',
    content: (
      <>
        <p>
          The active workspace autosaves in this browser. To create a named project, open
          <Link to="/saved-automata"> Saved Automata</Link>, choose <strong>Save Current DFA</strong>,
          and provide a project name. Projects can be opened, renamed, duplicated, exported, or
          deleted after confirmation. The current workspace and named project list are stored
          separately in browser LocalStorage.
        </p>
        <p>
          Choose <strong>Export Current</strong> or export an individual project to download a
          versioned DFA Studio JSON file. Import JSON on the same page; the file is checked before
          the active workspace is replaced. Imported data must be saved as a project separately if
          you want a named saved copy. Storage is local to this browser and is not synchronized to
          other browsers or devices.
        </p>
      </>
    ),
  },
  {
    id: 'diagram-exports',
    title: 'Export diagrams and print reports',
    content: (
      <>
        <p>
          In <Link to="/designer">DFA Designer</Link>, choose <strong>SVG</strong> for an
          independently viewable vector diagram or <strong>PNG</strong> for a raster image.
          Exports include state positions, initial arrows, final-state double circles, transitions,
          and labels, including self-loops.
        </p>
        <p>
          Choose <strong>Printable report</strong> above the designer to open the report route. It
          includes project details when the active DFA belongs to a saved project, an overview,
          alphabet, states, initial and final states, transition table, validation results, diagram,
          and generation date. <strong>Print / Save as PDF</strong> opens the browser print dialog.
          Use the browser’s destination option to save a PDF.
        </p>
      </>
    ),
  },
  {
    id: 'history',
    title: 'Undo and redo',
    content: (
      <p>
        Use the Undo and Redo controls in the designer toolbar to move backward and forward through
        DFA edits, including state and transition changes, alphabet edits, state flags, canvas
        positions, auto layout, and clear-canvas operations. Up to 50 recent changes are retained
        during the current page session. A new edit after undo clears the redo branch. The current
        DFA continues to autosave as history is navigated; history itself is not restored after a
        browser refresh.
      </p>
    ),
  },
]

export default function Documentation() {
  const [openTopics, setOpenTopics] = useState(() => new Set())

  const toggleTopic = (id) => {
    setOpenTopics((current) => {
      const next = new Set(current)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  return (
    <PageLayout
      eyebrow="HELP CENTER"
      title="Documentation"
      description="A practical guide to designing, validating, simulating, testing, saving, and exporting finite automata."
      actions={
        <Link className="button button-secondary" to="/designer">
          Open Designer <ArrowRight size={15} />
        </Link>
      }
    >
      <div className="documentation-page">
        <section className="documentation-intro">
          <span className="documentation-intro-icon"><BookOpen size={19} /></span>
          <div>
            <h2>Start with the shared DFA workspace</h2>
            <p>
              Changes made in the designer are immediately available in the transition table,
              simulator, and string-testing tools. Save a named project when you want a separate
              reusable copy.
            </p>
          </div>
        </section>

        <section className="documentation-guide" aria-label="DFA Studio guides">
          {guides.map((guide) => {
            const isOpen = openTopics.has(guide.id)
            const buttonId = `documentation-toggle-${guide.id}`
            const panelId = `documentation-panel-${guide.id}`
            return (
              <section className="documentation-topic" key={guide.id} id={guide.id}>
                <h2>
                  <button
                    type="button"
                    id={buttonId}
                    className="documentation-topic-toggle"
                    aria-expanded={isOpen}
                    aria-controls={panelId}
                    onClick={() => toggleTopic(guide.id)}
                  >
                    {guide.title}
                    <span aria-hidden="true">{isOpen ? '−' : '+'}</span>
                  </button>
                </h2>
                {isOpen && (
                  <div
                    className="documentation-topic-content"
                    id={panelId}
                    role="region"
                    aria-labelledby={buttonId}
                  >
                    {guide.content}
                  </div>
                )}
              </section>
            )
          })}
        </section>

        <aside className="documentation-note">
          <Lightbulb size={17} />
          <div>
            <strong>Useful reminders</strong>
            <p>
              A missing transition differs from a transition to a trap state. An invalid symbol or
              missing transition encountered during execution is an error, not a rejection.
              LocalStorage data belongs to this browser profile.
            </p>
          </div>
          <CheckCircle2 size={16} aria-hidden="true" />
        </aside>

      </div>
    </PageLayout>
  )
}
