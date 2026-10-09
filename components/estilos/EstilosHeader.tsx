"use client";

/* ============================================================
   CABEÇALHO DOS ESTILOS

   Chrome do bloco 06: à esquerda, título + busca de 246×32 numa linha e os três
   chips de 36px na seguinte; à direita, os três botões de 32px alinhados pelo
   rodapé. A ordem no DOM é a do site (`__left` antes de `__actions`) — a troca
   com `order` existe só no `preview.html`, e o `component.tsx` da referência
   também mantém a ordem real.

   Os três chips traduzem os da referência sobre a nossa separação real:
   `All` → Tudo, `My Creations` → os estilos que o usuário escreveu
   (`origin === "propria"`), `Installed from Marketplace` → os que vieram de um
   ponto de partida nosso (`origin === "sugestao"`). É o mesmo eixo do
   `skillType` de lá.

   Os três botões: `Upload skill` → Enviar estilo (lê um .md/.txt e abre o
   editor com ele), `Create skill by chat` → Criar estilo conversando (vai para
   o assistente), e o primário preto `#202020`. O da referência publica no
   marketplace; o mapa diz que marketplace e publicação não existem aqui, então
   o botão primário é Novo estilo — a outra porta de criação, que existe e
   funciona. É a única troca de afordância do bloco, e está no relatório.
   ============================================================ */

import * as React from "react";
import { Plus } from "@/components/icones";
import { IconBusca, IconConversa, IconEnviar } from "@/components/estilos/icons";

export type EstilosFiltro = "tudo" | "proprios" | "adicionados";

const FILTROS: { value: EstilosFiltro; label: string }[] = [
  { value: "tudo", label: "Tudo" },
  { value: "proprios", label: "Minhas criações" },
  { value: "adicionados", label: "Adicionados dos sugeridos" },
];

export function EstilosHeader({
  filtro,
  onFiltroChange,
  query,
  onQueryChange,
  onImport,
  onCriarConversando,
  onCreate,
}: {
  filtro: EstilosFiltro;
  onFiltroChange: (filtro: EstilosFiltro) => void;
  query: string;
  onQueryChange: (query: string) => void;
  /** Recebe o conteúdo do arquivo escolhido; a página abre o editor com ele. */
  onImport: (name: string, content: string) => void;
  onCriarConversando: () => void;
  onCreate: () => void;
}) {
  const fileRef = React.useRef<HTMLInputElement>(null);

  return (
    <header className="est-header">
      <div className="est-header__left">
        <div className="est-header__title-row">
          <h1 className="est-header__title">Estilos</h1>

          <label className="est-header__search">
            <span className="est-header__search-icon">
              <IconBusca />
            </span>
            <input
              type="search"
              value={query}
              onChange={event => onQueryChange(event.target.value)}
              placeholder="Buscar estilos"
              aria-label="Buscar estilos"
            />
            {/* Como na referência: só existe quando há texto, e só aparece com o
                foco dentro do campo. */}
            {query && (
              <button
                type="button"
                className="est-header__search-clear"
                onClick={() => onQueryChange("")}
                aria-label="Limpar busca"
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
                  <path d="M18 6 6 18" />
                  <path d="m6 6 12 12" />
                </svg>
              </button>
            )}
          </label>
        </div>

        <div className="est-header__filters" role="tablist" aria-label="Filtrar estilos">
          {FILTROS.map(entry => (
            <button
              key={entry.value}
              type="button"
              role="tab"
              aria-selected={filtro === entry.value}
              onClick={() => onFiltroChange(entry.value)}
              className={"est-header__filter" + (filtro === entry.value ? " is-active" : "")}
            >
              {entry.label}
            </button>
          ))}
        </div>
      </div>

      <div className="est-header__actions">
        {/* O input fica escondido no DOM como na referência (lá o
            `.skills-v2-page__file-input`); o botão é quem abre o seletor.
            A referência aceita .md e .zip — um estilo aqui é texto, então .zip
            não teria o que descompactar. */}
        <input
          ref={fileRef}
          type="file"
          accept=".md,.txt,text/plain,text/markdown"
          hidden
          onChange={async event => {
            const file = event.target.files?.[0];
            event.target.value = "";
            if (!file) return;
            const content = await file.text();
            onImport(file.name.replace(/\.(md|txt)$/i, ""), content);
          }}
        />
        <button type="button" className="est-header__action" onClick={() => fileRef.current?.click()}>
          <IconEnviar />
          <span>Enviar estilo</span>
        </button>
        <button type="button" className="est-header__action" onClick={onCriarConversando}>
          <IconConversa />
          <span>Criar estilo conversando</span>
        </button>
        <button type="button" className="est-header__action est-header__action--primary" onClick={onCreate}>
          <Plus size={14} strokeWidth={1.5} aria-hidden />
          <span>Novo estilo</span>
        </button>
      </div>
    </header>
  );
}
