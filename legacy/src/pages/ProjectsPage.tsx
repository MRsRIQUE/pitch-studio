import { Clock3, Copy, Image, MoreHorizontal, Pencil, Plus, Search, Trash2, Video } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Dropdown, DropdownItem } from '../components/Dropdown'
import type { Project } from '../types/studio'

type Props = {
  projects: Project[]
  onCreate: () => void
  onOpen: (project: Project) => void
  onRename: (id: string, name: string) => void
  onDuplicate: (project: Project) => void
  onDelete: (id: string) => void
}
type Filter = 'all' | 'image' | 'video'

const filters: Array<{ id: Filter; label: string }> = [
  { id: 'all', label: 'Todos' },
  { id: 'image', label: 'Imagens' },
  { id: 'video', label: 'Vídeos' },
]

function Card({ project, renaming, onOpen, onRename, onDuplicate, onDelete, onStartRename, onStopRename }: {
  project: Project
  renaming: boolean
  onOpen: (project: Project) => void
  onRename: (id: string, name: string) => void
  onDuplicate: (project: Project) => void
  onDelete: (id: string) => void
  onStartRename: (id: string) => void
  onStopRename: () => void
}) {
  return <article className="project-card">
    <div className={`project-cover ${project.art}`} onClick={() => onOpen(project)}>
      <span className="generated-art" />
      <span className="media-badge">{project.mode === 'video' ? <Video size={12} /> : <Image size={12} />}{project.mode === 'video' ? 'Vídeo' : 'Imagem'}</span>
      <div className="card-menu" onClick={(event) => event.stopPropagation()}>
        <Dropdown className="card-menu-trigger" align="right" title="Opções" label={<MoreHorizontal size={17} />}>
          {(close) => <>
            <DropdownItem onClick={() => { onStartRename(project.id); close() }}><Pencil size={15} /> Renomear</DropdownItem>
            <DropdownItem onClick={() => { onDuplicate(project); close() }}><Copy size={15} /> Duplicar</DropdownItem>
            <DropdownItem danger onClick={() => { onDelete(project.id); close() }}><Trash2 size={15} /> Excluir</DropdownItem>
          </>}
        </Dropdown>
      </div>
    </div>
    <div className="project-meta">
      {renaming
        ? <input
            className="rename-field"
            autoFocus
            defaultValue={project.name}
            onBlur={(event) => { onRename(project.id, event.target.value.trim() || project.name); onStopRename() }}
            onKeyDown={(event) => {
              if (event.key === 'Enter') event.currentTarget.blur()
              if (event.key === 'Escape') onStopRename()
            }}
          />
        : <strong onClick={() => onOpen(project)}>{project.name}</strong>}
      <span><Clock3 size={11} /> {project.updatedAt}</span>
    </div>
  </article>
}

export function ProjectsPage({ projects, onCreate, onOpen, onRename, onDuplicate, onDelete }: Props) {
  const [filter, setFilter] = useState<Filter>('all')
  const [query, setQuery] = useState('')
  const [renamingId, setRenamingId] = useState<string | null>(null)

  const visible = useMemo(() => projects.filter((project) => {
    const matchesFilter = filter === 'all' || project.mode === filter
    const matchesQuery = project.name.toLowerCase().includes(query.trim().toLowerCase())
    return matchesFilter && matchesQuery
  }), [projects, filter, query])

  const cardProps = {
    onOpen, onRename, onDuplicate, onDelete,
    onStartRename: setRenamingId,
    onStopRename: () => setRenamingId(null),
  }

  return <section className="product-page">
    <header className="page-header">
      <div>
        <span className="page-eyebrow">Workspace</span>
        <h1>Seus projetos</h1>
        <p>Continue criando ou comece uma ideia do zero.</p>
      </div>
      <button className="page-primary" onClick={onCreate}><Plus size={16} /> Novo projeto</button>
    </header>

    <div className="page-tools">
      <div className="page-search">
        <Search size={16} />
        <input placeholder="Buscar projetos" value={query} onChange={(event) => setQuery(event.target.value)} />
      </div>
      {filters.map((item) => (
        <button key={item.id} className={filter === item.id ? 'active' : ''} onClick={() => setFilter(item.id)}>{item.label}</button>
      ))}
    </div>

    {visible.length === 0 ? (
      <div className="empty-state">
        <strong>Nenhum projeto encontrado</strong>
        <p>{query ? `Nada corresponde a "${query}".` : 'Crie seu primeiro projeto para começar.'}</p>
        <button className="page-primary" onClick={onCreate}><Plus size={16} /> Novo projeto</button>
      </div>
    ) : <>
      <div className="rail-heading">
        <h2>Continuar de onde parou</h2>
        <span>{visible.length} {visible.length === 1 ? 'projeto' : 'projetos'}</span>
      </div>
      <div className="project-rail">
        <button className="new-project-card" onClick={onCreate}>
          <span><Plus size={22} /></span>
          <strong>Criar novo</strong>
          <small>Imagem ou vídeo</small>
        </button>
        {visible.slice(0, 6).map((project) => (
          <Card key={project.id} project={project} renaming={renamingId === project.id} {...cardProps} />
        ))}
      </div>

      <div className="rail-heading"><h2>Todos os projetos</h2></div>
      <div className="project-grid">
        {visible.map((project) => (
          <Card key={project.id} project={project} renaming={renamingId === project.id} {...cardProps} />
        ))}
      </div>
    </>}
  </section>
}
