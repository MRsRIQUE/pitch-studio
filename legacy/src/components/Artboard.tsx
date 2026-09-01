import { Play } from 'lucide-react'
import type { CSSProperties } from 'react'
import type { EditorDoc, Layer, MediaMode } from '../types/studio'

type Props = {
  doc: EditorDoc
  mode: MediaMode
  width?: string
  selectedLayerId?: string | null
  onSelectLayer?: (id: string) => void
}

function TextLayer({ layer, selected, onSelect }: { layer: Layer; selected: boolean; onSelect?: () => void }) {
  const isTitle = (layer.size ?? 0) >= 60
  const style: CSSProperties = {
    left: `${layer.x ?? 8}%`,
    top: `${layer.y ?? 50}%`,
    fontSize: `${(layer.size ?? 40) / 10}cqw`,
  }
  return <span
    className={`board-text ${isTitle ? 'title' : 'body'} ${selected ? 'selected' : ''}`}
    style={style}
    onClick={onSelect ? (event) => { event.stopPropagation(); onSelect() } : undefined}
  >{isTitle ? layer.text?.toUpperCase() : layer.text}</span>
}

function ShapeLayer({ layer, selected, onSelect }: { layer: Layer; selected: boolean; onSelect?: () => void }) {
  const style: CSSProperties = {
    left: `${layer.x ?? 40}%`,
    top: `${layer.y ?? 40}%`,
    width: `${layer.size ?? 20}%`,
    background: layer.color ?? 'var(--accent)',
    borderRadius: layer.shape === 'circle' ? '50%' : '8px',
    aspectRatio: layer.shape === 'circle' ? '1' : '10 / 7',
  }
  return <span
    className={`board-shape ${selected ? 'selected' : ''}`}
    style={style}
    onClick={onSelect ? (event) => { event.stopPropagation(); onSelect() } : undefined}
  />
}

export function Artboard({ doc, mode, width = '74%', selectedLayerId, onSelectLayer }: Props) {
  const art = doc.layers.find((layer) => layer.kind === 'art')
  const showArt = art ? art.visible : true

  const style: CSSProperties = {
    width,
    aspectRatio: doc.aspectRatio.replace(':', ' / '),
    filter: `saturate(${doc.temperature / 50}) contrast(${doc.contrast / 50})`,
  }

  return <div className={`artboard ${doc.art} ${doc.bgRemoved ? 'transparent' : ''}`} style={style}>
    {showArt && <div className="art-render" style={{ transform: `rotate(${doc.rotation}deg)` }}>
      <div className="art-glow one" />
      <div className="art-glow two" />
      <div className="art-object">
        <span className="glass-core" />
        <span className="glass-ring ring-one" />
        <span className="glass-ring ring-two" />
      </div>
    </div>}

    {doc.layers.map((layer) => {
      if (!layer.visible || layer.kind === 'art') return null
      const selected = selectedLayerId === layer.id
      const select = onSelectLayer ? () => onSelectLayer(layer.id) : undefined
      return layer.kind === 'text'
        ? <TextLayer key={layer.id} layer={layer} selected={selected} onSelect={select} />
        : <ShapeLayer key={layer.id} layer={layer} selected={selected} onSelect={select} />
    })}

    {doc.upscaled && <span className="upscale-tag">2×</span>}
    {mode === 'video' && <button className="play-overlay"><Play size={24} fill="currentColor" /></button>}
  </div>
}
