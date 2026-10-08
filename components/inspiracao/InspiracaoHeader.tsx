"use client";

/* ============================================================
   CABEÇALHO DA INSPIRAÇÃO

   Chrome do bloco 05: título de 16/24 e busca de 246×32 na mesma linha; abaixo,
   a faixa de chips de 36px à esquerda e, à direita, a ordenação e o botão de
   navegação — os quatro controles que a referência tem, nem mais nem menos.

   Os chips do Miora são as 7 categorias que o agente dele atribui a cada peça.
   O nosso `GalleryItem` não tem campo de categoria; o único eixo semântico que
   existe de verdade é a **pasta** (`folderStore.itemFolderMap`) — que é
   exatamente o que o mapa de afordâncias usa para os chips do bloco 07. Então
   os chips são as pastas do usuário, mais o "Tudo" sintético: como no Miora,
   ele não vem de lista nenhuma e é o único que nasce ativo.

   O botão da direita é o `My Shared` da referência. O ícone é um chevron para
   a direita, ou seja, navegação — e o destino real é o Acervo, onde mora a
   coleção inteira, inclusive os envios que a Inspiração não mostra.
   ============================================================ */

import * as React from "react";
import Link from "next/link";

export type InspiracaoSort = "recent" | "oldest";

export interface InspiracaoCategoria {
  id: string;
  name: string;
}

const SORTS: { value: InspiracaoSort; label: string }[] = [
  { value: "recent", label: "Mais recentes" },
  { value: "oldest", label: "Mais antigas" },
];

/* Ícones — `<path>` literais do sprite `#_CD_ICON_` do `page-inspiration.html`. */

const IconeBusca = () => (
  <svg className="insp-search__icon" viewBox="0 0 16 16" fill="none" aria-hidden>
    <path
      d="M11.2259 11.3L13.5 13.5M12.7667 7.63333C12.7667 10.4684 10.4684 12.7667 7.63333 12.7667C4.79827 12.7667 2.5 10.4684 2.5 7.63333C2.5 4.79827 4.79827 2.5 7.63333 2.5C10.4684 2.5 12.7667 4.79827 12.7667 7.63333Z"
      stroke="currentColor" strokeWidth=".8" strokeLinecap="round"
    />
  </svg>
);

const IconeSeta = ({ aberto }: { aberto: boolean }) => (
  <svg className={`insp-filter-bar__sort-icon${aberto ? " is-open" : ""}`} viewBox="0 0 16 16" fill="none" aria-hidden>
    <path
      fillRule="evenodd" clipRule="evenodd"
      d="M4.99418 7.03039C4.79892 6.83512 4.79892 6.51854 4.99418 6.32328C5.18944 6.12802 5.50602 6.12802 5.70129 6.32328L7.99418 8.61617L10.2871 6.32328C10.4823 6.12802 10.7989 6.12802 10.9942 6.32328C11.1894 6.51854 11.1894 6.83512 10.9942 7.03039L8.46558 9.55898C8.20523 9.81933 7.78312 9.81933 7.52277 9.55898L4.99418 7.03039Z"
      fill="currentColor" fillOpacity=".9"
    />
  </svg>
);

const IconeChevron = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="m9 18 6-6-6-6" />
  </svg>
);

export function InspiracaoHeader({
  categorias,
  categoria,
  onCategoriaChange,
  sort,
  onSortChange,
  query,
  onQueryChange,
}: {
  categorias: InspiracaoCategoria[];
  categoria: string;
  onCategoriaChange: (id: string) => void;
  sort: InspiracaoSort;
  onSortChange: (sort: InspiracaoSort) => void;
  query: string;
  onQueryChange: (query: string) => void;
}) {
  const [aberto, setAberto] = React.useState(false);
  const sortRef = React.useRef<HTMLDivElement>(null);

  /* O menu da referência não tem véu: fecha no clique fora e no Escape. */
  React.useEffect(() => {
    if (!aberto) return;
    const fora = (event: MouseEvent) => {
      if (!sortRef.current?.contains(event.target as Node)) setAberto(false);
    };
    const tecla = (event: KeyboardEvent) => {
      if (event.key === "Escape") setAberto(false);
    };
    document.addEventListener("mousedown", fora);
    document.addEventListener("keydown", tecla);
    return () => {
      document.removeEventListener("mousedown", fora);
      document.removeEventListener("keydown", tecla);
    };
  }, [aberto]);

  const atual = SORTS.find(entry => entry.value === sort) ?? SORTS[0];

  return (
    <>
      {/* ── Título e busca, na mesma linha ── */}
      <header className="insp-header">
        <h1 className="insp-title">Inspiração</h1>
        <label className="insp-search">
          <IconeBusca />
          <input
            type="search"
            value={query}
            onChange={event => onQueryChange(event.target.value)}
            placeholder="Buscar por palavras-chave"
            aria-label="Buscar na Inspiração"
          />
        </label>
      </header>

      {/* ── Barra de filtros ── */}
      <div className="insp-filter-bar">
        <div className="insp-filter-bar__tabs" role="tablist" aria-label="Categorias">
          {categorias.map(entry => {
            const ativo = categoria === entry.id;
            return (
              <button
                key={entry.id}
                type="button"
                role="tab"
                aria-selected={ativo}
                className={`insp-filter-bar__tab${ativo ? " is-active" : ""}`}
                onClick={() => onCategoriaChange(entry.id)}
              >
                <span>{entry.name}</span>
              </button>
            );
          })}
        </div>

        <div className="insp-filter-bar__actions">
          <div className="insp-sort" ref={sortRef}>
            <button
              type="button"
              className="insp-filter-bar__sort"
              aria-haspopup="menu"
              aria-expanded={aberto}
              onClick={() => setAberto(valor => !valor)}
            >
              {atual.label}
              <IconeSeta aberto={aberto} />
            </button>
            {aberto && (
              <div className="insp-filter-bar__sort-menu" role="menu">
                {SORTS.map(entry => (
                  <button
                    key={entry.value}
                    type="button"
                    role="menuitem"
                    className="insp-filter-bar__sort-item"
                    onClick={() => { onSortChange(entry.value); setAberto(false); }}
                  >
                    {entry.label}
                  </button>
                ))}
              </div>
            )}
          </div>

          <Link href="/gallery" className="insp-filter-bar__action">
            <span>Meu acervo</span>
            <IconeChevron />
          </Link>
        </div>
      </div>
    </>
  );
}
