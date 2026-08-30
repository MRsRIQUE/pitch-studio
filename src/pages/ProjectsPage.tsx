import { Clock3, Image, MoreHorizontal, Plus, Search, Video } from 'lucide-react'
import type { Project } from '../types/studio'

type Props = { projects: Project[]; onCreate: () => void; onOpen: (project: Project) => void }

export function ProjectsPage({ projects, onCreate, onOpen }: Props) {
  return <section className="product-page">
    <header className="page-header"><div><span className="page-eyebrow">WORKSPACE</span><h1>Seus projetos</h1><p>Continue criando ou comece uma ideia do zero.</p></div><button className="page-primary" onClick={onCreate}><Plus size={16} /> Novo projeto</button></header>
    <div className="page-tools"><div className="page-search"><Search size={16} /><input placeholder="Buscar projetos" /></div><button>Todos</button><button>Imagens</button><button>Vídeos</button></div>
    <div className="project-grid">
      <button className="new-project-card" onClick={onCreate}><span><Plus size={23} /></span><strong>Criar novo projeto</strong><small>Comece com imagem ou vídeo</small></button>
      {projects.map((project) => <article className="project-card" key={project.id} onClick={() => onOpen(project)}>
        <div className={`project-cover ${project.art}`}><span className="generated-art" /><span className="media-badge">{project.mode === 'video' ? <Video size={12} /> : <Image size={12} />}{project.mode === 'video' ? 'Vídeo' : 'Imagem'}</span><button className="card-menu" onClick={(event) => event.stopPropagation()}><MoreHorizontal size={17} /></button></div>
        <div className="project-meta"><strong>{project.name}</strong><span><Clock3 size={11} /> {project.updatedAt}</span></div>
      </article>)}
    </div>
  </section>
}
