import { useEffect, useMemo, useState } from 'react'
import {
  ArrowDownToLine, ChevronDown, Clock3, Crop,
  Image, Layers3, Maximize2, Menu, Minus, MousePointer2,
  Music2, Play, Plus, Redo2, RotateCw, Settings2, Shapes,
  SlidersHorizontal, Sparkles, Square, Type, Undo2, Upload, Video,
  ScanFace, WandSparkles, X, ZoomIn, ZoomOut,
} from 'lucide-react'
import { Sidebar } from './components/Sidebar'
import { initialAssets, initialBrand, initialProjects, variations } from './data/studio'
import { modelPresets } from './data/model-presets'
import { useLocalStorage } from './hooks/useLocalStorage'
import { BrandKitPage } from './pages/BrandKitPage'
import { LibraryPage } from './pages/LibraryPage'
import { ModelsPage } from './pages/ModelsPage'
import { ProjectsPage } from './pages/ProjectsPage'
import { generateMedia, getAssets, getCreditBalance, type GenerationJob } from './services/generation/client'
import type { MediaMode, ModelPreset, Project, StudioView, Tool } from './types/studio'
import './App.css'
import './pages.css'
import './models.css'

function App() {
  const [activeView, setActiveView] = useState<StudioView>('create')
  const [projects, setProjects] = useLocalStorage('pitch-studio:projects', initialProjects)
  const [assets, setAssets] = useLocalStorage('pitch-studio:assets', initialAssets)
  const [brand, setBrand] = useLocalStorage('pitch-studio:brand', initialBrand)
  const [credits, setCredits] = useLocalStorage('pitch-studio:credits', 824)
  const [currentProjectId, setCurrentProjectId] = useState('neon')
  const [projectName, setProjectName] = useState('Campanha Neon')
  const [selectedPreset, setSelectedPreset] = useState(modelPresets[0])
  const [mode, setMode] = useState<MediaMode>('image')
  const [prompt, setPrompt] = useState('Uma escultura abstrata de vidro líquido, reflexos violeta e coral, flutuando em um estúdio escuro, luz cinematográfica')
  const [selected, setSelected] = useState(0)
  const [tool, setTool] = useState<Tool>('select')
  const [isGenerating, setIsGenerating] = useState(false)
  const [generationStatus, setGenerationStatus] = useState<GenerationJob['status'] | null>(null)
  const [generationError, setGenerationError] = useState<string | null>(null)
  const [generatedAt, setGeneratedAt] = useState('há 2 min')
  const [zoom, setZoom] = useState(74)
  const [showPanel, setShowPanel] = useState(true)
  const [temperature, setTemperature] = useState(58)
  const [contrast, setContrast] = useState(52)

  const selectedVariation = useMemo(() => variations[selected], [selected])

  useEffect(() => {
    void getCreditBalance().then(setCredits).catch(() => undefined)
    void getAssets().then((storedAssets) => { if (storedAssets.length > 0) setAssets(storedAssets) }).catch(() => undefined)
  }, [setAssets, setCredits])

  function newProject() {
    const project: Project = { id: crypto.randomUUID(), name: `Projeto sem título ${projects.length + 1}`, mode: 'image', art: 'aurora', updatedAt: 'Agora', status: 'draft' }
    setProjects((current) => [project, ...current])
    openProject(project)
  }

  function openProject(project: Project) {
    setCurrentProjectId(project.id)
    setProjectName(project.name)
    setMode(project.mode)
    setSelected(Math.max(0, variations.findIndex((variation) => variation.className === project.art)))
    setActiveView('create')
  }

  function renameProject(name: string) {
    setProjectName(name)
    setProjects((current) => current.map((project) => project.id === currentProjectId ? { ...project, name, updatedAt: 'Agora' } : project))
  }

  function usePreset(preset: ModelPreset) {
    setSelectedPreset(preset)
    setActiveView('create')
  }

  async function generate() {
    if (!prompt.trim() || isGenerating) return
    setIsGenerating(true)
    setGenerationError(null)
    try {
      const job = await generateMedia({ prompt, kind: mode, projectId: currentProjectId, presetId: selectedPreset.id, brandSnapshot: brand, style: '3D' }, setGenerationStatus)
      const nextSelected = Math.max(0, variations.findIndex((variation) => variation.className === job.result?.art))
      setGeneratedAt('agora')
      setSelected(nextSelected)
      setCredits(await getCreditBalance())
      setAssets(await getAssets())
      setProjects((current) => current.map((project) => project.id === currentProjectId ? { ...project, name: projectName, mode, art: variations[nextSelected].className, updatedAt: 'Agora' } : project))
    } catch {
      setGenerationStatus('failed')
      setGenerationError('Não foi possível concluir a geração. Confirme que a API está rodando.')
    } finally {
      setIsGenerating(false)
    }
  }

  return (
    <main className="studio-shell">
      <Sidebar activeView={activeView} credits={credits} projects={projects} onNavigate={setActiveView} onNewProject={newProject} onOpenProject={openProject} />

      {activeView === 'create' ? <section className="workspace">
        <header className="topbar">
            <div className="project-title"><button className="mobile-menu"><Menu size={19} /></button><span className="status-dot" /><input aria-label="Nome do projeto" value={projectName} onChange={(event) => renameProject(event.target.value)} /><span className="saved">Salvo localmente</span></div>
          <div className="top-actions">
            <button className="icon-button" title="Desfazer"><Undo2 size={17} /></button><button className="icon-button" title="Refazer"><Redo2 size={17} /></button><span className="action-divider" />
            <button className="ghost-button"><Play size={15} fill="currentColor" /> Visualizar</button><button className="export-button"><ArrowDownToLine size={16} /> Exportar</button>
          </div>
        </header>

        <div className={showPanel ? 'work-area' : 'work-area panel-closed'}>
          {showPanel && <aside className="creation-panel">
            <div className="panel-heading"><div><span className="eyebrow">CRIAR COM IA</span><h1>Imagine. Crie.</h1></div><button className="collapse-button" onClick={() => setShowPanel(false)}><X size={17} /></button></div>
            <div className="mode-switch">
              <button className={mode === 'image' ? 'selected' : ''} onClick={() => setMode('image')}><Image size={16} /> Imagem</button>
              <button className={mode === 'video' ? 'selected' : ''} onClick={() => setMode('video')}><Video size={16} /> Vídeo</button>
            </div>
            <label className="field-label" htmlFor="prompt">Descreva sua ideia</label>
            <div className="prompt-box"><textarea id="prompt" value={prompt} onChange={(event) => setPrompt(event.target.value)} maxLength={600} /><div className="prompt-meta"><button title="Adicionar referência"><Upload size={15} /> Referência</button><span>{prompt.length}/600</span></div></div>
            <div className="setting-grid">
              <div><label className="field-label">Formato</label><button className="select-control"><Square size={15} /> 1:1 <ChevronDown size={14} /></button></div>
              <div><label className="field-label">Variações</label><button className="select-control">4 imagens <ChevronDown size={14} /></button></div>
            </div>
            <label className="field-label">Estilo</label>
            <div className="style-row">{['Editorial', '3D', 'Foto', 'Arte'].map((style, index) => <button className={index === 1 ? 'style-chip active' : 'style-chip'} key={style}>{style}</button>)}</div>
            <button className="subject-preset" onClick={() => setActiveView('models')}><span><ScanFace size={16} /></span><span><small>Modelo de imagem</small><strong>{selectedPreset.name}</strong></span><em>Explorar</em></button>
            <button className="model-picker"><span className="model-icon"><WandSparkles size={16} /></span><span><small>Modelo recomendado</small><strong>{mode === 'image' ? 'Flux Pro Ultra' : 'Kling Motion'}</strong></span><ChevronDown size={15} /></button>
            {mode === 'video' && <div className="video-options"><div><Clock3 size={15} /><span>Duração</span><strong>5s</strong></div><div><Music2 size={15} /><span>Áudio</span><strong>Sem áudio</strong></div></div>}
            <button className="generate-button" onClick={generate} disabled={isGenerating || !prompt.trim()}>
              {isGenerating ? <span className="spinner" /> : <Sparkles size={17} />}{isGenerating ? (generationStatus === 'queued' ? 'Na fila...' : 'Processando com IA...') : `Gerar ${mode === 'image' ? 'imagens' : 'vídeo'}`}{!isGenerating && <span className="cost">{mode === 'image' ? '4' : '24'} créditos</span>}
            </button>
            {generationError && <p className="generation-error">{generationError}</p>}
            <div className="generation-info"><span>Última geração · {generatedAt}</span><button><Clock3 size={14} /> Histórico</button></div>
            <div className="variation-grid">{variations.map((variation, index) => (
              <button className={selected === index ? `variation ${variation.className} selected` : `variation ${variation.className}`} key={variation.id} onClick={() => setSelected(index)} aria-label={variation.label}><span className="generated-art" />{selected === index && <span className="selected-badge">Selecionada</span>}</button>
            ))}</div>
          </aside>}

          {!showPanel && <button className="open-panel" onClick={() => setShowPanel(true)}><Sparkles size={17} /> Criar</button>}

          <section className="canvas-zone">
            <div className="canvas-toolbar">
              {([['select', MousePointer2, 'Selecionar'], ['crop', Crop, 'Recortar'], ['text', Type, 'Texto'], ['shapes', Shapes, 'Formas'], ['adjust', SlidersHorizontal, 'Ajustes']] as const).map(([id, Icon, label]) => (
                <button className={tool === id ? 'active' : ''} onClick={() => setTool(id)} key={id} title={label}><Icon size={18} /> <span>{label}</span></button>
              ))}<span className="toolbar-divider" /><button title="Girar"><RotateCw size={18} /></button><button title="Preencher"><Maximize2 size={18} /></button>
            </div>
            <div className="canvas-stage"><div className={`artboard ${selectedVariation.className}`} style={{ width: `${Math.min(88, zoom)}%`, filter: `saturate(${temperature / 50}) contrast(${contrast / 50})` }}>
              <div className="art-glow one" /><div className="art-glow two" /><div className="art-object"><span className="glass-core" /><span className="glass-ring ring-one" /><span className="glass-ring ring-two" /></div>
              <div className="art-copy"><small>THE SHAPE OF</small><strong>NEW IDEAS</strong><p>Imagine beyond the ordinary.</p></div>
              {mode === 'video' && <button className="play-overlay"><Play size={24} fill="currentColor" /></button>}
            </div></div>
            <div className="zoom-control"><button onClick={() => setZoom((value) => Math.max(36, value - 8))}><ZoomOut size={16} /></button><span>{zoom}%</span><button onClick={() => setZoom((value) => Math.min(88, value + 8))}><ZoomIn size={16} /></button><button><Maximize2 size={15} /></button></div>
          </section>

          <aside className="properties-panel">
            <div className="properties-header"><span>Ajustes</span><button><Settings2 size={16} /></button></div>
            <div className="property-section"><div className="property-title"><span>Camadas</span><Plus size={15} /></div>
              <button className="layer active"><span className={`layer-thumb ${selectedVariation.className}`} /><span><strong>Arte gerada</strong><small>Imagem</small></span></button>
              <button className="layer"><span className="text-layer">T</span><span><strong>NEW IDEAS</strong><small>Texto</small></span></button>
              <button className="layer"><span className="text-layer small">T</span><span><strong>Imagine beyond...</strong><small>Texto</small></span></button>
            </div>
            <div className="property-section"><div className="property-title"><span>Imagem</span><Minus size={15} /></div>
              <label className="slider-label"><span>Intensidade</span><strong>{temperature}%</strong></label><input type="range" min="0" max="100" value={temperature} onChange={(event) => setTemperature(Number(event.target.value))} />
              <label className="slider-label"><span>Contraste</span><strong>{contrast}%</strong></label><input type="range" min="0" max="100" value={contrast} onChange={(event) => setContrast(Number(event.target.value))} />
              <div className="quick-actions"><button><WandSparkles size={16} /><span>Remover fundo</span></button><button><Maximize2 size={16} /><span>Upscale 2×</span></button></div>
            </div>
            <div className="property-section compact"><button className="property-row"><span><Layers3 size={16} /> Posição e tamanho</span><ChevronDown size={15} /></button><button className="property-row"><span><SlidersHorizontal size={16} /> Filtros</span><ChevronDown size={15} /></button></div>
          </aside>
        </div>
      </section> : <section className="workspace page-workspace">
        {activeView === 'models' && <ModelsPage selected={selectedPreset} onUse={usePreset} />}
        {activeView === 'projects' && <ProjectsPage projects={projects} onCreate={newProject} onOpen={openProject} />}
        {activeView === 'library' && <LibraryPage assets={assets} />}
        {activeView === 'brand' && <BrandKitPage brand={brand} onChange={setBrand} />}
      </section>}
    </main>
  )
}

export default App
