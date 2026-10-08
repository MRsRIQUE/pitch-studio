"use client";

/* ============================================================
   AS ABAS DE CATEGORIA — a faixa do hero, acima do composer

   Geometria literal do bloco 03: faixa de 692×32, `padding:4`,
   `gap:4`, raio 16; aba de 24 de altura com raio 18, 12px de fonte e
   peso 400; indicador de 24 de altura em `--ms-solid`, com
   `box-shadow: --ms-shadow-sm` e raio cheio.

   As larguras-base são as da referência, por posição: 88px na 1ª, 2ª e
   4ª, 100px na 3ª e 5ª. Com `flex:1 0 auto` os cinco dividem a sobra e
   caem em 128,8 e 140,8 — os "~129/141" do RECON.

   Clicar na aba ativa DESLIGA a categoria e volta às frases genéricas
   (`onClick: () => r(b ? null : v.key)` no bundle da referência).

   O indicador da referência é um `layoutId` do Framer Motion. Aqui ele
   é um elemento só, posicionado por `left`/`width` — a mesma saída que
   o `preview.html` adota, com o mesmo `cubic-bezier(.33,1,.68,1)` de
   300ms.
   ============================================================ */

import * as React from "react";
import {
  CATEGORIAS,
  definirCategoria,
  type CategoriaId,
} from "@/lib/categoriaComposer";
import "@/app/gallery/composer.css";

/* Ícones de 24 no `viewBox`, desenhados em 16 — os `<path>` literais do
   `page-home.html`, menos os dois que mudaram de assunto junto com o
   rótulo: "Social" não é o joystick de `Gaming`, e desenhar um seria
   dizer que a aba é sobre jogos. */
const ICONES: Record<CategoriaId, React.ReactNode> = {
  marca: (
    <>
      <path d="M12 22a1 1 0 0 1 0-20 10 9 0 0 1 10 9 5 5 0 0 1-5 5h-2.25a1.75 1.75 0 0 0-1.4 2.8l.3.4a1.75 1.75 0 0 1-1.4 2.8z" />
      <circle cx="13.5" cy="6.5" r=".5" fill="currentColor" />
      <circle cx="17.5" cy="10.5" r=".5" fill="currentColor" />
      <circle cx="6.5" cy="12.5" r=".5" fill="currentColor" />
      <circle cx="8.5" cy="7.5" r=".5" fill="currentColor" />
    </>
  ),
  video: (
    <>
      <rect width="18" height="18" x="3" y="3" rx="2" />
      <path d="M7 3v18" /><path d="M3 7.5h4" /><path d="M3 12h18" />
      <path d="M3 16.5h4" /><path d="M17 3v18" /><path d="M17 7.5h4" /><path d="M17 16.5h4" />
    </>
  ),
  produto: (
    <>
      <path d="M16 10a4 4 0 0 1-8 0" />
      <path d="M3.103 6.034h17.794" />
      <path d="M3.4 5.467a2 2 0 0 0-.4 1.2V20a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6.667a2 2 0 0 0-.4-1.2l-2-2.667A2 2 0 0 0 17 2H7a2 2 0 0 0-1.6.8z" />
    </>
  ),
  social: (
    <>
      <path d="M7.9 20A9 9 0 1 0 4 16.1L2 22z" />
      <path d="M8 12h.01" /><path d="M12 12h.01" /><path d="M16 12h.01" />
    </>
  ),
  web: (
    <>
      <path d="M18 8V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h8" />
      <path d="M10 19v-3.96 3.15" />
      <path d="M7 19h5" />
      <rect width="6" height="10" x="16" y="12" rx="2" />
    </>
  ),
};

/* As larguras-base da referência, na ordem das cinco posições. */
const LARGURA_BASE: Record<CategoriaId, number> = {
  marca: 88, video: 88, produto: 100, social: 88, web: 100,
};

export function CategoriaAbas({
  valor,
  onChange,
}: {
  valor: CategoriaId | null;
  onChange: (v: CategoriaId | null) => void;
}) {
  const listaRef = React.useRef<HTMLDivElement>(null);
  const [caixa, setCaixa] = React.useState<{ left: number; width: number } | null>(null);

  /* O indicador é medido, não calculado: as abas crescem com `flex`, e
     supor a largura daria erro justamente na troca de categoria.

     Quem mede é o `ResizeObserver`, inclusive na primeira vez — ele
     dispara sozinho ao observar, antes da pintura. O efeito não escreve
     estado no próprio corpo, e por isso não provoca render em cascata. */
  React.useLayoutEffect(() => {
    const lista = listaRef.current;
    if (!lista || !valor) return;
    const medir = () => {
      const alvo = lista.querySelector<HTMLElement>(`[data-categoria="${valor}"]`);
      if (alvo) setCaixa({ left: alvo.offsetLeft, width: alvo.offsetWidth });
    };
    const ro = new ResizeObserver(medir);
    ro.observe(lista);
    return () => ro.disconnect();
  }, [valor]);

  const escolher = (id: CategoriaId) => {
    /* Clicar na aba ativa desliga a categoria — literal da referência. */
    const proxima = valor === id ? null : id;
    onChange(proxima);
    definirCategoria(proxima);
  };

  return (
    <div
      ref={listaRef}
      className="pcx-abas"
      role="tablist"
      aria-label="Categoria da criação"
      data-ativa={valor ? "1" : "0"}
    >
      <div className="pcx-abas-textura" aria-hidden="true" />
      <span
        className="pcx-abas-indicador"
        aria-hidden="true"
        style={valor && caixa ? { left: caixa.left, width: caixa.width } : undefined}
      />

      {CATEGORIAS.map((c) => (
        <button
          key={c.id}
          type="button"
          role="tab"
          data-categoria={c.id}
          aria-selected={valor === c.id}
          className="pcx-aba"
          style={{ width: LARGURA_BASE[c.id] }}
          onClick={() => escolher(c.id)}
        >
          <svg
            className="pcx-aba-icone"
            width="24" height="24" viewBox="0 0 24 24"
            fill="none" stroke="currentColor" strokeWidth="1.5"
            strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"
          >
            {ICONES[c.id]}
          </svg>
          <span className="pcx-aba-rotulo">{c.rotulo}</span>
        </button>
      ))}
    </div>
  );
}
