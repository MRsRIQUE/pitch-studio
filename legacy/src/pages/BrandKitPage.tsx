import { Check, Plus, Trash2, Type } from 'lucide-react'
import { useState, type CSSProperties } from 'react'
import { Dropdown, DropdownItem, DropdownLabel } from '../components/Dropdown'
import type { BrandKit } from '../types/studio'

type Props = { brand: BrandKit; onChange: (brand: BrandKit) => void }

const fonts = ['Space Grotesk', 'Inter', 'Manrope', 'DM Sans', 'Georgia', 'Courier New']

export function BrandKitPage({ brand, onChange }: Props) {
  const [justSaved, setJustSaved] = useState(false)

  function patch(next: Partial<BrandKit>) {
    onChange({ ...brand, ...next })
  }

  function save() {
    setJustSaved(true)
    window.setTimeout(() => setJustSaved(false), 1600)
  }

  return <section className="product-page brand-page">
    <header className="page-header">
      <div>
        <span className="page-eyebrow">Identidade</span>
        <h1>Brand kit</h1>
        <p>Mantenha cada criação consistente com a sua marca.</p>
      </div>
      <button className="page-primary" onClick={save}><Check size={16} /> {justSaved ? 'Salvo!' : 'Salvar'}</button>
    </header>

    <div className="brand-layout">
      <div className="brand-settings">
        <section className="setting-card">
          <div className="setting-heading">
            <div>
              <span>Marca ativa</span>
              <input className="brand-name-field" value={brand.name} onChange={(event) => patch({ name: event.target.value })} aria-label="Nome da marca" />
            </div>
            <div className="brand-logo">{brand.name.trim().charAt(0).toUpperCase() || 'P'}</div>
          </div>
        </section>

        <section className="setting-card">
          <div className="setting-title">
            <div><strong>Cores</strong><small>Paleta aplicada às sugestões da IA</small></div>
            <button onClick={() => patch({ colors: [...brand.colors, '#be93ff'] })} title="Adicionar cor"><Plus size={15} /></button>
          </div>
          <div className="color-list">
            {brand.colors.map((color, index) => <div className="color-item" key={`${color}-${index}`}>
              <label>
                <input
                  type="color"
                  value={color}
                  onChange={(event) => patch({ colors: brand.colors.map((item, itemIndex) => itemIndex === index ? event.target.value : item) })}
                />
                <span style={{ background: color }} />
                <code>{color}</code>
              </label>
              {brand.colors.length > 1 && <button
                className="color-remove"
                title="Remover cor"
                onClick={() => patch({ colors: brand.colors.filter((_, itemIndex) => itemIndex !== index) })}
              ><Trash2 size={13} /></button>}
            </div>)}
          </div>
        </section>

        <section className="setting-card">
          <div className="setting-title">
            <div><strong>Tipografia</strong><small>Fontes dos seus templates</small></div>
            <Type size={16} />
          </div>
          <div className="font-row">
            <Dropdown className="font-picker" label={<><small>Títulos</small><strong style={{ fontFamily: brand.headingFont }}>{brand.headingFont}</strong></>}>
              {(close) => <>
                <DropdownLabel>Fonte de título</DropdownLabel>
                {fonts.map((font) => (
                  <DropdownItem key={font} active={brand.headingFont === font} onClick={() => { patch({ headingFont: font }); close() }}>
                    <span style={{ fontFamily: font }}>{font}</span>
                  </DropdownItem>
                ))}
              </>}
            </Dropdown>
            <Dropdown className="font-picker" label={<><small>Textos</small><strong style={{ fontFamily: brand.bodyFont }}>{brand.bodyFont}</strong></>}>
              {(close) => <>
                <DropdownLabel>Fonte de texto</DropdownLabel>
                {fonts.map((font) => (
                  <DropdownItem key={font} active={brand.bodyFont === font} onClick={() => { patch({ bodyFont: font }); close() }}>
                    <span style={{ fontFamily: font }}>{font}</span>
                  </DropdownItem>
                ))}
              </>}
            </Dropdown>
          </div>
        </section>

        <section className="setting-card">
          <div className="setting-title">
            <div><strong>Voz da marca</strong><small>Contexto usado para refinar prompts</small></div>
          </div>
          <textarea value={brand.voice} onChange={(event) => patch({ voice: event.target.value })} />
        </section>
      </div>

      <aside className="brand-preview">
        <span>PREVIEW</span>
        <div className="preview-poster" style={{ '--brand-a': brand.colors[0] ?? '#be93ff', '--brand-b': brand.colors[1] ?? '#ff8a98' } as CSSProperties}>
          <div className="preview-orb" />
          <small>CREATE THE</small>
          <strong style={{ fontFamily: brand.headingFont }}>UNEXPECTED</strong>
          <p style={{ fontFamily: brand.bodyFont }}>Ideas that move brands forward.</p>
        </div>
        <p>As cores, fontes e voz são enviadas junto de cada geração como snapshot imutável.</p>
      </aside>
    </div>
  </section>
}
