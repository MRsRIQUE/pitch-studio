import { ArrowRight, Check, Search, Shuffle, Sparkles } from 'lucide-react'
import { useMemo, useState, type CSSProperties } from 'react'
import personaSprite from '../assets/persona-presets-v1.png'
import { Shockwave } from '../components/Shockwave'
import { modelPresets } from '../data/model-presets'
import type { ModelPreset } from '../types/studio'

type Filter = 'all' | ModelPreset['category']
type Props = { selected: ModelPreset; onUse: (preset: ModelPreset) => void }

const filters: Array<{ id: Filter; label: string }> = [
  { id: 'all', label: 'Todos' }, { id: 'people', label: 'Pessoas' }, { id: 'animals', label: 'Animais' }, { id: 'products', label: 'Produtos' },
]

export function ModelsPage({ selected, onUse }: Props) {
  const [filter, setFilter] = useState<Filter>('all')
  const [active, setActive] = useState(selected)
  const [focused, setFocused] = useState<string | null>(null)
  const [shuffleSeed, setShuffleSeed] = useState(0)

  const visible = useMemo(() => {
    const result = modelPresets.filter((preset) => filter === 'all' || preset.category === filter)
    if (!shuffleSeed) return result
    return [...result].sort((a, b) => ((a.id.charCodeAt(0) + shuffleSeed) % 7) - ((b.id.charCodeAt(0) + shuffleSeed) % 7))
  }, [filter, shuffleSeed])

  return <Shockwave className="model-explorer">
    <header className="explore-toolbar">
      <div className="explore-title"><Sparkles size={16} /><span>Explorar modelos</span><small>{visible.length} opções</small></div>
      <nav aria-label="Filtrar modelos">{filters.map((item) => <button key={item.id} className={filter === item.id ? 'active' : ''} onClick={() => setFilter(item.id)}>{item.label}</button>)}</nav>
      <div className="explore-actions"><button className="explore-search" title="Buscar"><Search size={16} /></button><button className="shuffle-button" onClick={() => setShuffleSeed(Date.now())}><Shuffle size={15} /><span>Embaralhar</span></button></div>
    </header>

    <div className={focused ? 'preset-mosaic has-focus' : 'preset-mosaic'} onMouseLeave={() => setFocused(null)}>
      {visible.map((preset, index) => <button
        key={`${preset.id}-${shuffleSeed}`}
        className={`preset-card preset-${index % 8} ${focused === preset.id ? 'focused' : ''} ${active.id === preset.id ? 'chosen' : ''}`}
        onMouseEnter={() => setFocused(preset.id)}
        onFocus={() => setFocused(preset.id)}
        onClick={() => setActive(preset)}
        style={{ '--preset-tone': preset.tone } as CSSProperties}
      >
        <span className="preset-photo" style={{ backgroundImage: `url(${personaSprite})`, backgroundPosition: preset.spritePosition }} />
        <span className="preset-shade" />
        <span className="preset-copy"><small>{preset.category === 'people' ? 'PERSONA' : preset.category === 'animals' ? 'ANIMAL' : 'PRODUTO'}</small><strong>{preset.name}</strong><em>{preset.description}</em></span>
        {active.id === preset.id && <span className="chosen-mark"><Check size={13} /> Selecionado</span>}
      </button>)}
    </div>

    <div className="explore-selection">
      <span className="selection-thumb" style={{ backgroundImage: `url(${personaSprite})`, backgroundPosition: active.spritePosition }} />
      <span><small>Preset selecionado</small><strong>{active.name}</strong></span>
      <button onClick={() => onUse(active)}>Usar no editor <ArrowRight size={15} /></button>
    </div>
  </Shockwave>
}
