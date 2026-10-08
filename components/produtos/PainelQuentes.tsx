"use client";

/* ============================================================
   PRODUTOS QUENTES — a aba

   A grade dos produtos que vêm do PitchAI, e os dois verbos que fazem
   deles material de vídeo: LIMPAR (recortar a foto de anúncio) e USAR
   (montar a cena no grafo com um personagem).

   ── Por que a foto passa pelo nosso servidor ────────────────────────
   `/api/quentes/imagem?u=…` em vez do endereço do CDN direto no `<img>`.
   Hotlink de CDN de terceiro é o tipo de coisa que funciona hoje e passa
   a devolver 403 sem aviso — e quando quebra, quebra a grade inteira de
   uma vez. O motivo completo está no cabeçalho daquela rota.

   ── Duas origens, e a diferença aparece ─────────────────────────────
   `vitrine` são os quentes curados, com venda e receita de verdade.
   `base` são os capturados que ainda não foram curados: 300 e poucos,
   com foto boa mas sem número confiável. Os dois servem de material, e
   misturá-los sem dizer qual é qual seria mentir sobre o dado — daí o
   selo no cartão e o filtro no topo.
   ============================================================ */

import * as React from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import {
  ExternalLink,
  Flame,
  Loader2,
  RefreshCw,
  Search,
  Sparkles,
  Wand2,
} from "lucide-react";
import type { ProdutoQuente } from "@/lib/pitchai/quentes";
import { useProdutosStore, melhorFoto } from "@/lib/produtosStore";
import { recortarProduto, MODELO_RECORTE } from "@/lib/recorteProduto";
import { usePersonagensStore, type Personagem } from "@/lib/personagensStore";
import { montarCenaDeProduto } from "@/lib/cenaProduto";
import { useWorkflowStore } from "@/lib/store";
import { SeletorPersonagem } from "./SeletorPersonagem";
import "./produtos.css";

type Filtro = "todos" | "vitrine" | "base";

/** A foto pela nossa rota. Data URL passa direto — já está no documento. */
function viaProxy(url: string | null): string | undefined {
  if (!url) return undefined;
  if (url.startsWith("data:") || url.startsWith("/generated/")) return url;
  return `/api/quentes/imagem?u=${encodeURIComponent(url)}`;
}

const real = (v: number) =>
  v > 0 ? v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) : "—";

/** 4647 → "4,6 mil". Cabe em cartão de 190px; o número cru não cabe. */
function compacto(v: number | null): string | null {
  if (v === null || v <= 0) return null;
  if (v < 1000) return String(Math.round(v));
  return `${(v / 1000).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} mil`;
}

/**
 * Garante que a foto esteja NA NOSSA ORIGEM antes de virar nó.
 *
 * Isto não é capricho: o `ImageInputNode` desenha com `next/image`, que
 * LANÇA quando o host não está no `remotePatterns` do `next.config.ts` —
 * e a exceção não fica contida no nó, ela derruba a árvore do React Flow
 * inteira. Medido: um nó com URL de `s.500fd.com` levou o canvas de 10
 * nós a zero, com "Invalid src prop" no console.
 *
 * Gravar em disco resolve isso e mais uma coisa: o nó passa a apontar
 * para um arquivo nosso, que continua existindo quando o CDN do TikTok
 * tirar a foto do ar.
 */
async function paraDisco(url: string): Promise<string | null> {
  if (url.startsWith("/generated/")) return url;
  try {
    const resposta = await fetch("/api/upload", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ dataUrl: url, folder: "produtos" }),
    });
    if (!resposta.ok) return null;
    const corpo = (await resposta.json()) as { cdnUrl?: string };
    return corpo.cdnUrl ?? null;
  } catch {
    return null;
  }
}

type Resposta =
  | { ok: true; itens: ProdutoQuente[] }
  | { ok: false; erro: { tipo: string; detalhe: string } };

/** Só fala com a rota. Nenhum estado do React passa por aqui. */
async function pedirQuentes(recarregar: boolean): Promise<Resposta> {
  try {
    const resposta = await fetch(`/api/quentes${recarregar ? "?recarregar=1" : ""}`);
    const corpo = (await resposta.json()) as {
      itens?: ProdutoQuente[];
      erro?: string;
      detalhe?: string;
    };
    if (!resposta.ok) {
      return {
        ok: false,
        erro: { tipo: corpo.erro ?? "falhou", detalhe: corpo.detalhe ?? `HTTP ${resposta.status}` },
      };
    }
    return { ok: true, itens: corpo.itens ?? [] };
  } catch (e) {
    return { ok: false, erro: { tipo: "rede", detalhe: e instanceof Error ? e.message : String(e) } };
  }
}

export function PainelQuentes({ variante = "painel" }: { variante?: "painel" | "pagina" }) {
  /* A mesma grade em dois lugares. No painel ela divide 410px com o grafo
     atrás; na tela própria tem a largura inteira, e aí os cartões crescem
     em vez de multiplicar colunas de 150px. A diferença é uma variável de
     CSS (`--pq-min`) e para onde a cena montada leva o usuário. */
  const emPagina = variante === "pagina";
  const router = useRouter();
  const idDoProjeto = useWorkflowStore((e) => e.activeSpaceId);

  /* A folha de personagem cobre o painel inteiro, e o painel rola: dentro
     de `.gal__rolagem` (que é `overflow-y: auto`) ela seria recortada em
     cima e rolaria junto com a grade. Por isso ela é montada por portal no
     `.gal`, que é o elemento posicionado do painel. Sem `.gal` por perto —
     se um dia isto for usado noutro lugar — cai no `body`. */
  const raizRef = React.useRef<HTMLDivElement>(null);
  const [ancora, setAncora] = React.useState<HTMLElement | null>(null);
  React.useEffect(() => {
    setAncora(raizRef.current?.closest<HTMLElement>(".gal") ?? document.body);
  }, []);

  const [itens, setItens] = React.useState<ProdutoQuente[]>([]);
  const [carregando, setCarregando] = React.useState(true);
  const [erro, setErro] = React.useState<{ tipo: string; detalhe: string } | null>(null);
  const [filtro, setFiltro] = React.useState<Filtro>("todos");
  const [busca, setBusca] = React.useState("");
  const [paraCena, setParaCena] = React.useState<ProdutoQuente | null>(null);
  const [aviso, setAviso] = React.useState<string | null>(null);
  const [montando, setMontando] = React.useState(false);

  const recortes = useProdutosStore((e) => e.recortes);
  const emAndamento = useProdutosStore((e) => e.emAndamento);
  const guardarRecorte = useProdutosStore((e) => e.guardarRecorte);
  const marcarAndamento = useProdutosStore((e) => e.marcarAndamento);
  const registrarUso = usePersonagensStore((e) => e.registrarUso);

  /* A busca é uma função pura fora do componente (`pedirQuentes`) e quem
     escreve estado é sempre o chamador. É o que mantém o efeito livre de
     escrita síncrona — a cascata que o `react-hooks/set-state-in-effect`
     aponta — e ainda deixa o botão de recarregar acender o "carregando"
     no clique, que é manipulador de evento e pode escrever à vontade. */
  React.useEffect(() => {
    let vivo = true;
    void (async () => {
      const r = await pedirQuentes(false);
      if (!vivo) return;
      if (r.ok) setItens(r.itens);
      else setErro(r.erro);
      setCarregando(false);
    })();
    return () => { vivo = false; };
  }, []);

  const recarregar = () => {
    setCarregando(true);
    setErro(null);
    void (async () => {
      const r = await pedirQuentes(true);
      if (r.ok) setItens(r.itens);
      else setErro(r.erro);
      setCarregando(false);
    })();
  };

  /* O recorte é uma geração: se o painel fechar no meio, o laço de espera
     tem que parar junto. O job continua no servidor e o resultado é
     recuperável — o que morre aqui é só a espera. */
  const abortarRef = React.useRef<AbortController | null>(null);
  React.useEffect(() => () => abortarRef.current?.abort(), []);

  const limpar = async (produto: ProdutoQuente) => {
    const pid = produto.pid ?? produto.id;
    if (!produto.imagem || emAndamento[pid]) return;

    marcarAndamento(pid, true);
    setAviso(null);
    abortarRef.current = new AbortController();

    const resultado = await recortarProduto(
      { nome: produto.nome, imagem: produto.imagem },
      { sinal: abortarRef.current.signal },
    );

    if (resultado.ok) {
      guardarRecorte(pid, {
        url: resultado.url,
        origem: produto.imagem,
        modelo: MODELO_RECORTE,
        em: new Date().toISOString(),
      });
    } else {
      marcarAndamento(pid, false);
      if (resultado.erro !== "cancelado") setAviso(resultado.erro);
    }
  };

  const montar = async (personagem: Personagem) => {
    const produto = paraCena;
    if (!produto) return;

    const pid = produto.pid ?? produto.id;
    const { url } = melhorFoto(pid, produto.imagem, recortes);
    if (!url || personagem.fotos.length === 0) return;

    setMontando(true);
    setAviso(null);
    try {
      /* As duas fotos passam pelo disco antes de virarem nó — ver
         `paraDisco`. As já gravadas voltam na hora, sem rede. */
      const [fotoProduto, ...fotosPessoa] = await Promise.all([
        paraDisco(url),
        ...personagem.fotos.map(paraDisco),
      ]);
      const daPessoa = fotosPessoa.filter((f): f is string => !!f);

      if (!fotoProduto || daPessoa.length === 0) {
        setAviso("Não consegui guardar as fotos para montar a cena. Tente de novo.");
        return;
      }

      const resultado = montarCenaDeProduto(
        { nome: produto.nome, foto: fotoProduto, preco: produto.preco },
        { nome: personagem.nome, fotos: daPessoa, descricao: personagem.descricao },
      );

      registrarUso(personagem.id);
      setParaCena(null);
      setAviso(
        `Cena montada: ${resultado.nosCriados} nós e ${resultado.arestasCriadas} ligações. Ctrl+Z desfaz tudo de uma vez.`,
      );

      /* Na tela própria a cena nasce num grafo que o usuário NÃO está
         vendo — o do projeto aberto por último. Mandar ele para lá é o que
         separa "montei" de "montei em algum lugar". No painel isso não
         acontece: o grafo já está atrás. */
      if (emPagina && idDoProjeto) router.push(`/workflow/${idDoProjeto}`);
    } finally {
      setMontando(false);
    }
  };

  const visiveis = React.useMemo(() => {
    const termo = busca.trim().toLowerCase();
    return itens.filter((p) => {
      if (filtro !== "todos" && p.origem !== filtro) return false;
      if (!termo) return true;
      return p.nome.toLowerCase().includes(termo) || (p.categoria ?? "").toLowerCase().includes(termo);
    });
  }, [itens, filtro, busca]);

  /* ── Estados que não são a grade ── */

  if (erro?.tipo === "sem_credencial") {
    return (
      <div className="pq-vazio">
        <Flame size={22} strokeWidth={1.6} />
        <p>Os Produtos Quentes vêm do banco do PitchAI, e a credencial ainda não está configurada.</p>
        <code>PITCHAI_SERVICE_ACCOUNT</code>
        <small>
          Aponte a variável para o .json da conta de serviço do PitchAI no <code>.env.local</code> e
          reinicie o servidor.
        </small>
      </div>
    );
  }

  if (erro) {
    return (
      <div className="pq-vazio">
        <p>Não consegui ler os produtos.</p>
        <small>{erro.detalhe}</small>
        <button type="button" className="pq-btn" onClick={recarregar}>
          <RefreshCw size={14} strokeWidth={1.9} />
          Tentar de novo
        </button>
      </div>
    );
  }

  return (
    <div className={emPagina ? "pq pq--pagina" : "pq"} ref={raizRef}>
      <div className="pq-barra">
        <div className="pq-busca">
          <Search size={14} strokeWidth={1.9} />
          <input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar produto ou categoria"
            aria-label="Buscar produto"
          />
        </div>
        <button
          type="button"
          className="pq-icone"
          aria-label="Recarregar a lista"
          title="Recarregar"
          onClick={recarregar}
        >
          <RefreshCw size={14} strokeWidth={1.9} />
        </button>
      </div>

      <div className="pq-chips" role="tablist" aria-label="Origem do produto">
        {([
          ["todos", "Todos"],
          ["vitrine", "Vitrine"],
          ["base", "Base"],
        ] as [Filtro, string][]).map(([valor, rotulo]) => (
          <button
            key={valor}
            type="button"
            role="tab"
            aria-selected={filtro === valor}
            className="pq-chip"
            onClick={() => setFiltro(valor)}
          >
            {rotulo}
            <span>{valor === "todos" ? itens.length : itens.filter((p) => p.origem === valor).length}</span>
          </button>
        ))}
      </div>

      {aviso && (
        <p className="pq-aviso" role="status">
          {aviso}
          <button type="button" onClick={() => setAviso(null)} aria-label="Dispensar">×</button>
        </p>
      )}

      {carregando && itens.length === 0 ? (
        <div className="pq-grade">
          {Array.from({ length: 6 }, (_, i) => <div key={i} className="pq-esqueleto" />)}
        </div>
      ) : visiveis.length === 0 ? (
        <div className="pq-vazio">
          <p>{busca ? "Nenhum produto com esse termo." : "Nenhum produto na base ainda."}</p>
        </div>
      ) : (
        <div className="pq-grade">
          {visiveis.map((produto) => {
            const pid = produto.pid ?? produto.id;
            const { url, limpa } = melhorFoto(pid, produto.imagem, recortes);
            const recortando = !!emAndamento[pid];
            const vendas = compacto(produto.vendas);

            return (
              <article key={`${produto.origem}-${produto.id}`} className="pq-card" data-limpa={limpa || undefined}>
                <div className="pq-card__foto">
                  {url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={viaProxy(url)} alt="" loading="lazy" draggable={false} />
                  ) : (
                    <span className="pq-card__semfoto">sem foto</span>
                  )}

                  <span className="pq-selo" data-origem={produto.origem}>
                    {produto.origem === "vitrine" ? "Quente" : "Base"}
                  </span>

                  {limpa && (
                    <span className="pq-selo pq-selo--limpa" title={`Recortado com ${MODELO_RECORTE}`}>
                      <Sparkles size={11} strokeWidth={2} />
                      limpa
                    </span>
                  )}

                  {recortando && (
                    <span className="pq-card__recortando">
                      <Loader2 size={18} className="pq-girando" />
                      recortando…
                    </span>
                  )}
                </div>

                <div className="pq-card__texto">
                  <strong title={produto.nome}>{produto.nome}</strong>
                  <span>
                    {real(produto.preco)}
                    {vendas && <em>· {vendas} vendas</em>}
                  </span>
                </div>

                <div className="pq-card__acoes">
                  <button
                    type="button"
                    className="pq-btn"
                    disabled={!produto.imagem || recortando}
                    onClick={() => void limpar(produto)}
                    title={limpa ? "Recortar de novo" : "Isolar o produto em fundo branco"}
                  >
                    <Wand2 size={13} strokeWidth={1.9} />
                    {limpa ? "Refazer" : "Limpar"}
                  </button>

                  <button
                    type="button"
                    className="pq-btn pq-btn--marca"
                    disabled={!url}
                    onClick={() => setParaCena(produto)}
                    title="Montar a cena no grafo com um personagem"
                  >
                    Usar
                  </button>

                  {produto.link && (
                    <a
                      className="pq-icone"
                      href={produto.link}
                      target="_blank"
                      rel="noreferrer"
                      aria-label="Abrir o produto na loja"
                      title="Abrir na loja"
                    >
                      <ExternalLink size={13} strokeWidth={1.9} />
                    </a>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}

      {paraCena && ancora &&
        createPortal(
          <SeletorPersonagem
            nomeDoProduto={paraCena.nome}
            montando={montando}
            emPagina={emPagina}
            onEscolher={(p) => void montar(p)}
            onFechar={() => setParaCena(null)}
          />,
          ancora,
        )}
    </div>
  );
}
