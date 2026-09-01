import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  ArrowDownToLine, Check, ChevronDown, Circle, Clock3, Crop, Eye, EyeOff, Image, Layers3,
  Maximize2, Menu, Minus, MousePointer2, Music2, Play, Plus, Redo2, RotateCw, ScanFace,
  Settings2, Shapes, SlidersHorizontal, Sparkles, Square, Trash2, Type, Undo2, Video,
  WandSparkles, X, ZoomIn, ZoomOut,
} from 'lucide-react'
import { Artboard } from './components/Artboard'
import { Dropdown, DropdownItem, DropdownLabel } from './components/Dropdown'
import { Modal } from './components/Modal'
import { Sidebar } from './components/Sidebar'
import { initialAssets, initialBrand, initialProjects, variations } from './data/studio'
import { modelPresets } from './data/model-presets'
import { useHistory } from './hooks/useHistory'
import { useLocalStorage } from './hooks/useLocalStorage'
import { exportDoc } from './lib/render'
import { BrandKitPage } from './pages/BrandKitPage'
import { LibraryPage } from './pages/LibraryPage'
import { ModelsPage } from './pages/ModelsPage'
import { ProjectsPage } from './pages/ProjectsPage'
import { generateMedia, getAssets, getCreditBalance, getModels, type GenerationJob } from './services/generation/client'
import { ASPECT_RATIOS, STYLES, createDoc, type EditorDoc, type Layer, type MediaMode, type ModelDescriptor, type ModelPreset, type Project, type StudioView, type Tool } from './types/studio'
import './App.css'
import './pages.css'
import './models.css'
import './ui.css'

const topNav: Array<{ id: StudioView; label: string }> = [
  { id: 'create', label: 'Criar' },
  { id: 'models', label: 'Modelos' },
  { id: 'projects', label: 'Projetos' },
  { id: 'library', label: 'Biblioteca' },
  { id: 'brand', label: 'Brand kit' },
]

const durations = [3, 5, 10]

function App() {
  const [activeView, setActiveView] = useState<StudioView>('create')
  const [projects, setProjects] = useLocalStorage('pitch-studio:projects', initialProjects)
  const [assets, setAssets] = useLocalStorage('pitch-studio:assets', initialAssets)
  const [brand, setBrand] = useLocalStorage('pitch-studio:brand', initialBrand)
  const [credits, setCredits] = useLocalStorage('pitch-studio:credits', 824)

  /* o primeiro projeto vem do localStorage quando existe, então o editor
     reabre exatamente onde parou em vez de recomeçar de um doc vazio */
  const [currentProjectId, setCurrentProjectId] = useState(() => projects[0]?.id ?? initialProjects[0].id)
  const [projectName, setProjectName] = useState(() => projects[0]?.name ?? initialProjects[0].name)
  const [mode, setMode] = useState<MediaMode>(() => projects[0]?.mode ?? 'image')
  const [selectedPreset, setSelectedPreset] = useState(modelPresets[0])
  const [style, setStyle] = useState<string>('3D')
  const [models, setModels] = useState<ModelDescriptor[]>([])
  const [modelId, setModelId] = useState<string>('')
  const [duration, setDuration] = useState(5)
  const [audio, setAudio] = useState(false)
  const [reference, setReference] = useState<{ name: string; url: string } | null>(null)

  const [prompt, setPrompt] = useState('Uma escultura abstrata de vidro líquido, reflexos violeta e coral, flutuando em um estúdio escuro, luz cinematográfica')
  const [tool, setTool] = useState<Tool>('select')
  const [selectedLayerId, setSelectedLayerId] = useState<string | null>(null)
  const [isGenerating, setIsGenerating] = useState(false)
  const [generationStatus, setGenerationStatus] = useState<GenerationJob['status'] | null>(null)
  const [generationError, setGenerationError] = useState<string | null>(null)
  const [zoom, setZoom] = useState(74)
  const [showPanel, setShowPanel] = useState(true)
  const [showPreview, setShowPreview] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [exported, setExported] = useState<string | null>(null)
  const [openSections, setOpenSections] = useState({ position: false, filters: false })

  const { doc, set, commitLater, undo, redo, reset, canUndo, canRedo } = useHistory<EditorDoc>(
    projects[0]?.doc ?? createDoc(projects[0]?.art ?? 'aurora'),
  )
  const fileInput = useRef<HTMLInputElement>(null)

  const modelsForMode = useMemo(() => models.filter((model) => model.kind === mode), [models, mode])
  const activeModel = useMemo(
    () => modelsForMode.find((model) => model.id === modelId) ?? modelsForMode[0],
    [modelsForMode, modelId],
  )
  const selectedLayer = doc.layers.find((layer) => layer.id === selectedLayerId) ?? null

  /* ---------- carga inicial ---------- */
  useEffect(() => {
    void getCreditBalance().then(setCredits).catch(() => undefined)
    void getAssets().then((stored) => { if (stored.length > 0) setAssets(stored) }).catch(() => undefined)
    void getModels().then(setModels).catch(() => undefined)
  }, [setAssets, setCredits])

  /* Espelha o documento em edição no projeto correspondente. É uma
     sincronização com o armazenamento local, não estado derivado: o
     histórico de undo/redo é a fonte de verdade enquanto se edita. */
  // oxlint-disable-next-line react/set-state-in-effect
  useEffect(() => {
    setProjects((current) => current.map((project) => project.id === currentProjectId
      ? { ...project, doc, art: doc.art, mode, name: projectName, updatedAt: 'Agora' }
      : project))
  }, [doc, mode, projectName, currentProjectId, setProjects])

  /* ---------- atalhos de teclado ---------- */
  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      const target = event.target as HTMLElement
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return
      const meta = event.ctrlKey || event.metaKey
      if (meta && event.key.toLowerCase() === 'z') {
        event.preventDefault()
        if (event.shiftKey) redo(); else undo()
      }
      if (meta && event.key.toLowerCase() === 'y') { event.preventDefault(); redo() }
      if (event.key === 'Delete' && selectedLayerId) removeLayer(selectedLayerId)
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  })

  /* ---------- projetos ---------- */
  function newProject() {
    const fresh = createDoc('aurora')
    const project: Project = {
      id: crypto.randomUUID(),
      name: `Projeto sem título ${projects.length + 1}`,
      mode: 'image',
      art: 'aurora',
      updatedAt: 'Agora',
      status: 'draft',
      doc: fresh,
    }
    setProjects((current) => [project, ...current])
    setCurrentProjectId(project.id)
    setProjectName(project.name)
    setMode('image')
    reset(fresh)
    setSelectedLayerId(null)
    setActiveView('create')
  }

  const openProject = useCallback((project: Project) => {
    setCurrentProjectId(project.id)
    setProjectName(project.name)
    setMode(project.mode)
    reset(project.doc ?? createDoc(project.art))
    setSelectedLayerId(null)
    setActiveView('create')
  }, [reset])

  const renameProject = useCallback((id: string, name: string) => {
    setProjects((current) => current.map((project) => project.id === id ? { ...project, name, updatedAt: 'Agora' } : project))
    if (id === currentProjectId) setProjectName(name)
  }, [currentProjectId, setProjects])

  const duplicateProject = useCallback((project: Project) => {
    const copy: Project = { ...project, id: crypto.randomUUID(), name: `${project.name} (cópia)`, updatedAt: 'Agora' }
    setProjects((current) => [copy, ...current])
  }, [setProjects])

  const deleteProject = useCallback((id: string) => {
    const rest = projects.filter((project) => project.id !== id)
    setProjects(rest)
    if (id !== currentProjectId) return
    const next = rest[0]
    if (next) {
      setCurrentProjectId(next.id)
      setProjectName(next.name)
      setMode(next.mode)
      reset(next.doc ?? createDoc(next.art))
    }
    setSelectedLayerId(null)
  }, [projects, currentProjectId, reset, setProjects])

  /* ---------- camadas ---------- */
  function addLayer(layer: Layer) {
    set((current) => ({ ...current, layers: [...current.layers, layer] }))
    setSelectedLayerId(layer.id)
  }

  function addText() {
    addLayer({ id: crypto.randomUUID(), kind: 'text', name: 'Novo texto', visible: true, text: 'Texto', size: 60, x: 10, y: 40 })
    setTool('text')
  }

  function addShape(shape: 'rect' | 'circle') {
    addLayer({ id: crypto.randomUUID(), kind: 'shape', name: shape === 'circle' ? 'Círculo' : 'Retângulo', visible: true, shape, size: 22, x: 38, y: 38, color: brand.colors[0] ?? '#be93ff' })
    setTool('shapes')
  }

  function toggleLayer(id: string) {
    set((current) => ({ ...current, layers: current.layers.map((layer) => layer.id === id ? { ...layer, visible: !layer.visible } : layer) }))
  }

  function removeLayer(id: string) {
    set((current) => ({ ...current, layers: current.layers.filter((layer) => layer.id !== id) }))
    setSelectedLayerId((current) => current === id ? null : current)
  }

  function updateLayer(id: string, patch: Partial<Layer>) {
    set((current) => ({ ...current, layers: current.layers.map((layer) => layer.id === id ? { ...layer, ...patch } : layer) }))
  }

  /* ---------- ações do canvas ---------- */
  function rotate() { set((current) => ({ ...current, rotation: (current.rotation + 90) % 360 })) }
  function fitToScreen() { setZoom(88) }
  function setRatio(ratio: string) { set((current) => ({ ...current, aspectRatio: ratio })) }
  function toggleBackground() { set((current) => ({ ...current, bgRemoved: !current.bgRemoved })) }
  function toggleUpscale() { set((current) => ({ ...current, upscaled: !current.upscaled })) }

  function pickReference(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (!file) return
    if (reference) URL.revokeObjectURL(reference.url)
    setReference({ name: file.name, url: URL.createObjectURL(file) })
    event.target.value = ''
  }

  async function handleExport() {
    setExporting(true)
    setGenerationError(null)
    try {
      const filename = await exportDoc(doc, projectName)
      setExported(filename)
      window.setTimeout(() => setExported(null), 3000)
    } catch {
      setGenerationError('Não foi possível exportar a imagem.')
    } finally {
      setExporting(false)
    }
  }

  function usePreset(preset: ModelPreset) {
    setSelectedPreset(preset)
    setActiveView('create')
  }

  /* ---------- geração ---------- */
  async function generate() {
    if (!prompt.trim() || isGenerating || !activeModel) return
    setIsGenerating(true)
    setGenerationError(null)
    try {
      const job = await generateMedia({
        prompt,
        kind: mode,
        projectId: currentProjectId,
        presetId: selectedPreset.id,
        brandSnapshot: brand,
        style,
        modelId: activeModel.id,
        aspectRatio: doc.aspectRatio,
      }, setGenerationStatus)

      const art = job.result?.art ?? doc.art
      set((current) => ({ ...current, art }))
      setCredits(await getCreditBalance())
      setAssets(await getAssets())
    } catch (error) {
      setGenerationStatus('failed')
      const code = error instanceof Error ? error.message : ''
      setGenerationError(
        code === 'INSUFFICIENT_CREDITS' ? 'Créditos insuficientes para esta geração.'
        : code === 'MODEL_NOT_FOUND' ? 'O modelo selecionado não está disponível.'
        : 'Não foi possível concluir a geração. Confirme que a API está rodando.',
      )
    } finally {
      setIsGenerating(false)
    }
  }

  const cost = activeModel?.costCredits ?? (mode === 'image' ? 4 : 24)

  return (
    <main className="studio-shell">
      <Sidebar
        activeView={activeView}
        credits={credits}
        projects={projects}
        onNavigate={setActiveView}
        onNewProject={newProject}
        onOpenProject={openProject}
      />

      <section className={activeView === 'create' ? 'workspace' : 'workspace page-workspace'}>
        <header className="topbar">
          <div className="project-title">
            <button className="mobile-menu" onClick={() => setActiveView('projects')}><Menu size={19} /></button>
            <span className="status-dot" />
            <input aria-label="Nome do projeto" value={projectName} onChange={(event) => renameProject(currentProjectId, event.target.value)} />
            <span className="saved">Salvo localmente</span>
          </div>

          <nav className="top-nav" aria-label="Seções">
            {topNav.map((item, index) => (
              <Fragment key={item.id}>
                {index > 0 && <span className="sep" />}
                <button className={activeView === item.id ? 'active' : ''} onClick={() => setActiveView(item.id)}>{item.label}</button>
              </Fragment>
            ))}
          </nav>

          <div className="top-actions">
            <button className="icon-button" title="Desfazer (Ctrl+Z)" onClick={undo} disabled={!canUndo}><Undo2 size={17} /></button>
            <button className="icon-button" title="Refazer (Ctrl+Shift+Z)" onClick={redo} disabled={!canRedo}><Redo2 size={17} /></button>
            <span className="action-divider" />
            <button className="ghost-button" onClick={() => setShowPreview(true)}><Play size={15} fill="currentColor" /> Visualizar</button>
            <button className="export-button" onClick={handleExport} disabled={exporting} title={exported ? `Salvo como ${exported}` : 'Exportar PNG'}>
              {exporting ? <span className="spinner" /> : exported ? <Check size={16} /> : <ArrowDownToLine size={16} />}
              {exported ? 'Baixado' : 'Exportar'}
            </button>
          </div>
        </header>

        {activeView === 'create' ? (
          <div className={showPanel ? 'work-area' : 'work-area panel-closed'}>
            <section className="canvas-zone" onClick={() => setSelectedLayerId(null)}>
              <div className="canvas-toolbar" onClick={(event) => event.stopPropagation()}>
                <button className={tool === 'select' ? 'active' : ''} onClick={() => setTool('select')} title="Selecionar"><MousePointer2 size={18} /> <span>Selecionar</span></button>

                <Dropdown
                  className={tool === 'crop' ? 'active' : ''}
                  title="Recortar"
                  label={<><Crop size={18} /> <span>Recortar</span></>}
                >
                  {(close) => <>
                    <DropdownLabel>Proporção</DropdownLabel>
                    {ASPECT_RATIOS.map((ratio) => (
                      <DropdownItem key={ratio} active={doc.aspectRatio === ratio} onClick={() => { setRatio(ratio); setTool('crop'); close() }}>{ratio}</DropdownItem>
                    ))}
                  </>}
                </Dropdown>

                <button onClick={addText} title="Adicionar texto"><Type size={18} /> <span>Texto</span></button>

                <Dropdown title="Adicionar forma" label={<><Shapes size={18} /> <span>Formas</span></>}>
                  {(close) => <>
                    <DropdownItem onClick={() => { addShape('rect'); close() }}><Square size={15} /> Retângulo</DropdownItem>
                    <DropdownItem onClick={() => { addShape('circle'); close() }}><Circle size={15} /> Círculo</DropdownItem>
                  </>}
                </Dropdown>

                <button className={tool === 'adjust' ? 'active' : ''} onClick={() => { setTool('adjust'); setShowPanel(true) }} title="Ajustes"><SlidersHorizontal size={18} /> <span>Ajustes</span></button>
                <span className="toolbar-divider" />
                <button onClick={rotate} title={`Girar (${doc.rotation}°)`}><RotateCw size={18} /></button>
                <button onClick={fitToScreen} title="Preencher tela"><Maximize2 size={18} /></button>
              </div>

              {!showPanel && <button className="open-panel" onClick={(event) => { event.stopPropagation(); setShowPanel(true) }}><Layers3 size={16} /> Ajustes</button>}

              <div className="variation-strip" onClick={(event) => event.stopPropagation()}>
                {variations.map((variation) => (
                  <button
                    className={doc.art === variation.className ? `variation ${variation.className} selected` : `variation ${variation.className}`}
                    key={variation.id}
                    onClick={() => set((current) => ({ ...current, art: variation.className }))}
                    title={variation.label}
                    aria-label={variation.label}
                  ><span className="generated-art" /></button>
                ))}
              </div>

              <div className="canvas-stage">
                <Artboard
                  doc={doc}
                  mode={mode}
                  width={`${Math.min(88, zoom)}%`}
                  selectedLayerId={selectedLayerId}
                  onSelectLayer={setSelectedLayerId}
                />
              </div>

              <div className="prompt-bar" onClick={(event) => event.stopPropagation()}>
                {reference && <div className="reference-chip">
                  <img src={reference.url} alt="" />
                  <span>{reference.name}</span>
                  <button onClick={() => { URL.revokeObjectURL(reference.url); setReference(null) }} title="Remover referência"><X size={14} /></button>
                </div>}

                <div className="prompt-row">
                  <button className="prompt-add" title="Adicionar referência" onClick={() => fileInput.current?.click()}><Plus size={19} /></button>
                  <input ref={fileInput} type="file" accept="image/*" hidden onChange={pickReference} />
                  <textarea
                    aria-label="Descreva sua ideia"
                    placeholder="Descreva qualquer ideia visual. Nós geramos para você."
                    value={prompt}
                    maxLength={600}
                    onChange={(event) => setPrompt(event.target.value)}
                  />
                  <button className="generate-button" onClick={generate} disabled={isGenerating || !prompt.trim()}>
                    {isGenerating ? <span className="spinner" /> : <Sparkles size={16} />}
                    {isGenerating ? (generationStatus === 'queued' ? 'Na fila' : 'Gerando') : 'Gerar'}
                  </button>
                </div>

                <div className="prompt-chips">
                  <div className="chip-group">
                    <button className={mode === 'image' ? 'chip active' : 'chip'} onClick={() => setMode('image')}><Image size={14} /> Imagem</button>
                    <button className={mode === 'video' ? 'chip active' : 'chip'} onClick={() => setMode('video')}><Video size={14} /> Vídeo</button>
                  </div>

                  <button className="chip" onClick={() => setActiveView('models')}><ScanFace size={14} /> <strong>{selectedPreset.name}</strong></button>

                  <Dropdown className="chip" up label={<><WandSparkles size={14} /> <strong>{activeModel?.name ?? 'Modelo'}</strong></>}>
                    {(close) => <>
                      <DropdownLabel>Modelos de {mode === 'image' ? 'imagem' : 'vídeo'}</DropdownLabel>
                      {modelsForMode.length === 0 && <DropdownItem>Nenhum modelo disponível</DropdownItem>}
                      {modelsForMode.map((model) => (
                        <DropdownItem key={model.id} active={model.id === activeModel?.id} onClick={() => { setModelId(model.id); close() }}>
                          <span>{model.name}</span>
                          <em>{model.costCredits} cr</em>
                        </DropdownItem>
                      ))}
                    </>}
                  </Dropdown>

                  <Dropdown className="chip" up label={<><Square size={13} /> {doc.aspectRatio}</>}>
                    {(close) => <>
                      <DropdownLabel>Proporção</DropdownLabel>
                      {ASPECT_RATIOS.map((ratio) => (
                        <DropdownItem key={ratio} active={doc.aspectRatio === ratio} onClick={() => { setRatio(ratio); close() }}>{ratio}</DropdownItem>
                      ))}
                    </>}
                  </Dropdown>

                  <Dropdown className="chip" up label={style}>
                    {(close) => <>
                      <DropdownLabel>Estilo</DropdownLabel>
                      {STYLES.map((item) => (
                        <DropdownItem key={item} active={style === item} onClick={() => { setStyle(item); close() }}>{item}</DropdownItem>
                      ))}
                    </>}
                  </Dropdown>

                  {mode === 'video' && <Dropdown className="chip" up label={<><Clock3 size={13} /> {duration}s</>}>
                    {(close) => <>
                      <DropdownLabel>Duração</DropdownLabel>
                      {durations.map((value) => (
                        <DropdownItem key={value} active={duration === value} onClick={() => { setDuration(value); close() }}>{value} segundos</DropdownItem>
                      ))}
                    </>}
                  </Dropdown>}

                  {mode === 'video' && <button className={audio ? 'chip active' : 'chip'} onClick={() => setAudio((value) => !value)}>
                    <Music2 size={13} /> {audio ? 'Com áudio' : 'Sem áudio'}
                  </button>}

                  <span className="chip-cost">{cost} créditos</span>
                </div>

                {generationError && <p className="generation-error">{generationError}</p>}
              </div>

              <div className="zoom-control" onClick={(event) => event.stopPropagation()}>
                <button onClick={() => setZoom((value) => Math.max(36, value - 8))} title="Diminuir"><ZoomOut size={16} /></button>
                <span>{zoom}%</span>
                <button onClick={() => setZoom((value) => Math.min(88, value + 8))} title="Aumentar"><ZoomIn size={16} /></button>
              </div>
            </section>

            {showPanel && <aside className="properties-panel">
              <div className="properties-header">
                <span>Ajustes</span>
                <button onClick={() => setShowPanel(false)} title="Fechar painel"><X size={16} /></button>
              </div>

              <div className="property-section">
                <div className="property-title">
                  <span>Camadas</span>
                  <Dropdown className="title-action" title="Adicionar camada" label={<Plus size={15} />} align="right">
                    {(close) => <>
                      <DropdownItem onClick={() => { addText(); close() }}><Type size={15} /> Texto</DropdownItem>
                      <DropdownItem onClick={() => { addShape('rect'); close() }}><Square size={15} /> Retângulo</DropdownItem>
                      <DropdownItem onClick={() => { addShape('circle'); close() }}><Circle size={15} /> Círculo</DropdownItem>
                    </>}
                  </Dropdown>
                </div>

                {doc.layers.map((layer) => (
                  <div className={selectedLayerId === layer.id ? 'layer active' : 'layer'} key={layer.id}>
                    <button className="layer-main" onClick={() => setSelectedLayerId(layer.id)}>
                      {layer.kind === 'art'
                        ? <span className={`layer-thumb ${doc.art}`} />
                        : layer.kind === 'text'
                          ? <span className="text-layer">T</span>
                          : <span className="text-layer" style={{ background: layer.color }} />}
                      <span>
                        <strong>{layer.kind === 'text' ? (layer.text || layer.name) : layer.name}</strong>
                        <small>{layer.kind === 'art' ? (mode === 'video' ? 'Vídeo' : 'Imagem') : layer.kind === 'text' ? 'Texto' : 'Forma'}</small>
                      </span>
                    </button>
                    <button className="layer-eye" onClick={() => toggleLayer(layer.id)} title={layer.visible ? 'Ocultar' : 'Mostrar'}>
                      {layer.visible ? <Eye size={14} /> : <EyeOff size={14} />}
                    </button>
                    {layer.kind !== 'art' && <button className="layer-eye" onClick={() => removeLayer(layer.id)} title="Excluir camada"><Trash2 size={14} /></button>}
                  </div>
                ))}
              </div>

              {selectedLayer && selectedLayer.kind === 'text' && <div className="property-section">
                <div className="property-title"><span>Texto</span></div>
                <input
                  className="text-field"
                  value={selectedLayer.text ?? ''}
                  onChange={(event) => updateLayer(selectedLayer.id, { text: event.target.value })}
                  placeholder="Conteúdo"
                />
                <label className="slider-label"><span>Tamanho</span><strong>{selectedLayer.size}</strong></label>
                <input type="range" min="20" max="160" value={selectedLayer.size ?? 60} onChange={(event) => updateLayer(selectedLayer.id, { size: Number(event.target.value) })} />
              </div>}

              {selectedLayer && selectedLayer.kind === 'shape' && <div className="property-section">
                <div className="property-title"><span>Forma</span></div>
                <label className="slider-label"><span>Tamanho</span><strong>{selectedLayer.size}%</strong></label>
                <input type="range" min="6" max="70" value={selectedLayer.size ?? 22} onChange={(event) => updateLayer(selectedLayer.id, { size: Number(event.target.value) })} />
                <div className="swatch-row">
                  {brand.colors.map((color) => (
                    <button key={color} className={selectedLayer.color === color ? 'swatch active' : 'swatch'} style={{ background: color }} onClick={() => updateLayer(selectedLayer.id, { color })} title={color} />
                  ))}
                </div>
              </div>}

              <div className="property-section">
                <div className="property-title"><span>Imagem</span><Minus size={15} /></div>
                <label className="slider-label"><span>Intensidade</span><strong>{doc.temperature}%</strong></label>
                <input type="range" min="0" max="100" value={doc.temperature} onChange={(event) => commitLater((current) => ({ ...current, temperature: Number(event.target.value) }))} />
                <label className="slider-label"><span>Contraste</span><strong>{doc.contrast}%</strong></label>
                <input type="range" min="0" max="100" value={doc.contrast} onChange={(event) => commitLater((current) => ({ ...current, contrast: Number(event.target.value) }))} />
                <div className="quick-actions">
                  <button className={doc.bgRemoved ? 'active' : ''} onClick={toggleBackground}>
                    <WandSparkles size={16} /><span>{doc.bgRemoved ? 'Restaurar fundo' : 'Remover fundo'}</span>
                  </button>
                  <button className={doc.upscaled ? 'active' : ''} onClick={toggleUpscale}>
                    <Maximize2 size={16} /><span>{doc.upscaled ? 'Voltar a 1×' : 'Upscale 2×'}</span>
                  </button>
                </div>
              </div>

              <div className="property-section compact">
                <button className="property-row" onClick={() => setOpenSections((current) => ({ ...current, position: !current.position }))}>
                  <span><Layers3 size={16} /> Posição e tamanho</span>
                  <ChevronDown size={15} className={openSections.position ? 'flip' : ''} />
                </button>
                {openSections.position && <div className="row-content">
                  {selectedLayer && selectedLayer.kind !== 'art' ? <>
                    <label className="slider-label"><span>Horizontal</span><strong>{selectedLayer.x ?? 0}%</strong></label>
                    <input type="range" min="0" max="92" value={selectedLayer.x ?? 0} onChange={(event) => updateLayer(selectedLayer.id, { x: Number(event.target.value) })} />
                    <label className="slider-label"><span>Vertical</span><strong>{selectedLayer.y ?? 0}%</strong></label>
                    <input type="range" min="0" max="96" value={selectedLayer.y ?? 0} onChange={(event) => updateLayer(selectedLayer.id, { y: Number(event.target.value) })} />
                  </> : <p className="row-hint">Selecione uma camada de texto ou forma.</p>}
                  <label className="slider-label"><span>Rotação da arte</span><strong>{doc.rotation}°</strong></label>
                  <input type="range" min="0" max="350" step="10" value={doc.rotation} onChange={(event) => commitLater((current) => ({ ...current, rotation: Number(event.target.value) }))} />
                </div>}

                <button className="property-row" onClick={() => setOpenSections((current) => ({ ...current, filters: !current.filters }))}>
                  <span><Settings2 size={16} /> Filtros</span>
                  <ChevronDown size={15} className={openSections.filters ? 'flip' : ''} />
                </button>
                {openSections.filters && <div className="row-content">
                  <div className="filter-row">
                    {variations.map((variation) => (
                      <button
                        key={variation.id}
                        className={doc.art === variation.className ? `filter-chip ${variation.className} active` : `filter-chip ${variation.className}`}
                        onClick={() => set((current) => ({ ...current, art: variation.className }))}
                      >{variation.label.split(' ')[0]}</button>
                    ))}
                  </div>
                </div>}
              </div>
            </aside>}
          </div>
        ) : <>
          {activeView === 'models' && <ModelsPage selected={selectedPreset} onUse={usePreset} />}
          {activeView === 'projects' && <ProjectsPage
            projects={projects}
            onCreate={newProject}
            onOpen={openProject}
            onRename={renameProject}
            onDuplicate={duplicateProject}
            onDelete={deleteProject}
          />}
          {activeView === 'library' && <LibraryPage assets={assets} onDelete={(id) => setAssets((current) => current.filter((asset) => asset.id !== id))} />}
          {activeView === 'brand' && <BrandKitPage brand={brand} onChange={setBrand} />}
        </>}
      </section>

      {showPreview && <Modal title={projectName} onClose={() => setShowPreview(false)} wide>
        <div className="preview-stage">
          <Artboard doc={doc} mode={mode} width="100%" />
        </div>
        <div className="preview-actions">
          <span>{doc.aspectRatio} · {doc.upscaled ? '2160px' : '1080px'} · {doc.layers.filter((layer) => layer.visible).length} camadas visíveis</span>
          <button className="page-primary" onClick={handleExport} disabled={exporting}>
            {exporting ? <span className="spinner" /> : <ArrowDownToLine size={16} />} Exportar PNG
          </button>
        </div>
      </Modal>}
    </main>
  )
}

export default App
