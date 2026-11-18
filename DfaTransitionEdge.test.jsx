import { describe, expect, it } from 'vitest'
import { getCircleEdgeGeometry } from './DfaTransitionEdge.jsx'

describe('DFA transition edge anchors', () => {
  it('connects horizontal states at the right and left circle midpoints', () => {
    const edge = getCircleEdgeGeometry(0, 0, 160, 0)

    expect(edge.path).toBe('M 28.5 0 L 131.5 0')
    expect(edge.labelX).toBe(80)
    expect(edge.labelY).toBe(0)
  })

  it('selects facing boundary points for vertical and diagonal layouts', () => {
    const vertical = getCircleEdgeGeometry(20, 10, 20, 150)
    expect(vertical.path).toBe('M 20 38.5 L 20 121.5')

    const diagonal = getCircleEdgeGeometry(0, 0, 120, 120)
    const [, startX, startY, endX, endY] = diagonal.path.match(/M ([\d.]+) ([\d.]+) L ([\d.]+) ([\d.]+)/).map(Number)
    expect(startX).toBeCloseTo(20.1525, 3)
    expect(startY).toBeCloseTo(20.1525, 3)
    expect(endX).toBeCloseTo(99.8475, 3)
    expect(endY).toBeCloseTo(99.8475, 3)
  })

  it('recalculates the line geometry after either state moves', () => {
    const original = getCircleEdgeGeometry(0, 0, 160, 0)
    const movedSource = getCircleEdgeGeometry(0, 30, 160, 0)

    expect(movedSource.path).not.toBe(original.path)
    const [, startX, startY, endX, endY] = movedSource.path.match(/M ([\d.]+) ([\d.]+) L ([\d.]+) ([\d.]+)/).map(Number)
    expect(Math.hypot(startX, startY - 30)).toBeCloseTo(28.5, 5)
    expect(Math.hypot(160 - endX, endY)).toBeCloseTo(28.5, 5)
  })
})
