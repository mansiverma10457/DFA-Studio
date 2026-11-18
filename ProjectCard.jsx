import { ArrowUpRight, CircleDot } from 'lucide-react'
import { Link } from 'react-router-dom'
import StatusBadge from './StatusBadge.jsx'

export default function ProjectCard({ project }) {
  return (
    <article className="project-card">
      <div className="project-card-top">
        <div className={`project-mark mark-${project.color}`}>{project.initials}</div>
        <span className="project-updated">{project.updated}</span>
      </div>
      <Link to="/designer" className="project-title">{project.name}</Link>
      <p className="project-description">{project.description}</p>
      <div className="project-meta">
        <span className="project-states"><CircleDot size={13} />{project.states} states</span>
        <StatusBadge>{project.status}</StatusBadge>
      </div>
      <div className="project-card-footer">
        <span>Open automaton</span>
        <Link to="/designer" className="project-open" aria-label={`Open ${project.name}`}>
          <ArrowUpRight size={16} />
        </Link>
      </div>
    </article>
  )
}
