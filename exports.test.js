import { afterEach, describe, expect, it, vi } from 'vitest'
import { createDFA } from './engine.js'
import { runBatchTests, toBatchResultsCsv } from './batchTesting.js'
import { createProjectExport } from './projectStore.js'
import { createTransitionTableView, toTransitionTableCsv } from './transitionTable.js'
import {
  createDfaFilename,
  createDfaPngBlob,
  createDfaSvg,
  downloadBlob,
  createPrintableReport,
} from './exports.js'

afterEach(() => vi.unstubAllGlobals())

function exportDfa() {
  return createDFA({
    id: 'export-test',
    name: 'DFA & <Core>',
    states: [{ id: 'q0', name: 'Start <&>' }, { id: 'q1', name: 'Accept "yes"' }],
    alphabet: ['a', ','],
    initialState: 'q0',
    finalStates: ['q1'],
    transitions: [
      { id: 'loop', from: 'q0', symbol: 'a', to: 'q0' },
      { id: 'forward', from: 'q0', symbol: ',', to: 'q1' },
      { id: 'back', from: 'q1', symbol: 'a', to: 'q0' },
    ],
    positions: { q0: { x: 30, y: 80 }, q1: { x: 260, y: 80 } },
  })
}

describe('DFA diagram and report exports', () => {
  it('creates a standalone SVG with escaped labels, state markings, loops, positions, and transitions', () => {
    const dfa = exportDfa()
    const stateIds = new Map([
      ['q0', '550e8400-e29b-41d4-a716-446655440000'],
      ['q1', '6ba7b810-9dad-11d1-80b4-00c04fd430c8'],
    ])
    dfa.states = dfa.states.map((state) => ({ ...state, id: stateIds.get(state.id) }))
    dfa.initialState = stateIds.get(dfa.initialState)
    dfa.finalStates = dfa.finalStates.map((id) => stateIds.get(id))
    dfa.transitions = dfa.transitions.map((transition) => ({
      ...transition,
      from: stateIds.get(transition.from),
      to: stateIds.get(transition.to),
    }))
    dfa.positions = Object.fromEntries(Object.entries(dfa.positions).map(([id, position]) => [stateIds.get(id), position]))
    const svg = createDfaSvg(dfa)
    expect(svg.startsWith('<svg xmlns="http://www.w3.org/2000/svg"')).toBe(true)
    expect(svg).toContain('<title id="diagram-title">DFA &amp; &lt;Core&gt; diagram</title>')
    expect(svg).toContain('Start &lt;&amp;&gt;')
    expect(svg).toContain('Accept &quot;yes&quot;')
    expect(svg).not.toContain('class="state-id"')
    expect(svg).not.toContain('550e8400-e29b-41d4-a716-446655440000')
    expect(svg).not.toContain('6ba7b810-9dad-11d1-80b4-00c04fd430c8')
    expect(svg).toContain('class="initial-arrow"')
    expect(svg).toContain('class="final-ring"')
    expect(svg).toContain('marker-end="url(#transition-arrow)"')
    expect(svg).toContain('marker-end="url(#initial-arrow)"')
    expect(svg).toContain('d="M 70 85 C 70 42, 100 42, 100 85"')
    expect(svg).toContain('class="transition"')
    expect(svg).toContain('translate(')
    expect(svg).toContain('cx="75"')
    expect(svg).toContain('cx="305"')
    expect(svg).not.toContain('Start <&>')
    expect(svg).toContain('>,</text>')
    const transitionPaths = [...svg.matchAll(/<path d="([^"]+)" transform="translate/g)]
    expect(new Set(transitionPaths.map((match) => match[1])).size).toBe(3)
  })

  it('rasterizes the DFA SVG to a high-resolution PNG blob', async () => {
    const canvas = {
      width: 0,
      height: 0,
      getContext: vi.fn(() => ({
        fillRect: vi.fn(),
        drawImage: vi.fn(),
      })),
      toBlob: vi.fn((callback, type) => callback(new Blob(['png-bytes'], { type }))),
    }
    class MockImage {
      set src(_url) {
        queueMicrotask(() => this.onload())
      }
    }
    const createObjectURL = vi.fn(() => 'blob:diagram')
    const revokeObjectURL = vi.fn()
    vi.stubGlobal('Image', MockImage)
    vi.stubGlobal('URL', { createObjectURL, revokeObjectURL })
    vi.stubGlobal('document', { createElement: vi.fn(() => canvas) })

    const png = await createDfaPngBlob(exportDfa())
    expect(png.type).toBe('image/png')
    expect(canvas.width).toBeGreaterThan(360)
    expect(canvas.height).toBeGreaterThan(220)
    expect(canvas.getContext).toHaveBeenCalledWith('2d')
    expect(canvas.toBlob).toHaveBeenCalled()
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:diagram')
  })

  it('scales wide diagrams to the browser canvas size limit', async () => {
    const canvas = {
      width: 0,
      height: 0,
      getContext: () => ({ fillRect: vi.fn(), drawImage: vi.fn() }),
      toBlob: (callback, type) => callback(new Blob(['png'], { type })),
    }
    class MockImage {
      set src(_url) {
        queueMicrotask(() => this.onload())
      }
    }
    vi.stubGlobal('Image', MockImage)
    vi.stubGlobal('URL', { createObjectURL: () => 'blob:large', revokeObjectURL: vi.fn() })
    vi.stubGlobal('document', { createElement: () => canvas })
    const dfa = {
      ...exportDfa(),
      positions: { q0: { x: 0, y: 0 }, q1: { x: 20000, y: 0 } },
    }

    await createDfaPngBlob(dfa)
    expect(canvas.width).toBeLessThanOrEqual(8192)
    expect(canvas.height).toBeLessThanOrEqual(8192)
    expect(canvas.width * canvas.height).toBeLessThanOrEqual(40000000)
  })

  it('creates a print report with project details, table, validation, and generation time', () => {
    const dfa = exportDfa()
    const report = createPrintableReport(
      dfa,
      { name: 'Project Report', description: 'Documented DFA' },
      new Date('2026-11-03T00:00:00.000Z'),
    )
    expect(report).toMatchObject({
      projectName: 'Project Report',
      description: 'Documented DFA',
      generatedAt: '2026-11-03T00:00:00.000Z',
      overview: { stateCount: 2, alphabetSize: 2, transitionCount: 3, finalStateCount: 1 },
    })
    expect(report.states[0]).toMatchObject({ initial: true, final: false, position: { x: 30, y: 80 } })
    expect(report.transitionTable).toEqual(createTransitionTableView(dfa))
    expect(report.validation.errorCount).toBeGreaterThan(0)
  })

  it('formats safe filenames and rejects unsupported PNG dimensions/scales', async () => {
    expect(createDfaFilename('DFA / example?', 'diagram', 'svg')).toBe('DFA-example-diagram.svg')
    await expect(createDfaPngBlob(exportDfa(), { scale: 0 })).rejects.toThrow(/positive finite/)
  })

  it('creates a temporary browser download link and releases its object URL', () => {
    const anchor = { style: {}, click: vi.fn(), remove: vi.fn() }
    const appendChild = vi.fn()
    const createObjectURL = vi.fn(() => 'blob:download')
    const revokeObjectURL = vi.fn()
    vi.stubGlobal('URL', { createObjectURL, revokeObjectURL })
    vi.stubGlobal('document', {
      body: { appendChild },
      createElement: vi.fn(() => anchor),
    })
    vi.stubGlobal('setTimeout', vi.fn((callback) => {
      callback()
      return 1
    }))

    downloadBlob(new Blob(['svg'], { type: 'image/svg+xml' }), 'diagram.svg')
    expect(anchor.download).toBe('diagram.svg')
    expect(anchor.click).toHaveBeenCalledOnce()
    expect(appendChild).toHaveBeenCalledWith(anchor)
    expect(anchor.remove).toHaveBeenCalledOnce()
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:download')
  })
})

describe('Phase 8 data exports', () => {
  it('exports a complete versioned JSON DFA structure', () => {
    const dfa = exportDfa()
    const exported = createProjectExport(null, dfa)
    expect(exported).toMatchObject({
      format: 'dfa-studio',
      version: 1,
      metadata: null,
      dfa: {
        alphabet: ['a', ','],
        initialState: 'q0',
        finalStates: ['q1'],
        transitions: dfa.transitions,
      },
    })
  })

  it('exports transition-table CSV with escaped special characters', () => {
    const dfa = createDFA({
      ...exportDfa(),
      states: [{ id: 'q0', name: 'Start, "quoted"' }],
      initialState: 'q0',
      finalStates: ['q0'],
      transitions: [{ id: 'loop', from: 'q0', symbol: 'a', to: 'q0' }],
    })
    const csv = toTransitionTableCsv(dfa)
    expect(csv).toContain('"→ Start, ""quoted"" *"')
    expect(csv.split('\r\n')[0]).toBe('State,a,","')
  })

  it('exports batch result CSV with escaped input and details', () => {
    const results = runBatchTests(exportDfa(), ['invalid,input'])
    const csv = toBatchResultsCsv(results, () => 'State, "name"')
    expect(csv).toContain('"invalid,input"')
    expect(csv).toContain('"State, ""name"""')
  })
})
