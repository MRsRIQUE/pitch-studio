"use client";

/* ============================================================
   CABEÇALHO DO ACERVO — réplica do bloco 07 (`/assets`)

   Estrutura, geometria e timings vêm de `miora/sections/07-assets`
   (`INFO.md` + o `<style>` do `preview.html`); as classes moram em
   `app/gallery/acervo.css`, com o valor literal ao lado de cada regra.

   O que muda em relação à referência, e só isto:

   • COR — onde o site pinta o chip ativo de laranja, entra
     `--ms-solid-brand`, que já é o violeta `#4318FF`.
   • IDIOMA — rótulos em português.
   • CONTEÚDO — os 7 chips de categoria semântica do Miora
     (`Character · Scene · Item · Brand · Timbre · Others`) são as
     NOSSAS pastas (`lib/folderStore.ts`) mais **Tudo**, como manda o
     `MAPA-AFORDANCIAS.md`. As pastas não vêm por prop: o
     `folderStore` é um store global e o `page.tsx` já filtra por
     `selectedFolderId`, então o chip fala direto com ele.
   • GESTÃO DE PASTA — a única adição autorizada fora da referência,
     e o motivo está em `.migracao/relatos/ladrilho.md`: as categorias
     do Miora são tipos do sistema, ninguém as cria; as nossas pastas
     são do usuário, e a árvore saiu da barra lateral. Sem o chip `+` e
     sem o menu de contexto, `createFolder`, `updateFolder` e
     `deleteFolder` não teriam mais quem os chamasse. O comportamento é
     o da barra antiga (`.migracao/AppSidebar-v1.tsx.bak`); o visual é
     o do bloco 07.

   Os quatro filtros em pílula são os quatro eixos do mapa —
   tipo · modelo · período · ordenação — sobre `lib/galleryUtils.ts`.
   ============================================================ */

import * as React from "react";
import { ChevronDown, Plus, Search, X } from "@/components/icones";
import { useFolderStore } from "@/lib/folderStore";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import "@/app/gallery/acervo.css";

export type AcervoSort = "recent" | "oldest";
export type AcervoWindow = "all" | "7d" | "30d" | "90d";
export type AcervoSource = "generated" | "uploaded";

type Opcao<T extends string> = { value: T; label: string };

/* O eixo de tipo da referência é um só: um gatilho e um menu com as
   espécies de conteúdo (`All · Image · Video · Audio · UI · 3D ·
   Others`). Aqui temos duas variáveis independentes no `page.tsx` —
   `tab` (imagem/vídeo) e `sourceFilter` (gerado/enviado) — e as quatro
   combinações são estados reais e alcançáveis. Elas cabem nesse mesmo
   eixo único sem inventar uma quinta pílula e sem perder nenhum estado. */
type ChaveTipo = "images:generated" | "videos:generated" | "images:uploaded" | "videos:uploaded";

const TIPOS: Opcao<ChaveTipo>[] = [
  { value: "images:generated", label: "Imagens" },
  { value: "videos:generated", label: "Vídeos" },
  { value: "images:uploaded", label: "Imagens enviadas" },
  { value: "videos:uploaded", label: "Vídeos enviados" },
];

/* `latest` / `filterOldest` do bundle da referência. */
const ORDENS: Opcao<AcervoSort>[] = [
  { value: "recent", label: "Recentes" },
  { value: "oldest", label: "Antigas" },
];

/* `timeAll` / `timeWeek` / `timeMonth` / `timeQuarter`. */
const PERIODOS: Opcao<AcervoWindow>[] = [
  { value: "all", label: "Sempre" },
  { value: "7d", label: "Última semana" },
  { value: "30d", label: "Último mês" },
  { value: "90d", label: "Últimos 3 meses" },
];

/* A mesma paleta que a barra lateral usava, na mesma ordem. */
const CORES_DE_PASTA: { color: string | null; label: string }[] = [
  { color: null, label: "Padrão" },
  { color: "#1B84FF", label: "Azul" },
  { color: "#868CFF", label: "Lilás" },
  { color: "#A855F7", label: "Roxo" },
  { color: "#01B574", label: "Verde" },
  { color: "#FFB547", label: "Âmbar" },
  { color: "#E31A1A", label: "Vermelho" },
];

/** Gatilho + menu de um eixo de filtro. */
function FiltroPilula<T extends string>({
  rotulo,
  value,
  options,
  onChange,
  align = "start",
}: {
  rotulo: string;
  value: T;
  options: Opcao<T>[];
  onChange: (value: T) => void;
  align?: "start" | "end";
}) {
  const atual = options.find(o => o.value === value);

  return (
    <DropdownMenu>
      {/* O gatilho mostra sempre o valor corrente, como na referência
          (`All Projects`, `All`, `Latest`, `All time`); o nome do eixo
          fica no rótulo acessível. */}
      <DropdownMenuTrigger className="acervo-filtro" aria-label={rotulo}>
        <span>{atual?.label ?? rotulo}</span>
        <ChevronDown width={14} height={14} strokeWidth={2.5714285714285716} aria-hidden />
      </DropdownMenuTrigger>
      <DropdownMenuContent className="acervo-menu" align={align} sideOffset={4}>
        <DropdownMenuRadioGroup value={value} onValueChange={v => onChange(v as T)}>
          {options.map(opcao => (
            <DropdownMenuRadioItem
              key={opcao.value}
              value={opcao.value}
              /* O estado marcado é comparado aqui em vez de sair de um
                 `data-*`: o indicador do Base UI é que carrega o estado,
                 não o item, então não há atributo para estilizar. */
              className={opcao.value === value ? "acervo-menu-item--marcado" : undefined}
            >
              <span>{opcao.label}</span>
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/**
 * Chip de uma pasta. Clique esquerdo seleciona; botão direito abre o
 * menu de gestão, que é o único lugar do app onde ainda dá para
 * renomear, colorir e excluir pasta.
 */
function ChipDePasta({
  nome,
  cor,
  ativa,
  onSelecionar,
  onRenomear,
  onTrocarCor,
  onExcluir,
}: {
  nome: string;
  cor: string | null | undefined;
  ativa: boolean;
  onSelecionar: () => void;
  onRenomear: (nome: string) => void;
  onTrocarCor: (cor: string | null) => void;
  onExcluir: () => void;
}) {
  const [menuAberto, setMenuAberto] = React.useState(false);
  const [renomeando, setRenomeando] = React.useState(false);
  const [rascunho, setRascunho] = React.useState(nome);
  const campoRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    if (renomeando) campoRef.current?.select();
  }, [renomeando]);

  function confirmarRenome() {
    const limpo = rascunho.trim();
    if (limpo && limpo !== nome) onRenomear(limpo);
    setRenomeando(false);
  }

  if (renomeando) {
    return (
      <input
        ref={campoRef}
        className="acervo-chip acervo-chip-campo"
        value={rascunho}
        onChange={e => setRascunho(e.target.value)}
        onBlur={confirmarRenome}
        onKeyDown={e => {
          if (e.key === "Enter") confirmarRenome();
          if (e.key === "Escape") { setRascunho(nome); setRenomeando(false); }
        }}
        aria-label={`Renomear a pasta ${nome}`}
      />
    );
  }

  return (
    <DropdownMenu
      open={menuAberto}
      /* O gatilho do Base UI abre no clique esquerdo, e aqui o clique
         esquerdo tem outro dono: ele seleciona a pasta. Então só o
         pedido de FECHAR é aceito; abrir é o `onContextMenu`. */
      onOpenChange={(aberto: boolean) => { if (!aberto) setMenuAberto(false); }}
    >
      <DropdownMenuTrigger
        className="acervo-chip"
        aria-pressed={ativa}
        title="Botão direito: renomear, cor ou excluir"
        onClick={onSelecionar}
        onContextMenu={e => { e.preventDefault(); setMenuAberto(true); }}
      >
        {cor && <span className="acervo-chip-marca" style={{ background: cor }} aria-hidden />}
        {nome}
      </DropdownMenuTrigger>

      {/* `finalFocus={false}`: ao fechar, este menu NÃO devolve o foco ao
          gatilho. O gatilho é o próprio chip, e em "Renomear" ele acabou
          de virar um campo de texto — a devolução roubava o foco no mesmo
          quadro em que o campo nascia, o `onBlur` confirmava sozinho e
          renomear simplesmente não abria. */}
      <DropdownMenuContent className="acervo-menu" align="start" sideOffset={4} finalFocus={false}>
        <DropdownMenuItem
          className="acervo-menu-acao"
          onClick={() => { setRascunho(nome); setRenomeando(true); }}
        >
          Renomear
        </DropdownMenuItem>

        {/* As sete cores da barra antiga, na mesma ordem. A "Padrão" é a
            ausência de cor, e leva o risco diagonal para não se
            confundir com um cinza escolhido. */}
        <div className="acervo-cores" role="group" aria-label="Cor da pasta">
          {CORES_DE_PASTA.map(({ color, label }) => {
            const escolhida = color === null ? !cor : cor === color;
            return (
              <button
                key={label}
                type="button"
                title={label}
                aria-label={label}
                aria-pressed={escolhida}
                className="acervo-cor"
                style={{ background: color ?? "var(--ms-bg-component-active)" }}
                onClick={() => { setMenuAberto(false); onTrocarCor(color); }}
              >
                {color === null && (
                  <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden>
                    <line x1="2" y1="8" x2="8" y2="2" stroke="var(--ms-icon-tertiary)" strokeWidth="1.5" strokeLinecap="round" />
                  </svg>
                )}
              </button>
            );
          })}
        </div>

        <div className="acervo-menu-risco" />

        <DropdownMenuItem className="acervo-menu-acao acervo-menu-acao--perigo" onClick={onExcluir}>
          Excluir
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function AcervoHeader({
  title,
  tab,
  onTabChange,
  source,
  onSourceChange,
  models,
  model,
  onModelChange,
  sort,
  onSortChange,
  timeWindow,
  onTimeWindowChange,
  query,
  onQueryChange,
}: {
  title: React.ReactNode;
  /** Aceito para não quebrar a chamada do `page.tsx`. A linha de título
      da referência tem só o título — não há contador. */
  count?: number;
  tab: "images" | "videos";
  onTabChange: (tab: "images" | "videos") => void;
  source: AcervoSource;
  onSourceChange: (source: AcervoSource) => void;
  models: string[];
  model: string;
  onModelChange: (model: string) => void;
  sort: AcervoSort;
  onSortChange: (sort: AcervoSort) => void;
  timeWindow: AcervoWindow;
  onTimeWindowChange: (value: AcervoWindow) => void;
  query: string;
  onQueryChange: (query: string) => void;
  /** Idem: o zoom da grade é herança do HeliosGen e não existe no bloco
      07. Ver o relatório — o controle saiu da tela e o Maestro decide
      se volta, e onde. */
  zoom?: number;
  onZoomChange?: (zoom: number) => void;
}) {
  const folders = useFolderStore(s => s.folders);
  const selectedFolderId = useFolderStore(s => s.selectedFolderId);
  const selectFolder = useFolderStore(s => s.selectFolder);
  const createFolder = useFolderStore(s => s.createFolder);
  const updateFolder = useFolderStore(s => s.updateFolder);
  const deleteFolder = useFolderStore(s => s.deleteFolder);

  const [criando, setCriando] = React.useState(false);
  const [nomeNovo, setNomeNovo] = React.useState("");
  const campoNovoRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    if (criando) campoNovoRef.current?.focus();
  }, [criando]);

  /* A fileira de chips é plana, como na referência. As pastas são uma
     árvore, então a percorro em profundidade a partir das raízes: assim
     nenhuma subpasta fica sem chip e a ordem de leitura é a mesma da
     barra antiga. O varredor final recolhe pasta órfã — filha de uma
     pasta já excluída —, que de outro modo sumiria da tela sem sumir do
     banco. */
  const pastasEmOrdem = React.useMemo(() => {
    const porPai = new Map<string | null, typeof folders>();
    for (const f of folders) {
      const irmas = porPai.get(f.parentId) ?? [];
      irmas.push(f);
      porPai.set(f.parentId, irmas);
    }
    for (const irmas of porPai.values()) irmas.sort((a, b) => a.orderIndex - b.orderIndex);

    const saida: typeof folders = [];
    const vistas = new Set<string>();
    const visitar = (paiId: string | null) => {
      for (const f of porPai.get(paiId) ?? []) {
        if (vistas.has(f.id)) continue;
        vistas.add(f.id);
        saida.push(f);
        visitar(f.id);
      }
    };
    visitar(null);
    for (const f of folders) if (!vistas.has(f.id)) saida.push(f);
    return saida;
  }, [folders]);

  const modelos = React.useMemo(
    () => [{ value: "all", label: "Todos os modelos" }, ...models.map(m => ({ value: m, label: m }))],
    [models],
  );

  const tipoAtual = `${tab}:${source}` as ChaveTipo;

  /* Mesma regra da barra antiga: com uma pasta aberta, a nova nasce
     dentro dela. É o único caminho para subpasta agora que a árvore
     saiu da navegação, e o rótulo acessível do campo diz isso. */
  const paiDaNova = selectedFolderId
    ? folders.find(f => f.id === selectedFolderId)?.name ?? null
    : null;

  function confirmarCriacao() {
    const limpo = nomeNovo.trim();
    if (limpo) void createFolder(limpo, selectedFolderId ?? null);
    setCriando(false);
    setNomeNovo("");
  }

  return (
    <header className="acervo-cabecalho">
      <div className="acervo-coluna">
        <div className="acervo-titulo-linha">
          <h1 className="acervo-titulo">{title}</h1>
        </div>

        <div className="acervo-controles">
          <div className="acervo-chips">
            <button
              type="button"
              className="acervo-chip"
              aria-pressed={selectedFolderId === null}
              onClick={() => selectFolder(null)}
            >
              Tudo
            </button>

            {pastasEmOrdem.map(pasta => (
              <ChipDePasta
                key={pasta.id}
                nome={pasta.name}
                cor={pasta.color}
                ativa={selectedFolderId === pasta.id}
                onSelecionar={() => selectFolder(pasta.id)}
                onRenomear={nome => void updateFolder(pasta.id, { name: nome })}
                onTrocarCor={cor => void updateFolder(pasta.id, { color: cor })}
                onExcluir={() => void deleteFolder(pasta.id)}
              />
            ))}

            {criando ? (
              <input
                ref={campoNovoRef}
                className="acervo-chip acervo-chip-campo"
                value={nomeNovo}
                placeholder="Nome da pasta"
                onChange={e => setNomeNovo(e.target.value)}
                onBlur={confirmarCriacao}
                onKeyDown={e => {
                  if (e.key === "Enter") confirmarCriacao();
                  if (e.key === "Escape") { setCriando(false); setNomeNovo(""); }
                }}
                aria-label={paiDaNova ? `Nome da nova pasta dentro de ${paiDaNova}` : "Nome da nova pasta"}
              />
            ) : (
              <button
                type="button"
                className="acervo-chip acervo-chip-novo"
                onClick={() => setCriando(true)}
                aria-label={paiDaNova ? `Nova pasta dentro de ${paiDaNova}` : "Nova pasta"}
                title={paiDaNova ? `Nova pasta dentro de ${paiDaNova}` : "Nova pasta"}
              >
                <Plus width={14} height={14} strokeWidth={2} aria-hidden />
              </button>
            )}
          </div>

          <div className="acervo-filtros">
            <FiltroPilula
              rotulo="Tipo"
              value={tipoAtual}
              options={TIPOS}
              onChange={chave => {
                const [proximaAba, proximaOrigem] = chave.split(":") as ["images" | "videos", AcervoSource];
                /* A origem vai primeiro de propósito. Os dois callbacks
                   do `page.tsx` reescrevem a URL a partir do mesmo
                   `searchParams`, e quem chama por último vence; a aba
                   só existe na URL, enquanto a origem também vive em
                   estado. Invertendo a ordem, a troca de aba se perdia. */
                if (proximaOrigem !== source) onSourceChange(proximaOrigem);
                if (proximaAba !== tab) onTabChange(proximaAba);
              }}
            />
            <FiltroPilula rotulo="Modelo" value={model} options={modelos} onChange={onModelChange} />
            <FiltroPilula rotulo="Período" value={timeWindow} options={PERIODOS} onChange={onTimeWindowChange} />
            <FiltroPilula rotulo="Ordenação" value={sort} options={ORDENS} onChange={onSortChange} align="end" />

            <div className="acervo-busca">
              <Search
                className="acervo-busca-lupa"
                width={16}
                height={16}
                strokeWidth={1.95}
                aria-hidden
              />
              <input
                value={query}
                onChange={e => onQueryChange(e.target.value)}
                placeholder="Buscar"
                aria-label="Buscar no acervo"
              />
              {query && (
                <button
                  type="button"
                  className="acervo-busca-limpar"
                  onClick={() => onQueryChange("")}
                  aria-label="Limpar busca"
                >
                  <X width={14} height={14} strokeWidth={2.2} aria-hidden />
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
