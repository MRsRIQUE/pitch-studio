import { Aperture, ChevronDown, ContactRound, FolderKanban, LayoutGrid, Plus, Sparkles } from 'lucide-react'
import type { Project, StudioView } from '../types/studio'

type Props = {
  activeView: StudioView
  credits: number
  projects: Project[]
  onNavigate: (view: StudioView) => void
  onNewProject: () => void
  onOpenProject: (project: Project) => void
}

const navItems = [
  { id: 'create', label: 'Criar', icon: Sparkles },
  { id: 'models', label: 'Modelos', icon: ContactRound },
  { id: 'projects', label: 'Projetos', icon: FolderKanban },
  { id: 'library', label: 'Biblioteca', icon: LayoutGrid },
  { id: 'brand', label: 'Brand kit', icon: Aperture },
] as const

export function Sidebar({ activeView, credits, projects, onNavigate, onNewProject, onOpenProject }: Props) {
  return <aside className="sidebar">
    <button className="brand" onClick={() => onNavigate('create')}><div className="brand-mark"><span /></div><span>Pitch<span className="brand-soft">Studio</span></span></button>
    <button className="new-project" onClick={onNewProject}><Plus size={17} /> Novo projeto</button>
    <nav className="main-nav" aria-label="Navegação principal">
      {navItems.map(({ id, label, icon: Icon }) => <button className={activeView === id ? 'nav-item active' : 'nav-item'} key={id} onClick={() => onNavigate(id)}>
        <Icon size={18} strokeWidth={1.8} /><span>{label}</span>
        {id === 'projects' && <span className="nav-count">{projects.length}</span>}
      </button>)}
    </nav>
    <div className="sidebar-divider" />
    <p className="section-label">Recentes</p>
    <div className="recent-list">
      {projects.slice(0, 3).map((project) => <button key={project.id} onClick={() => onOpenProject(project)}><span className={`recent-thumb ${project.art}`} />{project.name}</button>)}
    </div>
    <div className="sidebar-bottom">
      <div className="credit-card"><div className="credit-heading"><span><Sparkles size={14} /> Créditos</span><strong>{credits}</strong></div><div className="credit-track"><span style={{ width: `${Math.min(100, credits / 10)}%` }} /></div><p>Renova em 12 dias</p></div>
      <button className="profile"><span className="avatar">HF</span><span><strong>Henrique</strong><small>Workspace pessoal</small></span><ChevronDown size={15} /></button>
    </div>
  </aside>
}
