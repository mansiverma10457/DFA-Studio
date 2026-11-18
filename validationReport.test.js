import { describe, expect, it } from 'vitest'
import { createDFA } from './engine.js'
import { getValidationReport } from './validationReport.js'

describe('transition table validation report', () => {
  it('requires a non-empty alphabet and supplies affected state/symbol details', () => {
    const dfa = {
      ...createDFA({ id: 'partial', name: 'Partial', alphabet: ['a'] }),
      states: [{ id: 'q0', name: 'Start' }],
      initialState: 'q0',
    }
    const report = getValidationReport(dfa)

    expect(report.valid).toBe(false)
    const missing = report.errors.find((error) => error.code === 'missing-transition')
    expect(missing).toMatchObject({ state: 'q0', symbol: 'a' })
    expect(missing.suggestion).toMatch(/transition/)

    const emptyAlphabetReport = getValidationReport({ ...dfa, alphabet: [] })
    expect(emptyAlphabetReport.errors.map((error) => error.code)).toContain('empty-alphabet')
  })

  it('reports valid status and a warning when a valid DFA has no final states', () => {
    const report = getValidationReport({
      ...createDFA({ id: 'empty-final', name: 'No finals', alphabet: ['a'] }),
      states: [{ id: 'q0', name: 'Start' }],
      initialState: 'q0',
      transitions: [{ id: 'loop', from: 'q0', symbol: 'a', to: 'q0' }],
    })

    expect(report.valid).toBe(true)
    expect(report.errorCount).toBe(0)
    expect(report.warningCount).toBe(1)
    expect(report.warnings[0].suggestion).toMatch(/final/)
  })
})
