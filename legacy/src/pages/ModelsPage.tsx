import { ArrowRight, Check, Search, Shuffle, Sparkles, X } from 'lucide-react'
import { useMemo, useState, type CSSProperties } from 'react'
import personaSprite from '../assets/persona-presets-v1.png'
import { Shockwave } from '../components/Shockwave'
import { modelPresets } from '../data/model-presets'
import type { ModelPreset } from '../types/studio'

type Filter = 'all' | ModelPreset['category']
type Props = { selected: ModelPreset; onUse: (preset: ModelPreset) => void }

const filters: Array<{ id: Filter; label: string }> = [
  { id: 'all', label: 'Todos' },
  { id: 'people', label: 'Pessoas' },
  { id: 'animals', label: 'Animais' },
  { id: 'products', label: 'Produtos' },
]

const categoryLabel: Record<ModelPreset['category'], string> = {
  people: 'PERSONA',
  animals: 'ANIMAL',
  products: 'PRODUTO',
}

export function ModelsPage({ selected, onUse }: Props) {
  const [filter, setFilter] = useState<Filter>('all')
  const [active, setActive] = useState(selected)
  const [focused, setFocused] = useState<string | null>(null)
  const [shuffleSeed, setShuffleSeed] = useState(0)
  const [searching, setSearching] = useState(false)
  const [query, setQuery] = useState('')

  const visible = useMemo(() => {
    const term = query.trim().toLowerCase()
    const result = modelPresets.filter((preset) => {
      const matchesFilter = filter === 'all' || preset.category === filter
      const matchesQuery = !term
        || preset.name.toLowerCase().includes(term)
        || preset.description.toLowerCase().includes(term)
        || preset.prompt.toLowerCase().includes(term)
      return matchesFilter && matchesQuery
    })
    if (!shuffleSeed) return result
    return [...result].sort((a, b) => ((a.id.charCodeAt(0) + shuffleSeed) % 7) - ((b.id.charCodeAt(0) + shuffleSeed) % 7))
  }, [filter, shuffleSeed, query])

  return <Shockwave className="model-explorer">
    <header className="explore-toolbar">
      <div className="explore-title">
        <Sparkles size={16} />
        <span>Explorar modelos</span>
        <small>{visible.length} {visible.length === 1 ? 'opção' : 'opções'}</small>
      </div>

      <nav aria-label="Filtrar modelos">
        {filters.map((item) => (
          <button key={item.id} className={filter === item.id ? 'active' : ''} onClick={() => setFilter(item.id)}>{item.label}</button>
        ))}
      </nav>

      <div className="explore-actions">
        {searching
          ? <div className="explore-field">
              <Search size={15} />
              <input
                autoFocus
                placeholder="Buscar preset"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                onKeyDown={(event) => { if (event.key === 'Escape') { setQuery(''); setSearching(false) } }}
              />
              <button onClick={() => { setQuery(''); setSearching(false) }} title="Fechar busca"><X size={14} /></button>
            </div>
          : <button className="explore-search" title="Buscar" onClick={() => setSearching(true)}><Search size={16} /></button>}
        <button className="shuffle-button" onClick={() => setShuffleSeed(Date.now())}><Shuffle size={15} /><span>Embaralhar</span></button>
      </div>
    </header>

    {visible.length === 0 ? (
      <div className="empty-state in-explorer">
        <strong>Nenhum preset encontrado</strong>
        <p>Ajuste a busca ou troque o filtro de categoria.</p>
      </div>
    ) : (
      <div className={focused ? 'preset-mosaic has-focus' : 'preset-mosaic'} onMouseLeave={() => setFocused(null)}>
        {visible.map((preset, index) => <button
          key={`${preset.id}-${shuffleSeed}`}
          className={`preset-card preset-${index % 8} ${focused === preset.id ? 'focused' : ''} ${active.id === preset.id ? 'chosen' : ''}`}
          onMouseEnter={() => setFocused(preset.id)}
          onFocus={() => setFocused(preset.id)}
          onClick={() => setActive(preset)}
          onDoubleClick={() => onUse(preset)}
          style={{ '--preset-tone': preset.tone } as CSSProperties}
        >
          <span className="preset-photo" style={{ backgroundImage: `url(${personaSprite})`, backgroundPosition: preset.spritePosition }} />
          <span className="preset-shade" />
          <span className="preset-copy">
            <small>{categoryLabel[preset.category]}</small>
            <strong>{preset.name}</strong>
            <em>{preset.description}</em>
          </span>
          {active.id === preset.id && <span className="chosen-mark"><Check size={13} /> Selecionado</span>}
        </button>)}
      </div>
    )}

    <div className="explore-selection">
      <span className="selection-thumb" style={{ backgroundImage: `url(${personaSprite})`, backgroundPosition: active.spritePosition }} />
      <span><small>Preset selecionado</small><strong>{active.name}</strong></span>
      <button onClick={() => onUse(active)}>Usar no editor <ArrowRight size={15} /></button>
    </div>
  </Shockwave>
}
