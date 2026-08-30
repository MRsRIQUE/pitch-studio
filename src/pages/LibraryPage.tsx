import { Download, Filter, Image, Play, Search, Video } from 'lucide-react'
import type { Asset } from '../types/studio'

export function LibraryPage({ assets }: { assets: Asset[] }) {
  return <section className="product-page">
    <header className="page-header"><div><span className="page-eyebrow">ASSETS</span><h1>Biblioteca</h1><p>Tudo que você criou, organizado em um só lugar.</p></div></header>
    <div className="page-tools"><div className="page-search"><Search size={16} /><input placeholder="Buscar na biblioteca" /></div><button><Filter size={14} /> Filtros</button></div>
    <div className="asset-grid">{assets.map((asset) => <article className="asset-card" key={asset.id}>
      <div className={`asset-cover ${asset.art}`}><span className="generated-art" />{asset.kind === 'video' && <span className="asset-play"><Play size={17} fill="currentColor" /></span>}<button className="asset-download"><Download size={15} /></button></div>
      <div className="asset-meta"><span className="asset-type">{asset.kind === 'video' ? <Video size={12} /> : <Image size={12} />}</span><span><strong>{asset.name}</strong><small>{asset.createdAt}</small></span></div>
    </article>)}</div>
  </section>
}
