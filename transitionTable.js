import { getTransitionTable } from './engine.js'

export function createTransitionTableView(dfa) {
  const duplicatePairs = new Set()
  for (const transition of dfa.transitions) {
    const key = JSON.stringify([transition.from, transition.symbol])
    if (duplicatePairs.has(key)) continue
    if (dfa.transitions.filter(
      (candidate) => candidate.from === transition.from && candidate.symbol === transition.symbol,
    ).length > 1) {
      duplicatePairs.add(key)
    }
  }

  const rows = duplicatePairs.size === 0
    ? getTransitionTable(dfa)
    : dfa.states.map((state) => ({
        stateId: state.id,
        stateName: state.name,
        isInitial: state.id === dfa.initialState,
        isFinal: dfa.finalStates.includes(state.id),
      }))

  return rows.map((row) => ({
    ...row,
    cells: Object.fromEntries(dfa.alphabet.map((symbol) => {
      const matches = dfa.transitions.filter(
        (transition) => transition.from === row.stateId && transition.symbol === symbol,
      )
      const duplicate = duplicatePairs.has(JSON.stringify([row.stateId, symbol]))
      const transition = matches[0]
      const destinationExists = transition && dfa.states.some((state) => state.id === transition.to)
      return [
        symbol,
        {
          destinationId: transition?.to ?? null,
          destinationName: transition
            ? dfa.states.find((state) => state.id === transition.to)?.name ?? transition.to
            : null,
          missing: matches.length === 0,
          duplicate,
          invalid: duplicate || (transition !== undefined && !destinationExists),
        },
      ]
    })),
  }))
}

export function toTransitionTableCsv(dfa, table = createTransitionTableView(dfa)) {
  const escape = (value) => {
    const text = String(value ?? '')
    return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text
  }
  const header = ['State', ...dfa.alphabet]
  const rows = table.map((row) => [
    `${row.isInitial ? '→ ' : ''}${row.stateName}${row.isFinal ? ' *' : ''}`,
    ...dfa.alphabet.map((symbol) => {
      const cell = row.cells[symbol]
      if (cell.missing) return '— (missing)'
      if (cell.invalid) return `! ${cell.destinationName}`
      return cell.destinationName
    }),
  ])
  return [header, ...rows].map((row) => row.map(escape).join(',')).join('\r\n')
}

export async function copyTransitionTable(text, clipboard = globalThis.navigator?.clipboard) {
  if (!clipboard?.writeText) throw new Error('Clipboard access is unavailable in this browser.')
  await clipboard.writeText(text)
}
