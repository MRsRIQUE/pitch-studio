import { Check, Plus, Type } from 'lucide-react'
import type { CSSProperties } from 'react'
import type { BrandKit } from '../types/studio'

type Props = { brand: BrandKit; onChange: (brand: BrandKit) => void }

export function BrandKitPage({ brand, onChange }: Props) {
  return <section className="product-page brand-page">
    <header className="page-header"><div><span className="page-eyebrow">IDENTIDADE</span><h1>Brand kit</h1><p>Mantenha cada criação consistente com a sua marca.</p></div><button className="page-primary"><Check size={16} /> Salvo</button></header>
    <div className="brand-layout">
      <div className="brand-settings">
        <section className="setting-card"><div className="setting-heading"><div><span>Marca ativa</span><strong>{brand.name}</strong></div><div className="brand-logo">P</div></div></section>
        <section className="setting-card"><div className="setting-title"><div><strong>Cores</strong><small>Paleta aplicada às sugestões da IA</small></div><button><Plus size={15} /></button></div><div className="color-list">{brand.colors.map((color, index) => <label key={color}><input type="color" value={color} onChange={(event) => onChange({ ...brand, colors: brand.colors.map((item, itemIndex) => itemIndex === index ? event.target.value : item) })} /><span style={{ background: color }} /><code>{color}</code></label>)}</div></section>
        <section className="setting-card"><div className="setting-title"><div><strong>Tipografia</strong><small>Fontes dos seus templates</small></div><Type size={16} /></div><div className="font-row"><span><small>Títulos</small><strong style={{ fontFamily: brand.headingFont }}>{brand.headingFont}</strong></span><span><small>Textos</small><strong style={{ fontFamily: brand.bodyFont }}>{brand.bodyFont}</strong></span></div></section>
        <section className="setting-card"><div className="setting-title"><div><strong>Voz da marca</strong><small>Contexto usado para refinar prompts</small></div></div><textarea value={brand.voice} onChange={(event) => onChange({ ...brand, voice: event.target.value })} /></section>
      </div>
      <aside className="brand-preview"><span>PREVIEW</span><div className="preview-poster" style={{ '--brand-a': brand.colors[0], '--brand-b': brand.colors[1] } as CSSProperties}><div className="preview-orb" /><small>CREATE THE</small><strong style={{ fontFamily: brand.headingFont }}>UNEXPECTED</strong><p style={{ fontFamily: brand.bodyFont }}>Ideas that move brands forward.</p></div><p>As cores, fontes e voz serão sugeridas automaticamente em novas criações.</p></aside>
    </div>
  </section>
}
