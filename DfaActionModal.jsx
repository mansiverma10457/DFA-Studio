import { useEffect, useRef } from 'react'

export default function DfaActionModal({ title, description, onClose, children }) {
  const modalRef = useRef(null)

  useEffect(() => {
    modalRef.current?.focus()
  }, [])

  const handleKeyDown = (event) => {
    if (event.key === 'Escape') onClose()
  }

  return (
    <div
      className="dfa-modal-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <section
        className="dfa-action-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="dfa-modal-title"
        aria-describedby="dfa-modal-description"
        tabIndex={-1}
        ref={modalRef}
        onKeyDown={handleKeyDown}
      >
        <h2 id="dfa-modal-title">{title}</h2>
        <p id="dfa-modal-description">{description}</p>
        {children}
      </section>
    </div>
  )
}
