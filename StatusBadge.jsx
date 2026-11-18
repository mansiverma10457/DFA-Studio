export default function StatusBadge({ children }) {
  const statusClass = children.toLowerCase().replace(/\s+/g, '-')
  return <span className={`status-badge status-${statusClass}`}>{children}</span>
}
