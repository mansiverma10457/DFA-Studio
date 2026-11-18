import { BaseEdge, EdgeLabelRenderer } from '@xyflow/react'

const STATE_RADIUS = 28.5

export function getCircleEdgeGeometry(sourceX, sourceY, targetX, targetY, radius = STATE_RADIUS) {
  const dx = targetX - sourceX
  const dy = targetY - sourceY
  const distance = Math.max(1, Math.hypot(dx, dy))
  const unitX = dx / distance
  const unitY = dy / distance
  const startX = sourceX + unitX * radius
  const startY = sourceY + unitY * radius
  const endX = targetX - unitX * radius
  const endY = targetY - unitY * radius

  return {
    path: `M ${startX} ${startY} L ${endX} ${endY}`,
    labelX: (startX + endX) / 2,
    labelY: (startY + endY) / 2,
  }
}

function getParallelPath(sourceX, sourceY, targetX, targetY, index, count, isLoop, reverseDirection) {
  if (isLoop) {
    const rise = 64 + index * 24
    return {
      path: `M ${sourceX} ${sourceY} C ${sourceX} ${sourceY - rise}, ${targetX} ${targetY - rise}, ${targetX} ${targetY}`,
      labelX: (sourceX + targetX) / 2,
      labelY: (sourceY + targetY) / 2 - rise - 8,
    }
  }

  const geometry = getCircleEdgeGeometry(sourceX, sourceY, targetX, targetY)

  return {
    ...geometry,
    labelY: geometry.labelY - (count > 1 ? (index - (count - 1) / 2) * 20 : 0),
  }
}

export default function DfaTransitionEdge(props) {
  const { sourceX, sourceY, targetX, targetY, data = {}, selected, id, markerEnd } = props
  const result = getParallelPath(
    sourceX,
    sourceY,
    targetX,
    targetY,
    data.parallelIndex ?? 0,
    data.parallelCount ?? 1,
    props.source === props.target,
    data.reverseDirection,
  )
  const className = [
    'dfa-flow-edge',
    selected && 'selected',
    data.isVisited && 'is-visited',
    data.isCurrent && 'is-current',
  ].filter(Boolean).join(' ')

  return (
    <>
      <BaseEdge id={id} path={result.path} className={className} markerEnd={markerEnd} />
      {data.animateToken && (
        <g
          key={data.animationKey}
          className="dfa-motion-token"
          aria-hidden="true"
          pointerEvents="none"
        >
          <circle r="6">
            <animateMotion
              path={result.path}
              dur="620ms"
              rotate="auto"
              fill="freeze"
            />
          </circle>
        </g>
      )}
      <EdgeLabelRenderer>
        <div
          className="dfa-edge-label-wrap nodrag nopan"
          style={{
            transform: `translate(-50%, -50%) translate(${result.labelX}px,${result.labelY}px)`,
          }}
        >
          <button
            type="button"
            className={`dfa-edge-label${selected ? ' selected' : ''}${data.isCurrent ? ' is-current' : ''}`}
            aria-label={`Select transition symbol ${data.symbol}`}
            onClick={(event) => {
              event.stopPropagation()
              data.onSelect?.(id)
            }}
          >
            {data.symbol}
          </button>
        </div>
      </EdgeLabelRenderer>
    </>
  )
}
