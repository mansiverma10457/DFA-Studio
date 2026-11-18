import { Handle, Position } from '@xyflow/react'

const handles = [
  { id: 'top', position: Position.Top },
  { id: 'right', position: Position.Right },
  { id: 'bottom', position: Position.Bottom },
  { id: 'left', position: Position.Left },
]

const loopHandles = [
  { id: 'loop-source', type: 'source', left: '36%' },
  { id: 'loop-target', type: 'target', left: '64%' },
]

export default function DfaStateNode({ data }) {
  const connectable = data.connectMode

  return (
    <div
      className={`dfa-state-node${data.isFinal ? ' is-final' : ''}${data.isInitial ? ' is-initial' : ''}${data.isVisited ? ' is-visited' : ''}${data.isCurrent ? ' is-current' : ''}${data.executionStatus ? ` execution-${data.executionStatus}` : ''}`}
      data-testid={`dfa-state-${data.stateId}`}
      aria-label={`${data.name}${data.isInitial ? ', initial' : ''}${data.isFinal ? ', final' : ''}`}
    >
      {handles.map(({ id, position }) => (
        <span key={id}>
          <Handle id={`${id}-target`} type="target" position={position} isConnectable={connectable} />
          <Handle id={`${id}-source`} type="source" position={position} isConnectable={connectable} />
        </span>
      ))}
      {loopHandles.map(({ id, type, left }) => (
        <Handle
          key={id}
          id={id}
          type={type}
          position={Position.Top}
          style={{ left, top: 5 }}
          isConnectable={connectable}
        />
      ))}
      {data.isInitial && <span className="dfa-initial-arrow" aria-label="Initial state">→</span>}
      <span className="dfa-state-ring">
        <Handle id="edge-center-source" type="source" position={Position.Right} isConnectable={false} className="dfa-edge-center-handle" style={{ left: '50%', top: '50%', right: 'auto', bottom: 'auto', transform: 'translate(-50%, -50%)' }} />
        <Handle id="edge-center-target" type="target" position={Position.Left} isConnectable={false} className="dfa-edge-center-handle" style={{ left: '50%', top: '50%', right: 'auto', bottom: 'auto', transform: 'translate(-50%, -50%)' }} />
        <span className="dfa-state-name">{data.name}</span>
      </span>
      <span className="dfa-state-id">{data.stateId}</span>
    </div>
  )
}
