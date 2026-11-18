import {
  ArrowRight,
  FolderOpen,
  Plus,
} from 'lucide-react'
import { Link } from 'react-router-dom'
import Button from '../components/Button.jsx'
import PageLayout from '../components/PageLayout.jsx'
import ProjectCard from '../components/ProjectCard.jsx'
import StatCard from '../components/StatCard.jsx'
import { recentActivity, recentProjects, statistics } from '../data/dashboard.js'

export default function Dashboard() {
  return (
    <PageLayout
      title="Your DFA workspace"
      actions={
        <>
          <Button to="/designer"><Plus size={17} />Create new DFA</Button>
          <Button to="/saved-automata" variant="secondary"><FolderOpen size={16} />Open Saved DFA</Button>
        </>
      }
    >
      <div className="welcome-banner">
        <div className="welcome-copy">
          <span className="welcome-overline">YOUR AUTOMATA WORKSPACE</span>
          <h2>Bring your ideas to <span>life.</span></h2>
          <p>Design, test, and understand deterministic finite automata — all in one place.</p>
        </div>
        <div className="banner-decoration decoration-one" />
        <div className="banner-decoration decoration-two" />
      </div>

      <div className="section-title-row stats-heading">
        <div>
          <h2>Workspace overview</h2>
          <p>Statistics will reflect your workspace data</p>
        </div>
      </div>
      <div className="stats-grid">
        {statistics.map((stat) => <StatCard key={stat.label} {...stat} />)}
      </div>

      <div className="dashboard-columns">
        <section className="projects-section">
          <div className="section-title-row">
            <div>
              <h2>Recent custom DFAs</h2>
              <p>Your recently created automata</p>
            </div>
            <Link to="/saved-automata" className="text-link">View all <ArrowRight size={14} /></Link>
          </div>
          <div className="projects-grid">
            {recentProjects.length > 0
              ? recentProjects.map((project) => <ProjectCard key={project.id} project={project} />)
              : <p className="dashboard-empty-state">No custom DFAs yet. Create a DFA to see your projects here.</p>}
          </div>
        </section>

        <aside className="activity-section">
          <div className="section-title-row">
            <div>
              <h2>Recent activity</h2>
              <p>Latest updates in your workspace</p>
            </div>
          </div>
          {recentActivity.length > 0
            ? <div className="activity-list">{recentActivity.map((activity) => (
                <div className="activity-item" key={activity.id}>{activity.title}</div>
              ))}</div>
            : <p className="dashboard-empty-state">Your recent activity will appear here.</p>}
        </aside>
      </div>

    </PageLayout>
  )
}
