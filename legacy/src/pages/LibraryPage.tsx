import { Download, Image, Play, Search, Trash2, Video } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Modal } from '../components/Modal'
import { exportArt } from '../lib/render'
import type { Asset } from '../types/studio'

type Props = { assets: Asset[]; onDelete: (id: string) => void }
type Filter = 'all' | 'image' | 'video'

const filters: Array<{ id: Filter; label: string }> = [
  { id: 'all', label: 'Todos' },
  { id: 'image', label: 'Imagens' },
  { id: 'video', label: 'Vídeos' },
]

export function LibraryPage({ assets, onDelete }: Props) {
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<Filter>('all')
  const [preview, setPreview] = useState<Asset | null>(null)
  const [busy, setBusy] = useState<string | null>(null)

  const visible = useMemo(() => assets.filter((asset) => {
    const matchesFilter = filter === 'all' || asset.kind === filter
    const matchesQuery = asset.name.toLowerCase().includes(query.trim().toLowerCase())
    return matchesFilter && matchesQuery
  }), [assets, query, filter])

  async function download(asset: Asset) {
    setBusy(asset.id)
    try {
      await exportArt(asset.art, asset.name)
    } finally {
      setBusy(null)
    }
  }

  return <section className="product-page">
    <header className="page-header">
      <div>
        <span className="page-eyebrow">Assets</span>
        <h1>Biblioteca</h1>
        <p>Tudo que você criou, organizado em um só lugar.</p>
      </div>
    </header>

    <div className="page-tools">
      <div className="page-search">
        <Search size={16} />
        <input placeholder="Buscar na biblioteca" value={query} onChange={(event) => setQuery(event.target.value)} />
      </div>
      {filters.map((item) => (
        <button key={item.id} className={filter === item.id ? 'active' : ''} onClick={() => setFilter(item.id)}>{item.label}</button>
      ))}
    </div>

    {visible.length === 0 ? (
      <div className="empty-state">
        <strong>Nada por aqui</strong>
        <p>{query ? `Nenhum asset corresponde a "${query}".` : 'Gere sua primeira imagem para preencher a biblioteca.'}</p>
      </div>
    ) : (
      <div className="asset-grid">
        {visible.map((asset) => <article className="asset-card" key={asset.id}>
          <div className={`asset-cover ${asset.art}`} onClick={() => setPreview(asset)}>
            <span className="generated-art" />
            {asset.kind === 'video' && <span className="asset-play"><Play size={17} fill="currentColor" /></span>}
            <div className="asset-tools" onClick={(event) => event.stopPropagation()}>
              <button onClick={() => download(asset)} title="Baixar PNG" disabled={busy === asset.id}>
                {busy === asset.id ? <span className="spinner dark" /> : <Download size={15} />}
              </button>
              <button onClick={() => onDelete(asset.id)} title="Excluir"><Trash2 size={15} /></button>
            </div>
          </div>
          <div className="asset-meta">
            <span className="asset-type">{asset.kind === 'video' ? <Video size={12} /> : <Image size={12} />}</span>
            <span><strong>{asset.name}</strong><small>{asset.createdAt}</small></span>
          </div>
        </article>)}
      </div>
    )}

    {preview && <Modal title={preview.name} onClose={() => setPreview(null)} wide>
      <div className="preview-stage">
        <div className={`artboard ${preview.art}`} style={{ width: '100%', aspectRatio: '1 / 1' }}>
          <div className="art-render">
            <div className="art-glow one" /><div className="art-glow two" />
            <div className="art-object"><span className="glass-core" /><span className="glass-ring ring-one" /><span className="glass-ring ring-two" /></div>
          </div>
        </div>
      </div>
      <div className="preview-actions">
        <span>{preview.kind === 'video' ? 'Vídeo' : 'Imagem'} · {preview.createdAt}</span>
        <button className="page-primary" onClick={() => download(preview)} disabled={busy === preview.id}>
          {busy === preview.id ? <span className="spinner" /> : <Download size={16} />} Baixar PNG
        </button>
      </div>
    </Modal>}
  </section>
}
