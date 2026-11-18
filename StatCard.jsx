import { Activity, ArrowRightLeft, Check, CircleDot, FolderKanban, X } from 'lucide-react'

const icons = {
  projects: FolderKanban,
  states: CircleDot,
  transitions: ArrowRightLeft,
  simulations: Activity,
  accepted: Check,
  rejected: X,
}

export default function StatCard({ label, value, change, icon, tone }) {
  const Icon = icons[icon] ?? CircleDot

  return (
    <article className="stat-card">
      <div className="stat-card-top">
        <span className="stat-label">{label}</span>
        <span className={`stat-icon stat-${tone}`}><Icon size={17} strokeWidth={1.9} /></span>
      </div>
      <div className="stat-value">{value}</div>
      <div className="stat-foot">
        <span>{change}</span>
      </div>
      <span className={`stat-glow glow-${tone}`} />
    </article>
  )
}
