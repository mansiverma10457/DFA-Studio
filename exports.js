import { createTransitionTableView } from './transitionTable.js'
import { getValidationReport } from './validationReport.js'
import { getStatePosition } from '../designer/layout.js'

const STATE_WIDTH = 110
const STATE_CENTER_Y = 29
const STATE_RADIUS = 29

function xmlEscape(value) {
  return String(value ?? '')
    .replace(/[^\u0009\u000a\u000d\u0020-\u{d7ff}\u{e000}-\u{fffd}\u{10000}-\u{10ffff}]/gu, '\uFFFD')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;')
}

function numberText(value) {
  if (!Number.isFinite(value)) throw new Error('DFA diagram positions exceed the supported range.')
  return String(Math.round(value * 100) / 100)
}

function stateCenters(dfa) {
  return new Map(dfa.states.map((state, index) => {
    const position = dfa.positions[state.id] ?? getStatePosition(index, dfa.states.length)
    return [state.id, { x: position.x + STATE_WIDTH / 2, y: position.y + STATE_CENTER_Y }]
  }))
}

function diagramBounds(centers) {
  const points = [...centers.values()]
  if (points.length === 0) return { minX: 0, minY: 0, width: 360, height: 220 }
  const minX = Math.min(...points.map(({ x }) => x - 75))
  const minY = Math.min(...points.map(({ y }) => y - 110))
  const maxX = Math.max(...points.map(({ x }) => x + 75))
  const maxY = Math.max(...points.map(({ y }) => y + 65))
  const width = Math.max(360, maxX - minX)
  const height = Math.max(220, maxY - minY)
  if (!Number.isFinite(width) || !Number.isFinite(height)) {
    throw new Error('DFA diagram positions exceed the supported range.')
  }
  return { minX, minY, width, height }
}

function createTransitionPath(transition, index, group, centers) {
  const source = centers.get(transition.from)
  const target = centers.get(transition.to)
  if (!source || !target) return null
  if (transition.from === transition.to) {
    const loopHeight = 67 + index * 24
    const labelWidth = Math.max(26, Array.from(transition.symbol).length * 9 + 12)
    return {
      d: `M ${numberText(source.x - 15)} ${numberText(source.y - 24)} C ${numberText(source.x - 15)} ${numberText(source.y - loopHeight)}, ${numberText(source.x + 15)} ${numberText(source.y - loopHeight)}, ${numberText(source.x + 15)} ${numberText(source.y - 24)}`,
      labelX: source.x,
      labelY: source.y - loopHeight - 8,
      labelWidth,
    }
  }

  const dx = target.x - source.x
  const dy = target.y - source.y
  const distance = Math.hypot(dx, dy)
  if (distance === 0) return null
  const ux = dx / distance
  const uy = dy / distance
  const nx = -uy
  const ny = ux
  const startX = source.x + ux * STATE_RADIUS
  const startY = source.y + uy * STATE_RADIUS
  const endX = target.x - ux * STATE_RADIUS
  const endY = target.y - uy * STATE_RADIUS
  const sameDirection = group.filter(
    (candidate) => candidate.from === transition.from && candidate.to === transition.to,
  )
  const hasReverse = group.some(
    (candidate) => candidate.from === transition.to && candidate.to === transition.from,
  )
  const offset = (hasReverse ? -24 : 0) +
    (index - (sameDirection.length - 1) / 2) * 30
  const controlX = (startX + endX) / 2 + nx * offset
  const controlY = (startY + endY) / 2 + ny * offset
  return {
    d: `M ${numberText(startX)} ${numberText(startY)} Q ${numberText(controlX)} ${numberText(controlY)} ${numberText(endX)} ${numberText(endY)}`,
    labelX: 0.25 * startX + 0.5 * controlX + 0.25 * endX,
    labelY: 0.25 * startY + 0.5 * controlY + 0.25 * endY,
    labelWidth: Math.max(26, Array.from(transition.symbol).length * 9 + 12),
  }
}

export function createDfaSvg(dfa) {
  const centers = stateCenters(dfa)
  const bounds = diagramBounds(centers)
  const point = ({ x, y }) => ({ x: x - bounds.minX, y: y - bounds.minY })
  const stateOrder = new Map(dfa.states.map((state, index) => [state.id, index]))
  const groups = new Map()
  for (const transition of dfa.transitions) {
    const from = stateOrder.get(transition.from)
    const to = stateOrder.get(transition.to)
    const key = from <= to
      ? JSON.stringify([transition.from, transition.to])
      : JSON.stringify([transition.to, transition.from])
    const group = groups.get(key) ?? []
    group.push(transition)
    groups.set(key, group)
  }

  const edges = dfa.transitions.map((transition) => {
    const fromOrder = stateOrder.get(transition.from)
    const toOrder = stateOrder.get(transition.to)
    const key = fromOrder <= toOrder
      ? JSON.stringify([transition.from, transition.to])
      : JSON.stringify([transition.to, transition.from])
    const group = groups.get(key)
    const parallelIndex = group
      .filter((candidate) => candidate.from === transition.from && candidate.to === transition.to)
      .findIndex((candidate) => candidate.id === transition.id)
    const path = createTransitionPath(transition, parallelIndex, group, centers)
    if (!path) return ''
    const label = point({ x: path.labelX, y: path.labelY })
    const labelWidth = path.labelWidth
    return `<g class="transition"><path d="${path.d}" transform="translate(${numberText(-bounds.minX)} ${numberText(-bounds.minY)})" marker-end="url(#transition-arrow)"/><rect x="${numberText(label.x - labelWidth / 2)}" y="${numberText(label.y - 11)}" width="${numberText(labelWidth)}" height="22" rx="6"/><text x="${numberText(label.x)}" y="${numberText(label.y + 4)}">${xmlEscape(transition.symbol)}</text></g>`
  }).join('')

  const states = dfa.states.map((state) => {
    const center = point(centers.get(state.id))
    const initialArrow = dfa.initialState === state.id
      ? `<path class="initial-arrow" d="M ${numberText(center.x - 62)} ${numberText(center.y)} L ${numberText(center.x - 34)} ${numberText(center.y)}" marker-end="url(#initial-arrow)"/>`
      : ''
    const finalRing = dfa.finalStates.includes(state.id)
      ? `<circle class="final-ring" cx="${numberText(center.x)}" cy="${numberText(center.y)}" r="24"/>`
      : ''
    return `<g class="state">${initialArrow}<circle class="state-ring" cx="${numberText(center.x)}" cy="${numberText(center.y)}" r="${STATE_RADIUS}"/>${finalRing}<text class="state-name" x="${numberText(center.x)}" y="${numberText(center.y + 4)}">${xmlEscape(state.name)}</text></g>`
  }).join('')

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${numberText(bounds.width)}" height="${numberText(bounds.height)}" viewBox="0 0 ${numberText(bounds.width)} ${numberText(bounds.height)}" role="img" aria-labelledby="diagram-title diagram-description"><title id="diagram-title">${xmlEscape(dfa.name || 'DFA')} diagram</title><desc id="diagram-description">Deterministic finite automaton with ${dfa.states.length} states and ${dfa.transitions.length} transitions.</desc><defs><marker id="transition-arrow" markerWidth="10" markerHeight="8" refX="8" refY="4" orient="auto" markerUnits="strokeWidth"><path d="M 0 0 L 9 4 L 0 8 z" fill="#334155"/></marker><marker id="initial-arrow" markerWidth="10" markerHeight="8" refX="8" refY="4" orient="auto" markerUnits="strokeWidth"><path d="M 0 0 L 9 4 L 0 8 z" fill="#6d28d9"/></marker></defs><style>.background{fill:#fff}.transition path,.initial-arrow{fill:none;stroke:#475569;stroke-width:2}.initial-arrow{stroke:#6d28d9;stroke-width:2.4}.transition rect{fill:#fff;stroke:#cbd5e1}.transition text{fill:#1e293b;font:600 13px sans-serif;text-anchor:middle}.state-ring{fill:#fff;stroke:#475569;stroke-width:2}.final-ring{fill:none;stroke:#6d28d9;stroke-width:1.6}.state-name{fill:#0f172a;font:600 13px sans-serif;text-anchor:middle}.state-id{fill:#64748b;font:11px sans-serif;text-anchor:middle}</style><rect class="background" width="100%" height="100%"/>${edges}${states}</svg>`
}

function scaleForPng(width, height, requestedScale) {
  if (!Number.isFinite(requestedScale) || requestedScale <= 0) {
    throw new RangeError('PNG scale must be a positive finite number.')
  }
  return Math.min(
    requestedScale,
    8192 / width,
    8192 / height,
    Math.sqrt(40000000 / (width * height)),
  )
}

export async function createDfaPngBlob(dfa, { scale = 2 } = {}) {
  const svg = createDfaSvg(dfa)
  const width = Number(svg.match(/\bwidth="([\d.]+)"/)?.[1])
  const height = Number(svg.match(/\bheight="([\d.]+)"/)?.[1])
  if (!width || !height) throw new Error('Could not determine DFA diagram dimensions.')
  const pngScale = scaleForPng(width, height, scale)
  if (pngScale <= 0) throw new Error('DFA diagram is too large to export as a PNG.')
  if (typeof globalThis.Image !== 'function' ||
      typeof globalThis.document?.createElement !== 'function' ||
      typeof globalThis.URL?.createObjectURL !== 'function') {
    throw new Error('PNG export is unavailable in this browser.')
  }

  const svgUrl = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml;charset=utf-8' }))
  try {
    const image = new Image()
    const imageLoaded = new Promise((resolve, reject) => {
      image.onload = () => resolve()
      image.onerror = () => reject(new Error('The DFA diagram could not be rendered as an image.'))
    })
    image.src = svgUrl
    await imageLoaded

    const canvas = document.createElement('canvas')
    canvas.width = Math.max(1, Math.round(width * pngScale))
    canvas.height = Math.max(1, Math.round(height * pngScale))
    const context = canvas.getContext('2d')
    if (!context) throw new Error('Canvas rendering is unavailable in this browser.')
    context.fillStyle = '#ffffff'
    context.fillRect(0, 0, canvas.width, canvas.height)
    context.drawImage(image, 0, 0, canvas.width, canvas.height)
    return await new Promise((resolve, reject) => {
      canvas.toBlob((blob) => {
        if (blob) resolve(blob)
        else reject(new Error('The browser could not encode the DFA diagram as a PNG.'))
      }, 'image/png')
    })
  } finally {
    URL.revokeObjectURL(svgUrl)
  }
}

export function createPrintableReport(dfa, metadata = null, generatedAt = new Date()) {
  return {
    projectName: metadata?.name || dfa.name || 'Untitled DFA',
    description: metadata?.description || '',
    generatedAt: generatedAt.toISOString(),
    overview: {
      stateCount: dfa.states.length,
      alphabetSize: dfa.alphabet.length,
      transitionCount: dfa.transitions.length,
      finalStateCount: dfa.finalStates.length,
    },
    alphabet: [...dfa.alphabet],
    states: dfa.states.map((state) => ({
      ...state,
      initial: dfa.initialState === state.id,
      final: dfa.finalStates.includes(state.id),
      position: dfa.positions[state.id] ?? null,
    })),
    transitionTable: createTransitionTableView(dfa),
    validation: getValidationReport(dfa),
  }
}

export function createDfaFilename(name, suffix, extension) {
  const stem = String(name || 'dfa')
    .trim()
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, '-')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '') || 'dfa'
  return `${stem}-${suffix}.${extension}`
}

export function downloadBlob(blob, filename) {
  if (!globalThis.document?.createElement || !globalThis.URL?.createObjectURL) {
    throw new Error('File downloads are unavailable in this browser.')
  }
  const url = URL.createObjectURL(blob)
  try {
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = filename
    anchor.style.display = 'none'
    document.body.appendChild(anchor)
    anchor.click()
    anchor.remove()
  } finally {
    globalThis.setTimeout(() => URL.revokeObjectURL(url), 1000)
  }
}
