"use client";

/* ============================================================
   SELETOR DE PERSONAGENS DO WORKFLOW

   Os personagens são criados em `/personagens` e ficam no
   `lib/personagensStore.ts`. Até aqui, para usar um deles no canvas era
   preciso baixar a foto e subir de novo pelo Upload — o retrato já estava
   em disco (`/generated/...`), só não havia porta para ele no grafo.

   Este menu é essa porta. Ele lista os personagens ATIVOS e, num clique,
   cria no canvas o que o grafo sabe consumir:

     · o retrato       → um `imageInputNode` com a foto como referência
     · a descrição     → um `promptNode` com o texto físico que entra no prompt

   Quem chama decide ONDE o nó nasce: a barra vertical passa o
   posicionamento automático, e o menu "Adicionar nó" passa o ponto do
   cursor quando veio do botão direito. Por isso este componente não
   posiciona nada — ele só entrega `(tipo, dados)` em `onCriarNo`.

   Duas portas, um componente: a barra (`CanvasToolbar`) e o menu
   (`AddNodeMenu`). O `WorkflowCanvas` continua congelado.
   ============================================================ */

/* Fotos de personagem são uploads do usuário e retratos gerados localmente. */
/* eslint-disable @next/next/no-img-element */

import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { usePersonagensStore, personagensAtivos, type Personagem } from "@/lib/personagensStore";
import type { NodeData } from "@/lib/store";
import { Search, X, ImageIcon, MessageSquare, ChevronDown, ArrowRight, UserRound } from "@/components/icones";

export type TipoNoPersonagem = "imageInputNode" | "promptNode";

interface PersonagemPickerMenuProps {
  /** Caixa do botão que abriu o menu, ou um retângulo 1×1 na posição do cursor. */
  anchorRect: DOMRect;
  onClose: () => void;
  /** Cria o nó no canvas. A posição é responsabilidade de quem chama. */
  onCriarNo: (tipo: TipoNoPersonagem, dados: Partial<NodeData>) => void;
}

const MENU_W = 320;
const MENU_MAX_H = 480;
/** Acima disso a lista ganha busca; abaixo, o campo só ocuparia espaço. */
const MIN_PARA_BUSCA = 6;

function ehCursor(r: DOMRect) { return r.width <= 1 && r.height <= 1; }

/** O retrato que a tela de Personagens mostra no cartão: a foto mais recente. */
function retratoDe(p: Personagem): string | undefined {
  return p.fotos[p.fotos.length - 1];
}

/**
 * Mede a proporção natural da imagem antes de criar o nó, para o
 * `imageInputNode` já nascer com a altura certa — é o mesmo que o
 * `AddNodeMenu` faz ao escolher um asset. Falha vira `undefined`, e o nó
 * mede sozinho depois.
 */
function medirProporcao(url: string): Promise<string | undefined> {
  return new Promise((resolve) => {
    const img = new window.Image();
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      resolve(img.naturalWidth && img.naturalHeight ? `${img.naturalWidth} / ${img.naturalHeight}` : undefined);
    };
    img.onload = finish;
    img.onerror = () => { done = true; resolve(undefined); };
    img.src = url;
    if (img.complete && img.naturalWidth > 0) finish();
  });
}

const subscribeHidratacao = (notify: () => void) => usePersonagensStore.persist.onFinishHydration(notify);

export default function PersonagemPickerMenu({ anchorRect, onClose, onCriarNo }: PersonagemPickerMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [expandido, setExpandido] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);

  const personagens = usePersonagensStore((s) => s.personagens);
  const ultimoUsadoId = usePersonagensStore((s) => s.ultimoUsadoId);
  const registrarUso = usePersonagensStore((s) => s.registrarUso);
  const hidratado = useSyncExternalStore(
    subscribeHidratacao,
    () => usePersonagensStore.persist.hasHydrated(),
    () => false,
  );

  /* O último usado sobe para o topo: é o que se procura de novo. */
  const ativos = useMemo(() => {
    const lista = personagensAtivos(personagens);
    if (!ultimoUsadoId) return lista;
    const ultimo = lista.find((p) => p.id === ultimoUsadoId);
    return ultimo ? [ultimo, ...lista.filter((p) => p.id !== ultimoUsadoId)] : lista;
  }, [personagens, ultimoUsadoId]);

  const q = query.trim().toLocaleLowerCase();
  const visiveis = q
    ? ativos.filter((p) => `${p.nome} ${p.descricao}`.toLocaleLowerCase().includes(q))
    : ativos;
  const temBusca = ativos.length >= MIN_PARA_BUSCA;

  useEffect(() => { if (temBusca) searchRef.current?.focus(); }, [temBusca]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener("mousedown", handler, true);
    return () => document.removeEventListener("mousedown", handler, true);
  }, [onClose]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onClose]);

  async function inserirFoto(p: Personagem, foto: string) {
    if (ocupado) return;
    setOcupado(true);
    const ratio = await medirProporcao(foto);
    onCriarNo("imageInputNode", {
      label: p.nome,
      inputImage: foto,
      r2Url: foto,
      personagemId: p.id,
      ...(ratio ? { imageNaturalRatio: ratio } : {}),
    });
    registrarUso(p.id);
    onClose();
  }

  function inserirDescricao(p: Personagem) {
    if (ocupado || !p.descricao.trim()) return;
    onCriarNo("promptNode", {
      label: `${p.nome} · descrição`,
      prompt: p.descricao.trim(),
      personagemId: p.id,
    });
    registrarUso(p.id);
    onClose();
  }

  /* Posição: ao lado de um botão, centrado na altura dele; a partir do
     ponto, quando veio do cursor. Sempre dentro da janela. */
  const noCursor = ehCursor(anchorRect);
  const leftRaw = anchorRect.right + 10;
  const left = Math.max(12, Math.min(leftRaw, window.innerWidth - MENU_W - 12));
  const topRaw = noCursor ? anchorRect.top : anchorRect.top + anchorRect.height / 2 - MENU_MAX_H / 2;
  const top = Math.max(12, Math.min(topRaw, window.innerHeight - MENU_MAX_H - 12));

  const menu = (
    <div
      id="pers-picker"
      ref={menuRef}
      role="dialog"
      aria-label="Personagens"
      onMouseDown={(e) => e.stopPropagation()}
      style={{ position: "fixed", left, top, width: MENU_W, maxHeight: MENU_MAX_H, zIndex: 99999 }}
    >
      <style>{`
        #pers-picker {
          display: flex; flex-direction: column; overflow: hidden;
          background: color-mix(in srgb, var(--ms-bg) 96%, transparent);
          backdrop-filter: blur(24px); -webkit-backdrop-filter: blur(24px);
          border: 1px solid var(--ms-border); border-radius: 16px;
          box-shadow: 0 22px 54px rgba(42, 31, 74, 0.16), 0 5px 16px rgba(42, 31, 74, 0.08);
          animation: persPickerIn 160ms cubic-bezier(0.22,1,0.36,1) both;
          color: var(--ms-text); font-size: 13px;
        }
        @keyframes persPickerIn {
          from { opacity: 0; transform: translateX(-10px) scale(0.96); }
          to   { opacity: 1; transform: translateX(0) scale(1); }
        }
        #pers-picker .pp-head {
          display: flex; align-items: center; gap: 8px; padding: 11px 14px;
          border-bottom: 1px solid var(--ms-border-subtle); background: var(--ms-bg-subtle);
        }
        #pers-picker .pp-head strong { font-size: 12px; font-weight: 700; letter-spacing: 0.06em; text-transform: uppercase; color: var(--ms-text-secondary); }
        #pers-picker .pp-head a {
          margin-left: auto; display: inline-flex; align-items: center; gap: 4px;
          font-size: 11px; font-weight: 600; color: var(--ms-text-brand); text-decoration: none;
        }
        #pers-picker .pp-head a:hover { text-decoration: underline; }
        #pers-picker .pp-search {
          display: flex; align-items: center; gap: 8px; padding: 8px 14px;
          border-bottom: 1px solid var(--ms-border-subtle);
        }
        #pers-picker .pp-search input {
          flex: 1; background: transparent; border: none; outline: none;
          color: var(--ms-text); font-size: 13px; caret-color: var(--ms-solid-brand);
        }
        #pers-picker .pp-search input::placeholder { color: var(--ms-text-placeholder); opacity: 1; }
        #pers-picker .pp-list { overflow-y: auto; flex: 1; padding: 8px; display: flex; flex-direction: column; gap: 2px; }
        #pers-picker .pp-row { border-radius: 10px; transition: background 120ms ease; }
        #pers-picker .pp-row:hover, #pers-picker .pp-row:focus-within { background: var(--ms-bg-brand-subtle); }
        #pers-picker .pp-main {
          display: flex; align-items: center; gap: 12px; width: 100%; padding: 8px 10px;
          background: transparent; border: none; cursor: pointer; text-align: left; color: inherit;
          border-radius: 10px;
        }
        #pers-picker .pp-main:disabled { cursor: progress; opacity: 0.6; }
        #pers-picker .pp-thumb {
          flex-shrink: 0; width: 44px; height: 56px; border-radius: 9px; overflow: hidden;
          background: var(--ms-bg-component); border: 1px solid var(--ms-border-subtle);
          display: flex; align-items: center; justify-content: center; color: var(--ms-icon-tertiary);
        }
        #pers-picker .pp-thumb img { width: 100%; height: 100%; object-fit: cover; display: block; }
        #pers-picker .pp-text { display: flex; flex-direction: column; gap: 3px; min-width: 0; flex: 1; }
        #pers-picker .pp-nome { font-size: 13px; font-weight: 600; line-height: 1.2; display: flex; align-items: center; gap: 6px; }
        #pers-picker .pp-nome small {
          font-size: 9px; font-weight: 700; letter-spacing: 0.06em; text-transform: uppercase;
          color: var(--ms-text-brand); background: var(--ms-bg-brand-subtle); border-radius: 4px; padding: 1px 5px;
        }
        #pers-picker .pp-desc {
          font-size: 11px; color: var(--ms-text-secondary); line-height: 1.35;
          overflow: hidden; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical;
        }
        #pers-picker .pp-meta { font-size: 10px; color: var(--ms-text-tertiary); }
        #pers-picker .pp-acoes { display: flex; gap: 4px; padding: 0 10px 8px 66px; }
        #pers-picker .pp-acao {
          display: inline-flex; align-items: center; gap: 5px; padding: 4px 8px;
          font-size: 11px; font-weight: 600; color: var(--ms-text-secondary);
          background: var(--ms-bg); border: 1px solid var(--ms-border); border-radius: 999px; cursor: pointer;
          transition: color 120ms ease, border-color 120ms ease;
        }
        #pers-picker .pp-acao:hover:not(:disabled) { color: var(--ms-text); border-color: var(--ms-border-strong); }
        #pers-picker .pp-acao:disabled { opacity: 0.45; cursor: not-allowed; }
        #pers-picker .pp-acao[aria-expanded="true"] svg:last-child { transform: rotate(180deg); }
        #pers-picker .pp-fotos { display: flex; flex-wrap: wrap; gap: 6px; padding: 0 10px 10px 66px; }
        #pers-picker .pp-foto {
          width: 40px; height: 52px; padding: 0; border-radius: 7px; overflow: hidden; cursor: pointer;
          border: 2px solid transparent; background: var(--ms-bg-component); transition: border-color 120ms ease;
        }
        #pers-picker .pp-foto:hover { border-color: var(--ms-border-brand); }
        #pers-picker .pp-foto img { width: 100%; height: 100%; object-fit: cover; display: block; }
        #pers-picker .pp-vazio {
          display: flex; flex-direction: column; align-items: center; gap: 8px; text-align: center;
          padding: 28px 18px; color: var(--ms-text-secondary); font-size: 12px; line-height: 1.45;
        }
        #pers-picker .pp-vazio > svg { color: var(--ms-icon-tertiary); }
        #pers-picker .pp-vazio a {
          display: inline-flex; align-items: center; gap: 6px; margin-top: 4px; padding: 7px 12px;
          font-size: 12px; font-weight: 600; color: var(--ms-text-on-brand); background: var(--ms-solid-brand);
          border-radius: 999px; text-decoration: none;
        }
        #pers-picker .pp-vazio a:hover { background: var(--ms-solid-brand-hover); }
        #pers-picker .pp-rodape {
          display: flex; align-items: center; gap: 12px; padding: 8px 14px;
          border-top: 1px solid var(--ms-border-subtle); background: var(--ms-bg-subtle);
          font-size: 11px; color: var(--ms-text-secondary);
        }
        #pers-picker .pp-rodape kbd { font-family: monospace; opacity: 0.7; }
        #pers-picker button:focus-visible, #pers-picker a:focus-visible { outline: 2px solid var(--ms-ring); outline-offset: -2px; }
      `}</style>

      <div className="pp-head">
        <UserRound size={14} />
        <strong>Personagens</strong>
        <Link href="/personagens" onClick={onClose}>Gerenciar <ArrowRight size={11} /></Link>
      </div>

      {temBusca && (
        <div className="pp-search">
          <Search size={14} color="var(--ms-icon-secondary)" />
          <input
            ref={searchRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar no seu elenco…"
            aria-label="Buscar personagens"
          />
          {query && (
            <button
              onClick={() => setQuery("")}
              aria-label="Limpar busca"
              style={{ background: "transparent", border: "none", cursor: "pointer", color: "var(--ms-icon-secondary)", padding: 0, lineHeight: 1 }}
            >
              <X size={14} />
            </button>
          )}
        </div>
      )}

      <div className="pp-list">
        {!hidratado ? (
          <p className="pp-vazio">Carregando seu elenco…</p>
        ) : ativos.length === 0 ? (
          <div className="pp-vazio">
            <UserRound size={28} />
            <span>
              {personagens.length === 0
                ? "Você ainda não criou nenhum personagem."
                : "Todos os seus personagens estão arquivados."}
            </span>
            <Link href="/personagens" onClick={onClose}>
              {personagens.length === 0 ? "Criar personagem" : "Abrir personagens"} <ArrowRight size={12} />
            </Link>
          </div>
        ) : visiveis.length === 0 ? (
          <p className="pp-vazio">Nenhum personagem corresponde a &ldquo;{query}&rdquo;</p>
        ) : (
          visiveis.map((p) => {
            const retrato = retratoDe(p);
            const aberto = expandido === p.id;
            const temDescricao = p.descricao.trim().length > 0;
            return (
              <div key={p.id} className="pp-row">
                <button
                  type="button"
                  className="pp-main"
                  disabled={ocupado || !retrato}
                  title={retrato ? "Inserir o retrato como imagem de referência" : "Este personagem ainda não tem foto"}
                  onClick={() => retrato && inserirFoto(p, retrato)}
                >
                  <span className="pp-thumb">
                    {retrato ? <img src={retrato} alt="" loading="lazy" decoding="async" /> : <UserRound size={20} />}
                  </span>
                  <span className="pp-text">
                    <span className="pp-nome">
                      {p.nome}
                      {p.id === ultimoUsadoId && <small>Último</small>}
                    </span>
                    {temDescricao && <span className="pp-desc">{p.descricao}</span>}
                    <span className="pp-meta">
                      {p.fotos.length === 0 ? "Sem fotos" : p.fotos.length === 1 ? "1 foto" : `${p.fotos.length} fotos`}
                      {p.usos > 0 && ` · usado ${p.usos}×`}
                    </span>
                  </span>
                </button>
                <div className="pp-acoes">
                  <button
                    type="button"
                    className="pp-acao"
                    disabled={ocupado || !temDescricao}
                    title={temDescricao ? "Inserir a descrição como nó de texto" : "Este personagem não tem descrição"}
                    onClick={() => inserirDescricao(p)}
                  >
                    <MessageSquare size={11} /> Descrição
                  </button>
                  {p.fotos.length > 1 && (
                    <button
                      type="button"
                      className="pp-acao"
                      aria-expanded={aberto}
                      onClick={() => setExpandido(aberto ? null : p.id)}
                    >
                      <ImageIcon size={11} /> Escolher foto <ChevronDown size={11} style={{ transition: "transform 120ms ease" }} />
                    </button>
                  )}
                </div>
                {aberto && (
                  <div className="pp-fotos">
                    {p.fotos.map((foto, i) => (
                      <button
                        key={foto}
                        type="button"
                        className="pp-foto"
                        disabled={ocupado}
                        aria-label={`Inserir foto ${i + 1} de ${p.nome}`}
                        onClick={() => inserirFoto(p, foto)}
                      >
                        <img src={foto} alt="" loading="lazy" decoding="async" />
                      </button>
                    ))}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      <div className="pp-rodape">
        <span>Clique no retrato para inserir como referência</span>
        <span style={{ marginLeft: "auto" }}><kbd>Esc</kbd> Fechar</span>
      </div>
    </div>
  );

  return createPortal(menu, document.body);
}
