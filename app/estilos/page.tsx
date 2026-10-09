"use client";

/* ============================================================
   ESTILOS — bloco 06 (`miora/sections/06-skills`)

   Réplica da tela de Skills: cabeçalho com título, busca, três chips e três
   botões; e as duas seções de cartões — **Meus estilos** (o `Installed`, com
   toggle) e **Sugeridos** (o `Not installed`, com `+` e contador).

   Nenhuma afordância da referência foi cortada. As que lá dependem de
   marketplace ganharam o sentido local que o mapa manda:
   `currentVersion` → versão local que sobe a cada edição, `isModified` → o selo
   "editado", `downloads` → quantas vezes o fragmento foi aplicado no composer.

   O carregamento com `est-pulse` — a única `@keyframes` do bloco — cobre a
   hidratação do store persistido, que é o nosso tempo de espera real.
   ============================================================ */

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useEstilosStore, suggestionCountKey, type Estilo } from "@/lib/estilosStore";
import { useWorkflowStore } from "@/lib/store";
import { applyFragmentToComposer, type RemixTab } from "@/lib/remixHandoff";
import { EstiloCard } from "@/components/estilos/EstiloCard";
import { EstiloEditor } from "@/components/estilos/EstiloEditor";
import { EstilosHeader, type EstilosFiltro } from "@/components/estilos/EstilosHeader";
import { SugestaoCard } from "@/components/estilos/SugestaoCard";
import { SUGESTOES, type Sugestao } from "@/components/estilos/sugestoes";
import "@/components/estilos/estilos.css";

/** Estado aberto do editor: `null` fechado, ou o estilo em edição / o rascunho. */
type EditorState = null | { estilo: Estilo | null; draft?: { name: string; fragment: string } };

/* O prompt que a referência manda ao agente é literal (`Help me create a new
   Skill`). O nosso é o equivalente em português, e já pede a forma que o nosso
   editor espera: nome curto + fragmento. */
const PROMPT_CRIAR =
  "Me ajude a criar um novo estilo: um nome curto e um fragmento de prompt que eu possa anexar ao fim de todo prompt para manter a mesma direção de arte.";

/* `useSearchParams` obriga a um limite de Suspense para a rota não estourar na
   pré-renderização. O conteúdo inteiro vive dentro dele. */
export default function EstilosPage() {
  return (
    <React.Suspense fallback={null}>
      <EstilosConteudo />
    </React.Suspense>
  );
}

function EstilosConteudo() {
  const router = useRouter();
  const searchParams = useSearchParams();
  /* Mesma convenção do `AppSidebar`: o modo vem da URL e cai em imagens quando
     não vier. É esse modo que o Aplicar usa para escolher qual composer recebe
     o fragmento. */
  const tab: RemixTab = searchParams.get("tab") === "videos" ? "videos" : "images";

  const estilos = useEstilosStore(state => state.estilos);
  const appliedCounts = useEstilosStore(state => state.appliedCounts);
  const createEstilo = useEstilosStore(state => state.createEstilo);
  const updateEstilo = useEstilosStore(state => state.updateEstilo);
  const removeEstilo = useEstilosStore(state => state.removeEstilo);
  const duplicateEstilo = useEstilosStore(state => state.duplicateEstilo);
  const addFromSuggestion = useEstilosStore(state => state.addFromSuggestion);
  const setEnabled = useEstilosStore(state => state.setEnabled);
  const markApplied = useEstilosStore(state => state.markApplied);
  const addToast = useWorkflowStore(state => state.addToast);

  const [filtro, setFiltro] = React.useState<EstilosFiltro>("tudo");
  const [query, setQuery] = React.useState("");
  const [editor, setEditor] = React.useState<EditorState>(null);

  /* O store é persistido: no servidor nasce vazio e no cliente vem cheio.
     Enquanto a hidratação não termina, a tela mostra o esqueleto — o mesmo
     estado de carregamento que a referência desenha com `skills-v2-pulse`. */
  const hidratado = React.useSyncExternalStore(
    React.useCallback((notify: () => void) => useEstilosStore.persist.onFinishHydration(notify), []),
    () => useEstilosStore.persist.hasHydrated(),
    () => false,
  );

  const needle = query.trim().toLowerCase();
  const combina = React.useCallback(
    (name: string, fragment: string) =>
      !needle || name.toLowerCase().includes(needle) || fragment.toLowerCase().includes(needle),
    [needle],
  );

  /* Os três chips são o mesmo eixo do `skillType` da referência: tudo, o que o
     usuário escreveu, e o que veio de um ponto de partida nosso. */
  const meus = React.useMemo(() => {
    const porOrigem = estilos.filter(estilo => {
      if (filtro === "proprios") return estilo.origin === "propria";
      if (filtro === "adicionados") return estilo.origin === "sugestao";
      return true;
    });
    return porOrigem.filter(estilo => combina(estilo.name, estilo.fragment));
  }, [estilos, filtro, combina]);

  /* Um ponto de partida já adicionado sai da grade de sugeridos — é assim que a
     referência tira da seção `Not installed` o que passou para `Installed`. */
  const adicionados = React.useMemo(
    () => new Set(estilos.map(estilo => estilo.suggestionId).filter(Boolean) as string[]),
    [estilos],
  );

  const sugestoes = React.useMemo(
    () => SUGESTOES.filter(s => !adicionados.has(s.id) && combina(s.name, s.fragment)),
    [adicionados, combina],
  );

  const handleApply = React.useCallback((estilo: Estilo) => {
    const href = applyFragmentToComposer(estilo.fragment, tab);
    if (!href) {
      addToast("Não foi possível aplicar o estilo.", "error");
      return;
    }
    markApplied(estilo.id);
    router.push(href);
  }, [tab, markApplied, router, addToast]);

  const handleToggle = React.useCallback((estilo: Estilo, next: boolean) => {
    setEnabled(estilo.id, next);
    addToast(next ? "Estilo ligado" : "Estilo desligado", "info");
  }, [setEnabled, addToast]);

  /* Exportar é local e não pede backend: o estilo é texto, e o navegador salva
     texto. `.md` no lugar do `.zip` da referência pelo mesmo motivo. */
  const handleExport = React.useCallback((estilo: Estilo) => {
    const corpo = `# ${estilo.name}\n\n${estilo.fragment}\n`;
    const url = URL.createObjectURL(new Blob([corpo], { type: "text/markdown;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `${estilo.name}.md`;
    link.click();
    URL.revokeObjectURL(url);
    addToast(`Exportado ${estilo.name}.md`, "success");
  }, [addToast]);

  const handleRemove = React.useCallback((estilo: Estilo) => {
    removeEstilo(estilo.id);
    addToast("Estilo excluído", "info");
  }, [removeEstilo, addToast]);

  const handleAddSuggestion = React.useCallback((sugestao: Sugestao) => {
    addFromSuggestion(sugestao.id, sugestao.name, sugestao.fragment, sugestao.version);
    addToast("Estilo adicionado aos seus estilos", "success");
  }, [addFromSuggestion, addToast]);

  const handleSave = React.useCallback((values: { name: string; fragment: string }) => {
    if (editor?.estilo) updateEstilo(editor.estilo.id, values);
    else createEstilo(values.name, values.fragment);
    setEditor(null);
  }, [editor, updateEstilo, createEstilo]);

  const mostraSugeridos = filtro === "tudo";

  return (
    <div className="flex-1 overflow-y-auto px-6 py-5">
      <div className="est-page">
        <EstilosHeader
          filtro={filtro}
          onFiltroChange={setFiltro}
          query={query}
          onQueryChange={setQuery}
          onImport={(name, content) => setEditor({ estilo: null, draft: { name, fragment: content } })}
          onCriarConversando={() => router.push(`/chat?q=${encodeURIComponent(PROMPT_CRIAR)}`)}
          onCreate={() => setEditor({ estilo: null })}
        />

        <section className="est-section">
          <div className="est-section__heading">
            <h2>Meus estilos</h2>
          </div>
          {!hidratado ? (
            <div className="est-grid">
              {Array.from({ length: 5 }, (_, i) => (
                <div key={i} className="est-skeleton est-skeleton--card" />
              ))}
            </div>
          ) : meus.length === 0 ? (
            <p className="est-empty">Nenhum estilo</p>
          ) : (
            <div className="est-grid">
              {meus.map(estilo => (
                <EstiloCard
                  key={estilo.id}
                  estilo={estilo}
                  onOpen={target => setEditor({ estilo: target })}
                  onToggle={handleToggle}
                  onApply={handleApply}
                  onEdit={target => setEditor({ estilo: target })}
                  onDuplicate={target => duplicateEstilo(target.id)}
                  onExport={handleExport}
                  onRemove={handleRemove}
                />
              ))}
            </div>
          )}
        </section>

        {mostraSugeridos && (
          <section className="est-section">
            <h2 className="est-section__title">Sugeridos</h2>
            {!hidratado ? (
              <div className="est-grid">
                {Array.from({ length: 3 }, (_, i) => (
                  <div key={i} className="est-skeleton est-skeleton--card" />
                ))}
              </div>
            ) : sugestoes.length === 0 ? (
              <p className="est-empty">Nenhum estilo sugerido disponível</p>
            ) : (
              <div className="est-grid">
                {sugestoes.map(sugestao => (
                  <SugestaoCard
                    key={sugestao.id}
                    sugestao={sugestao}
                    aplicacoes={appliedCounts[suggestionCountKey(sugestao.id)] ?? 0}
                    onOpen={target => setEditor({ estilo: null, draft: { name: target.name, fragment: target.fragment } })}
                    onAdd={handleAddSuggestion}
                  />
                ))}
              </div>
            )}
          </section>
        )}
      </div>

      {editor && (
        <EstiloEditor
          /* O `key` força um editor novo a cada abertura: os campos são estado
             local dele e não devem sobreviver de uma abertura para a outra. */
          key={editor.estilo?.id ?? (editor.draft ? `rascunho-${editor.draft.name}` : "novo")}
          estilo={editor.estilo}
          draft={editor.draft}
          onClose={() => setEditor(null)}
          onSave={handleSave}
        />
      )}
    </div>
  );
}
