"use client";

/* ============================================================
   O GRAFO

   Réplica do bloco 08. Cinco nós, quatro arestas, duas animações
   em canvas e nenhum `@keyframes` vindo da referência.

   As posições dos cinco nós e o `d` das quatro arestas são os
   literais do DOM da referência (tabela "Geometria" do `INFO.md`),
   com as 17 casas decimais que o `getBezierPath` dela produziu. O
   viewport nasce na transform que o `fitView` dela deixou:
   origem do grafo no centro da tela, zoom 0.7.
   ============================================================ */

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  Background,
  BackgroundVariant,
  ReactFlow,
  ReactFlowProvider,
  useReactFlow,
  type Edge,
  type Node,
} from "@xyflow/react";
import { Check, ImagePlus, Maximize, Minus, Plus, X } from "@/components/icones";
import { useFolderStore } from "@/lib/folderStore";
import { useCriar, useOrigens, type Lado, type OrigemId } from "./dados";
import { enviarImagem, TIPOS_ACEITOS } from "@/lib/memoriaAnexos";
import { ArestaLiteral, NoAncora, NoNucleo, NoOrigem } from "./nos";
import { RastroArestas, type Acesas } from "./RastroArestas";
import "@xyflow/react/dist/style.css";

/* ── Geometria literal ──────────────────────────────────────
   `transform` do `.react-flow__node`, em coordenadas de grafo. O
   núcleo é 128×128 em (-64,-64), e é por isso que as arestas saem
   de ±65.5: 64 do meio-lado mais os 1,5 que o xyflow soma. */
const NUCLEO: [number, number] = [-64, -64];
const NUCLEO_LADO = 128;
const SATELITE_LADO = 110;

const SLOT: Record<Lado, { pos: [number, number]; d: string }> = {
  top: {
    pos: [-42.7054, -252.15],
    d: "M-0.00001743861606939845,-65.49998256138393 C-0.00001743861606939845,-94.57498676779926 12.294575329609245,-94.57498676779926 12.294575329609245,-123.64999097421457",
  },
  left: {
    pos: [-244.051, -76.7013],
    d: "M-65.49998256138393,0.0000261579241112031 C-98.52535068314731,0.0000261579241112031 -98.52535068314731,-13.701341245636215 -131.5507188049107,-13.701341245636215",
  },
  right: {
    pos: [133.433, -50.7502],
    d: "M65.50003487723215,0.0000261579241112031 C98.21634414574291,0.0000261579241112031 98.21634414574291,12.249775792499463 130.93265341425365,12.249775792499463",
  },
  bottom: {
    pos: [-68.642, 125.335],
    d: "M-0.00001743861606939845,65.49999128069197 C-0.00001743861606939845,94.16729001361645 -13.64201137624596,94.16729001361645 -13.64201137624596,122.83458874654093",
  },
};

/* `Q` e `Me` do chunk: os anéis do layout radial e as colunas do
   layout de árvore. A âncora fica a 380 do centro. */
const ANEL_ANCORA = 380;
const COLUNA = { nucleo: 0, satelite: 360, ancora: 720 };
const VAO_ARVORE = 32;         // Lt
const VAO_ARVORE_NUCLEO = 80;  // ks

/* A caixa da âncora. O chunk estima a largura por contagem de
   caracteres (`len * 22 + 40`), calibrada para CJK: com texto
   latino qualquer rótulo estoura o teto de 400 e todos os cartões
   ficariam do mesmo tamanho. Usamos uma caixa fixa dentro dos
   limites dele (min 120 / max 400) e cortamos no texto. */
const ANCORA = { l: 200, a: 60 };

/* `fitView` da referência assentou aqui: origem do grafo no centro
   do palco de 1920×956 e escala 0.7. */
const ZOOM_INICIAL = 0.7;

const TIPOS_DE_NO = { nucleo: NoNucleo, origem: NoOrigem, ancora: NoAncora };
const TIPOS_DE_ARESTA = { literal: ArestaLiteral };

const CHAVE_MEMORIA = "pitch:memoria-ligada";

type Lado4 = "top" | "right" | "bottom" | "left";
const OPOSTO: Record<Lado4, Lado4> = { top: "bottom", bottom: "top", left: "right", right: "left" };

/** `et` do chunk: o lado dominante entre dois centros. */
function ladoEntre(sx: number, sy: number, tx: number, ty: number): Lado4 {
  const dx = tx - sx;
  const dy = ty - sy;
  return Math.abs(dx) >= Math.abs(dy) ? (dx >= 0 ? "right" : "left") : (dy >= 0 ? "bottom" : "top");
}

function pontoDaBorda(cx: number, cy: number, l: number, a: number, lado: Lado4) {
  if (lado === "left") return { x: cx - l / 2, y: cy };
  if (lado === "right") return { x: cx + l / 2, y: cy };
  if (lado === "top") return { x: cx, y: cy - a / 2 };
  return { x: cx, y: cy + a / 2 };
}

/* `getBezierPath` do xyflow com `curvature .25`, o mesmo `Jn` do
   chunk. Confere com os quatro `d` literais até a 5ª casa. */
function deslocamento(distancia: number, curvatura: number) {
  return distancia >= 0 ? 0.5 * distancia : curvatura * 25 * Math.sqrt(-distancia);
}
function controle(lado: Lado4, x1: number, y1: number, x2: number, y2: number, c: number): [number, number] {
  if (lado === "left") return [x1 - deslocamento(x1 - x2, c), y1];
  if (lado === "right") return [x1 + deslocamento(x2 - x1, c), y1];
  if (lado === "top") return [x1, y1 - deslocamento(y1 - y2, c)];
  return [x1, y1 + deslocamento(y2 - y1, c)];
}
function bezier(sx: number, sy: number, sl: Lado4, tx: number, ty: number, tl: Lado4, c = 0.25) {
  const s = controle(sl, sx, sy, tx, ty, c);
  const t = controle(tl, tx, ty, sx, sy, c);
  return `M${sx},${sy} C${s[0]},${s[1]} ${t[0]},${t[1]} ${tx},${ty}`;
}

function Grafo({ memoriaLigada, arvore }: { memoriaLigada: boolean; arvore: boolean }) {
  const router = useRouter();
  const origens = useOrigens();
  const criar = useCriar();
  const selecionarPasta = useFolderStore(s => s.selectFolder);
  const { zoomIn, zoomOut, setViewport, setNodes, setEdges, getViewport } = useReactFlow();
  const painelRef = React.useRef<HTMLDivElement>(null);

  const [ativo, setAtivo] = React.useState<string | null>(null);        // hover
  const [selecionado, setSelecionado] = React.useState<string | null>(null);
  const [formOrigem, setFormOrigem] = React.useState<OrigemId | null>(null);
  const [formTexto, setFormTexto] = React.useState("");
  const [formCaixa, setFormCaixa] = React.useState<{ x: number; y: number } | null>(null);
  /* URLs já devolvidas por `/api/upload`. O envio acontece na hora
     de escolher o arquivo, não no salvar: assim o erro aparece
     enquanto o cartão ainda está aberto e dá para tentar de novo. */
  const [formImagens, setFormImagens] = React.useState<string[]>([]);
  const [formEnviando, setFormEnviando] = React.useState(false);
  const [formErro, setFormErro] = React.useState<string | null>(null);
  const arquivoRef = React.useRef<HTMLInputElement>(null);
  /* O cartão é posicionado por evento, então o laço precisa da última
     lista de nós e da origem aberta sem passar por render. */
  const nodesRef = React.useRef<Node[]>([]);
  const formOrigemRef = React.useRef<OrigemId | null>(null);

  /* Navegar é o ponto da tela. A pasta precisa também entrar na
     store: o Acervo lê a seleção de lá, e só o parâmetro na URL
     deixaria a barra lateral apontando para outra pasta. */
  const abrir = React.useCallback((destino: string, idPasta?: string) => {
    if (idPasta !== undefined) selecionarPasta(idPasta);
    router.push(destino);
  }, [router, selecionarPasta]);

  /* ── Cartão de criação ───────────────────────────────────
     Mesma âncora do floating-ui da referência: `placement:"bottom"`,
     `offset 8`, centrado sob o nó. A caixa vem do MODELO (posição de
     grafo × transform do viewport), não de `getBoundingClientRect` do
     nó: o `.react-flow__node` carrega `content-visibility:auto` e
     devolve rect zerado logo depois de um re-render.

     Calculado em manipulador de evento, nunca em efeito: reposicionar
     por efeito encadearia um render a cada quadro de zoom. */
  const posicionarForm = React.useCallback((id: OrigemId) => {
    const painel = painelRef.current;
    const no = nodesRef.current.find(n => n.id === id);
    if (!painel || !no) return;
    const caixa = painel.getBoundingClientRect();
    const vp = getViewport();
    const cx = caixa.left + vp.x + (no.position.x + SATELITE_LADO / 2) * vp.zoom;
    const base = caixa.top + vp.y + (no.position.y + SATELITE_LADO) * vp.zoom;
    // A caixa de referência é o wrapper inteiro, que mantém o `mt-1`
    // do "+ Adicionar" mesmo colapsado — daí os 4px extras.
    setFormCaixa({ x: Math.round(cx - 140), y: Math.round(base + 4 * vp.zoom + 8) });
  }, [getViewport]);

  const abrirForm = React.useCallback((id: OrigemId) => {
    formOrigemRef.current = id;
    setFormOrigem(id);
    setFormTexto("");
    setFormImagens([]);
    setFormErro(null);
    posicionarForm(id);
  }, [posicionarForm]);

  const fecharForm = React.useCallback(() => {
    formOrigemRef.current = null;
    setFormOrigem(null);
    setFormImagens([]);
    setFormErro(null);
  }, []);

  /* O botão de anexar: escolhe, sobe para `/api/upload` e guarda a
     URL durável. Se falhar, o botão volta ao estado normal e o
     motivo aparece no cartão — nenhum anexo fantasma entra na lista. */
  const anexarArquivos = React.useCallback(async (arquivos: FileList | null) => {
    if (!arquivos || arquivos.length === 0) return;
    setFormEnviando(true);
    setFormErro(null);
    try {
      const urls: string[] = [];
      for (const arquivo of Array.from(arquivos)) urls.push(await enviarImagem(arquivo));
      setFormImagens(atuais => [...atuais, ...urls]);
    } catch (erro) {
      setFormErro(erro instanceof Error ? erro.message : "Falha ao enviar a imagem.");
    } finally {
      setFormEnviando(false);
    }
  }, []);

  // Redimensionar a janela move a caixa do painel, e com ela o cartão.
  React.useEffect(() => {
    const aoRedimensionar = () => {
      const id = formOrigemRef.current;
      if (id) posicionarForm(id);
    };
    window.addEventListener("resize", aoRedimensionar);
    return () => window.removeEventListener("resize", aoRedimensionar);
  }, [posicionarForm]);

  /* ── Montagem do grafo ───────────────────────────────────
     Os quatro satélites ficam nos pontos literais do snapshot (é
     onde o d3-force da referência assentou); as âncoras usam a
     fórmula literal do `At`: raio 380 e leque
     `min(2π/n * .7, π*.45)` em torno do ângulo do pai. */
  const { nodes, edges, paiDaAncora, limites } = React.useMemo(() => {
    const nodes: Node[] = [];
    const edges: Edge[] = [];
    const paiDaAncora = new Map<string, OrigemId>();

    const leque = Math.min((Math.PI * 2 / 4) * 0.7, Math.PI * 0.45);

    /* Layout de árvore: colunas fixas em x 0 / 360 / 720, filhos
       empilhados e centrados no pai, vão de 80 sob o núcleo e de
       32 nos demais níveis (`Ss`/`Be`/`Ot` do chunk). */
    const alturaBloco = (o: (typeof origens)[number]) => {
      const filhos = o.ancoras.length;
      if (!filhos) return SATELITE_LADO;
      return Math.max(SATELITE_LADO, filhos * ANCORA.a + (filhos - 1) * VAO_ARVORE);
    };
    const alturaTotal = origens.reduce((s, o) => s + alturaBloco(o), 0)
      + (origens.length - 1) * VAO_ARVORE_NUCLEO;
    let cursor = -alturaTotal / 2;

    nodes.push({
      id: "nucleo",
      type: "nucleo",
      position: arvore
        ? { x: COLUNA.nucleo - NUCLEO_LADO / 2, y: -NUCLEO_LADO / 2 }
        : { x: NUCLEO[0], y: NUCLEO[1] },
      draggable: false,
      data: {},
    });

    for (const origem of origens) {
      const slot = SLOT[origem.lado];
      const bloco = alturaBloco(origem);
      const cySat = arvore ? cursor + bloco / 2 : slot.pos[1] + SATELITE_LADO / 2;
      const cxSat = arvore ? COLUNA.satelite : slot.pos[0] + SATELITE_LADO / 2;
      if (arvore) cursor += bloco + VAO_ARVORE_NUCLEO;

      nodes.push({
        id: origem.id,
        type: "origem",
        position: { x: cxSat - SATELITE_LADO / 2, y: cySat - SATELITE_LADO / 2 },
        draggable: false,
        data: {
          origem: origem.id,
          rotulo: origem.rotulo,
          total: origem.total,
          memoriaLigada,
          formAberta: formOrigem === origem.id,
        },
      });

      edges.push({
        id: `e-nucleo-${origem.id}`,
        source: "nucleo",
        target: origem.id,
        type: "literal",
        data: {
          d: arvore
            ? (() => {
                const lado = ladoEntre(0, 0, cxSat, cySat);
                const s = pontoDaBorda(0, 0, NUCLEO_LADO, NUCLEO_LADO, lado);
                const t = pontoDaBorda(cxSat, cySat, SATELITE_LADO, SATELITE_LADO, OPOSTO[lado]);
                return bezier(s.x, s.y, lado, t.x, t.y, OPOSTO[lado]);
              })()
            : slot.d,
        },
      });

      const angulo = Math.atan2(cySat, cxSat);
      const n = origem.ancoras.length;
      origem.ancoras.forEach((ancora, i) => {
        const idNo = `${origem.id}:${ancora.id}`;
        paiDaAncora.set(idNo, origem.id);

        let cx: number;
        let cy: number;
        if (arvore) {
          cx = COLUNA.ancora;
          cy = cySat - (bloco - ANCORA.a) / 2 + i * (ANCORA.a + VAO_ARVORE);
        } else {
          const desvio = n === 1 ? 0 : leque * (i / (n - 1) - 0.5);
          const a = angulo + desvio;
          cx = Math.cos(a) * ANEL_ANCORA;
          cy = Math.sin(a) * ANEL_ANCORA;
        }

        nodes.push({
          id: idNo,
          type: "ancora",
          position: { x: cx - ANCORA.l / 2, y: cy - ANCORA.a / 2 },
          draggable: false,
          data: {
            rotulo: ancora.rotulo,
            detalhe: ancora.detalhe,
            miniatura: ancora.miniatura,
            aoAbrir: () => abrir(ancora.destino, ancora.idPasta),
          },
        });

        const lado = ladoEntre(cxSat, cySat, cx, cy);
        const s = pontoDaBorda(cxSat, cySat, SATELITE_LADO, SATELITE_LADO, lado);
        const t = pontoDaBorda(cx, cy, ANCORA.l, ANCORA.a, OPOSTO[lado]);
        edges.push({
          id: `e-${origem.id}-${ancora.id}`,
          source: origem.id,
          target: idNo,
          type: "literal",
          data: { d: bezier(s.x, s.y, lado, t.x, t.y, OPOSTO[lado]) },
        });
      });
    }

    /* Caixa que envolve tudo, em coordenadas de grafo — só este
       módulo conhece o tamanho de cada tipo de nó. Serve ao
       `fitView` do mapa mental. */
    const caixas = nodes.map(no => {
      const l = no.type === "nucleo" ? NUCLEO_LADO : no.type === "origem" ? SATELITE_LADO : ANCORA.l;
      const a = no.type === "nucleo" ? NUCLEO_LADO : no.type === "origem" ? SATELITE_LADO : ANCORA.a;
      return { x: no.position.x, y: no.position.y, x2: no.position.x + l, y2: no.position.y + a };
    });
    const limites = {
      x: Math.min(...caixas.map(c => c.x)),
      y: Math.min(...caixas.map(c => c.y)),
      x2: Math.max(...caixas.map(c => c.x2)),
      y2: Math.max(...caixas.map(c => c.y2)),
    };

    return { nodes, edges, paiDaAncora, limites };
  }, [origens, memoriaLigada, arvore, abrir, formOrigem]);

  /* ── Quem acende ─────────────────────────────────────────
     Regra literal: `selectedNodeId ?? hoveredNodeId`. O núcleo em
     hover e sem seleção devolve "todas"; um satélite acende a sua
     aresta e as dos seus filhos; uma âncora acende só a corrente
     que chega até ela. Sem hover e sem seleção, nenhuma — e o
     canvas fica limpo. */
  const acesas: Acesas = React.useMemo(() => {
    const foco = selecionado ?? ativo;
    if (!foco) return null;
    if (!selecionado && ativo === "nucleo") return "todas";
    if (foco === "nucleo") return "todas";

    const origem = paiDaAncora.get(foco) ?? (foco as OrigemId);
    const set = new Set<string>([`e-nucleo-${origem}`]);
    if (paiDaAncora.has(foco)) {
      set.add(`e-${origem}-${foco.slice(origem.length + 1)}`);
    } else if (selecionado) {
      for (const e of edges) if (e.source === origem) set.add(e.id);
    }
    return set;
  }, [selecionado, ativo, edges, paiDaAncora]);

  /* ── Viewport ────────────────────────────────────────────
     `setViewport` em vez do `fitView` do xyflow: o `fitView` só
     enquadra o que já está medido em `nodeLookup`, e num
     carregamento frio essa medição chega depois de qualquer prazo.
     Aqui não há corrida — este módulo define a posição de cada nó,
     então a origem do grafo é conhecida antes de pintar. */
  const enquadrar = React.useCallback((duracao: number) => {
    const painel = painelRef.current;
    if (!painel) return;
    const l = painel.clientWidth;
    const a = painel.clientHeight;
    if (!l || !a) return;

    if (!arvore) {
      setViewport({ x: l / 2, y: a / 2, zoom: ZOOM_INICIAL }, { duration: duracao });
      return;
    }
    /* O mapa mental cresce para a direita, então aqui a referência
       troca o snapshot pelo `fitView`: `padding .2`, zoom preso entre
       0.25 e 1.2. */
    const larguraGrafo = limites.x2 - limites.x;
    const alturaGrafo = limites.y2 - limites.y;
    const zoom = Math.min(1.2, Math.max(0.25, Math.min(l / larguraGrafo, a / alturaGrafo) * 0.8));
    setViewport(
      {
        x: l / 2 - ((limites.x + limites.x2) / 2) * zoom,
        y: a / 2 - ((limites.y + limites.y2) / 2) * zoom,
        zoom,
      },
      { duration: duracao },
    );
  }, [setViewport, arvore, limites]);

  /* Sem animação no enquadramento automático: `setViewport` com
     duração interpola por `requestAnimationFrame`, que o navegador
     não agenda em aba de fundo — a tela abriria com o viewport na
     identidade e só se corrigiria ao ganhar foco. */
  /* Guardado em ref para o enquadramento automático NÃO disparar a
     cada mudança de dado: a chegada de uma geração nova ou a abertura
     do cartão refazem a lista de nós, e reenquadrar aí jogaria fora o
     pan e o zoom que o usuário acabou de fazer. Só a troca de layout,
     a montagem e o redimensionamento reenquadram. */
  const enquadrarRef = React.useRef(enquadrar);
  React.useEffect(() => { enquadrarRef.current = enquadrar; }, [enquadrar]);
  React.useEffect(() => { enquadrarRef.current(0); }, [arvore]);

  React.useEffect(() => {
    const painel = painelRef.current;
    if (!painel) return;
    const obs = new ResizeObserver(() => enquadrarRef.current(0));
    obs.observe(painel);
    return () => obs.disconnect();
  }, []);

  /* Grafo NÃO-controlado (`defaultNodes` + `setNodes`), e não a
     prop `nodes`: com `nodes` controlado e sem `onNodesChange` o
     `BatchProvider` do xyflow calcula as mudanças, chama um
     callback que não existe e nunca resolve o `fitViewQueued` — o
     viewport ficava na identidade e, como todo nó vive em
     coordenada negativa, a tela abria vazia. */
  React.useEffect(() => {
    nodesRef.current = nodes;
    setNodes(nodes);
    setEdges(edges);
  }, [nodes, edges, setNodes, setEdges]);

  const salvar = React.useCallback(async () => {
    if (!formOrigem || !formTexto.trim()) return;
    const destino = await criar(formOrigem, formTexto, formImagens);
    fecharForm();
    setFormTexto("");
    if (destino) router.push(destino);
  }, [formOrigem, formTexto, formImagens, criar, router, fecharForm]);

  const convite = origens.find(o => o.id === formOrigem)?.convite ?? "";

  return (
    <>
      <ReactFlow
        ref={painelRef}
        defaultNodes={nodes}
        defaultEdges={edges}
        nodeTypes={TIPOS_DE_NO}
        edgeTypes={TIPOS_DE_ARESTA}
        nodesDraggable={false}
        nodesConnectable={false}
        edgesFocusable={false}
        minZoom={0.25}
        maxZoom={2}
        proOptions={{ hideAttribution: true }}
        onNodeMouseEnter={(_, no) => setAtivo(no.id)}
        onNodeMouseLeave={() => setAtivo(null)}
        onNodeClick={(evento, no) => {
          const adicionar = (evento.target as HTMLElement).closest("[data-adicionar]");
          if (adicionar) { abrirForm(adicionar.getAttribute("data-adicionar") as OrigemId); return; }
          setSelecionado(prev => (prev === no.id ? null : no.id));
        }}
        onPaneClick={() => { setSelecionado(null); fecharForm(); }}
        onMove={() => { const id = formOrigemRef.current; if (id) posicionarForm(id); }}
      >
        {/* `gap 20` × `zoom .7` = os 14px de repetição medidos na
            referência. O `size` do xyflow é diâmetro, não raio: 1.8 é o
            que devolve o `r=0.63` do `<circle>` do DOM dela (medido:
            com `size .9` saía 0.315, metade do necessário). */}
        <Background variant={BackgroundVariant.Dots} gap={20} size={1.8} color="var(--ms-grayA-8-hex)" />
      </ReactFlow>

      <RastroArestas acesas={acesas} />

      {/* Zoom: coluna de três 36×36 em bottom:16 left:16 */}
      <div className="mem-zoom mem-r-xl">
        <button type="button" className="mem-divisor" onClick={() => zoomIn()} aria-label="Aproximar" title="Aproximar">
          <Plus size={16} strokeWidth={1.9500000000000002} />
        </button>
        <button type="button" className="mem-divisor" onClick={() => zoomOut()} aria-label="Afastar" title="Afastar">
          <Minus size={16} strokeWidth={1.9500000000000002} />
        </button>
        <button type="button" onClick={() => enquadrar(300)} aria-label="Reenquadrar" title="Reenquadrar">
          <Maximize size={16} strokeWidth={1.9500000000000002} />
        </button>
      </div>

      {formOrigem && formCaixa && (
        <div className="mem-form" style={{ left: formCaixa.x, top: formCaixa.y }}>
          <div className="mem-form-cartao mem-r-lg">
            <textarea
              autoFocus
              rows={3}
              maxLength={500}
              placeholder={convite}
              value={formTexto}
              onChange={e => setFormTexto(e.target.value)}
              onKeyDown={e => {
                if (e.key === "Escape") { e.preventDefault(); fecharForm(); }
                if ((e.metaKey || e.ctrlKey) && e.key === "Enter") { e.preventDefault(); void salvar(); }
              }}
            />
            {formErro && <p className="mem-form-erro" role="alert">{formErro}</p>}
          </div>
          <div className="mem-form-barra-caixa">
            <div className="mem-form-barra">
              <button
                type="button"
                aria-label="Anexar imagem"
                title="Anexar imagem"
                data-enviando={formEnviando ? "1" : "0"}
                disabled={formEnviando}
                onClick={() => arquivoRef.current?.click()}
              >
                <ImagePlus size={18} strokeWidth={1.6} />
                {formImagens.length > 0 && (
                  <span className="mem-form-badge">{formImagens.length}</span>
                )}
              </button>
              <button type="button" aria-label="Cancelar" onClick={fecharForm}>
                <X size={18} strokeWidth={1.8} />
              </button>
              <button
                type="button"
                aria-label="Salvar"
                data-pode={formTexto.trim() ? "1" : "0"}
                onClick={() => void salvar()}
              >
                <Check size={18} strokeWidth={2} />
              </button>
            </div>
          </div>

          {/* Seletor próprio, com os mesmos tipos que o upload já
              recebe hoje. Nada vem da frente do composer: o que este
              módulo conhece é o endpoint, não um componente dela. */}
          <input
            ref={arquivoRef}
            type="file"
            accept={TIPOS_ACEITOS}
            multiple
            hidden
            onChange={e => { void anexarArquivos(e.target.files); e.target.value = ""; }}
          />
        </div>
      )}
    </>
  );
}

export function GrafoMemoria(props: { memoriaLigada: boolean; arvore: boolean }) {
  return (
    <ReactFlowProvider>
      <Grafo {...props} />
    </ReactFlowProvider>
  );
}

export { CHAVE_MEMORIA };
