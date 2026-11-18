import { getNextState, validateDFA } from './engine.js'

const terminalStatuses = new Set(['accepted', 'rejected', 'error'])

function getResultStatus(dfa, stateId) {
  return dfa.finalStates.includes(stateId) ? 'accepted' : 'rejected'
}

function getInputError(dfa, input) {
  if (typeof input !== 'string') {
    return { code: 'invalid-input', message: 'Input must be a string.' }
  }
  // Use code points so input validation matches the one-code-point alphabet rule.
  const symbols = Array.from(input)
  const invalidIndex = symbols.findIndex((symbol) => !dfa.alphabet.includes(symbol))
  if (invalidIndex < 0) return null
  const symbol = symbols[invalidIndex]
  return {
    code: 'invalid-symbol',
    symbol,
    index: invalidIndex,
    message: `Input symbol "${symbol}" at position ${invalidIndex + 1} is not in the DFA alphabet.`,
  }
}

export function createReadyExecution(dfa, input = '') {
  const initialState = dfa?.states?.some((state) => state.id === dfa.initialState)
    ? dfa.initialState
    : null
  return {
    input,
    symbols: typeof input === 'string' ? Array.from(input) : [],
    status: 'ready',
    currentState: initialState,
    currentSymbol: null,
    cursor: 0,
    history: [],
    error: null,
  }
}

export function startSimulation(dfa, input) {
  const configErrors = validateDFA(dfa).errors.filter((error) => error.code !== 'missing-transition')
  if (configErrors.length > 0) {
    const firstError = configErrors[0]
    return {
      ...createReadyExecution(dfa, typeof input === 'string' ? input : ''),
      status: 'error',
      error: {
        code: firstError.code,
        message: `Cannot start simulation: ${firstError.message}`,
      },
    }
  }

  const inputError = getInputError(dfa, input)
  if (inputError) {
    return {
      ...createReadyExecution(dfa, typeof input === 'string' ? input : ''),
      status: 'error',
      currentState: dfa.initialState,
      currentSymbol: inputError.symbol ?? null,
      error: inputError,
    }
  }

  const symbols = Array.from(input)
  const execution = {
    ...createReadyExecution(dfa, input),
    symbols,
    currentState: dfa.initialState,
    currentSymbol: symbols[0] ?? null,
    status: symbols.length === 0 ? getResultStatus(dfa, dfa.initialState) : 'running',
  }
  return execution
}

export function advanceSimulation(dfa, execution) {
  if (execution.status !== 'running') return execution

  const configError = validateDFA(dfa).errors.find((error) => error.code !== 'missing-transition')
  if (configError) {
    return {
      ...execution,
      status: 'error',
      error: { code: configError.code, message: `Cannot continue simulation: ${configError.message}` },
    }
  }

  if (execution.cursor < execution.history.length) {
    const cursor = execution.cursor + 1
    const currentState = execution.history[cursor - 1].to
    const atEnd = cursor === execution.symbols.length
    return {
      ...execution,
      cursor,
      currentState,
      currentSymbol: atEnd ? null : execution.symbols[cursor],
      status: atEnd ? getResultStatus(dfa, currentState) : 'running',
    }
  }

  if (execution.error && execution.error.step === execution.cursor + 1) {
    return { ...execution, status: 'error' }
  }

  const symbol = execution.symbols[execution.cursor]
  let destination
  try {
    destination = getNextState(dfa, execution.currentState, symbol)
  } catch (error) {
    return {
      ...execution,
      status: 'error',
      currentSymbol: symbol,
      error: {
        code: 'invalid-dfa',
        step: execution.cursor + 1,
        state: execution.currentState,
        symbol,
        message: error instanceof Error ? error.message : 'The DFA is invalid.',
      },
    }
  }

  if (destination === null) {
    return {
      ...execution,
      status: 'error',
      currentSymbol: symbol,
      error: {
        code: 'missing-transition',
        step: execution.cursor + 1,
        state: execution.currentState,
        symbol,
        message: `No transition exists from "${execution.currentState}" on "${symbol}".`,
      },
    }
  }

  const transition = dfa.transitions.find(
    (candidate) =>
      candidate.from === execution.currentState &&
      candidate.symbol === symbol &&
      candidate.to === destination,
  )
  const cursor = execution.cursor + 1
  const atEnd = cursor === execution.symbols.length
  const status = atEnd ? getResultStatus(dfa, destination) : 'running'
  const row = {
    step: cursor,
    from: execution.currentState,
    symbol,
    to: destination,
    transitionId: transition?.id ?? null,
    result: atEnd ? (status === 'accepted' ? 'Accepted' : 'Rejected') : 'Transition Successful',
  }
  return {
    ...execution,
    cursor,
    currentState: destination,
    currentSymbol: atEnd ? null : execution.symbols[cursor],
    status,
    history: [...execution.history, row],
  }
}

export function previousSimulationStep(execution) {
  if (execution.cursor === 0) return execution
  const cursor = execution.cursor - 1
  return {
    ...execution,
    cursor,
    currentState: cursor === 0 ? execution.history[0].from : execution.history[cursor - 1].to,
    currentSymbol: execution.symbols[cursor] ?? null,
    status: 'running',
  }
}

export function resetSimulation(dfa, input = '') {
  return createReadyExecution(dfa, input)
}

export function getExecutionRows(execution) {
  const rows = [...execution.history]
  if (execution.error?.step === execution.cursor + 1) {
    rows.push({
      step: execution.error.step,
      from: execution.error.state ?? execution.currentState,
      symbol: execution.error.symbol ?? execution.currentSymbol,
      to: null,
      transitionId: null,
      result: 'Error',
      error: execution.error.message,
    })
  }
  return rows
}

export function getInputProgress(execution) {
  const errorIndex = Number.isInteger(execution.error?.index) ? execution.error.index : null
  const currentIndex = errorIndex ?? execution.cursor
  return {
    symbols: execution.symbols.map((symbol, index) => ({
      symbol,
      index,
      status: index < execution.cursor
        ? 'processed'
        : index === currentIndex && execution.currentSymbol !== null
          ? 'current'
          : 'remaining',
    })),
    processed: execution.cursor,
    remaining: Math.max(0, execution.symbols.length - execution.cursor - (execution.currentSymbol === null ? 0 : 1)),
    current: execution.currentSymbol,
  }
}

export function isExecutionTerminal(execution) {
  return terminalStatuses.has(execution.status)
}
