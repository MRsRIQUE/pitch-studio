import { Aperture, ChevronDown, ContactRound, FolderKanban, LayoutGrid, Plus, RotateCcw, Sparkles } from 'lucide-react'
import { useState } from 'react'
import { Dropdown, DropdownItem, DropdownLabel } from './Dropdown'
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
  const [confirmReset, setConfirmReset] = useState(false)

  function resetLocal() {
    for (const key of ['pitch-studio:projects', 'pitch-studio:assets', 'pitch-studio:brand', 'pitch-studio:credits']) {
      window.localStorage.removeItem(key)
    }
    window.location.reload()
  }

  return <aside className="sidebar">
    <button className="brand" onClick={() => onNavigate('create')}>
      <div className="brand-mark"><span /></div>
      <span>Pitch<span className="brand-soft">Studio</span></span>
    </button>

    <button className="new-project" onClick={onNewProject}><Plus size={17} /> Novo projeto</button>

    <nav className="main-nav" aria-label="Navegação principal">
      {navItems.map(({ id, label, icon: Icon }) => (
        <button className={activeView === id ? 'nav-item active' : 'nav-item'} key={id} onClick={() => onNavigate(id)}>
          <Icon size={18} strokeWidth={1.8} /><span>{label}</span>
          {id === 'projects' && <span className="nav-count">{projects.length}</span>}
        </button>
      ))}
    </nav>

    <div className="sidebar-divider" />
    <p className="section-label">Recentes</p>
    <div className="recent-list">
      {projects.slice(0, 3).map((project) => (
        <button key={project.id} onClick={() => onOpenProject(project)} title={project.name}>
          <span className={`recent-thumb ${project.art}`}><span className="generated-art" /></span>
          {project.name}
        </button>
      ))}
      {projects.length === 0 && <span className="recent-empty">Nenhum projeto ainda</span>}
    </div>

    <div className="sidebar-bottom">
      <button className="credit-card" onClick={() => onNavigate('library')}>
        <div className="credit-heading"><span><Sparkles size={14} /> Créditos</span><strong>{credits}</strong></div>
        <div className="credit-track"><span style={{ width: `${Math.min(100, credits / 10)}%` }} /></div>
        <p>Saldo do workspace de desenvolvimento</p>
      </button>

      <Dropdown
        className="profile"
        up
        label={<>
          <span className="avatar">HF</span>
          <span><strong>Henrique</strong><small>Workspace pessoal</small></span>
          <ChevronDown size={15} />
        </>}
      >
        {(close) => <>
          <DropdownLabel>Workspace pessoal</DropdownLabel>
          <DropdownItem onClick={() => { onNavigate('brand'); close() }}><Aperture size={15} /> Brand kit</DropdownItem>
          <DropdownItem onClick={() => { onNavigate('projects'); close() }}><FolderKanban size={15} /> Meus projetos</DropdownItem>
          <DropdownItem
            danger
            onClick={() => { if (confirmReset) resetLocal(); else setConfirmReset(true) }}
          ><RotateCcw size={15} /> {confirmReset ? 'Confirmar: apagar tudo?' : 'Limpar dados locais'}</DropdownItem>
        </>}
      </Dropdown>
    </div>
  </aside>
}
