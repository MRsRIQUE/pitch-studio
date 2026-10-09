"use client";

/* ============================================================
   SELETOR DE ELEMENTOS (Kling)

   Portado das linhas 4465–4777 de `app/gallery/page.tsx`, com a
   assinatura de props intacta. É o arquivo mais escuro da frente:
   36 ocorrências de branco em rgba em 312 linhas.

   ── De onde vem a aparência ─────────────────────────────────
   O bloco 07 não tem diálogo capturado. O `INFO.md` dele resolve
   isso por precedente: quando falta captura, "a superfície aqui
   reproduz a do popover de modelos do bloco 03 — fundo
   `--app-v2-bg-surface`, raio 12, `--app-v2-shadow-floating`,
   entrada opacity + scale(.96) translateY(-4px) em 150 ms". O
   painel segue isso, com o raio 16 do cartão do bloco 06 por ser
   uma superfície de 520 px e não um menu.

   O cabeçalho e os chips vieram do bloco 06: título 14 px peso
   600 à esquerda, ações circulares de 28 px, e a linha de
   separação em `--ms-border-subtle`.

   ── O que foi cortado ───────────────────────────────────────
   Nada de estado. As duas vistas (browse e create) e o formulário
   de upload continuam inteiros — todos os controles têm dado real
   por trás: o upload chama `/api/upload-asset` de verdade e o
   `canCreate` já era um portão com três condições.

   O único controle que perdeu texto é o alvo de "adicionar
   imagem": a etiqueta `ADD` de 9 px não cabia em português dentro
   dos 72 px do quadrado, e um rótulo cortado é pior que ícone
   nenhum. Virou só o `+`, com `aria-label` e `title`.
   ============================================================ */

import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { getToken } from "@/lib/galleryUtils";
import type { KlingElement } from "@/components/gallery/tipos";
import "@/components/gallery/cartao.css";
import { uploadAssetFetch } from "@/lib/media/uploadAssetFetch";

const CHAVE_ELEMENTOS = "nf-kling-elements";
const MAX_IMAGENS = 4;
const MIN_IMAGENS = 2;
const MAX_BYTES = 10 * 1024 * 1024;

function idAleatorio(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
  });
}

/* Os elementos vivem só no localStorage — não há endpoint para eles.
   As duas helpers moravam no page.tsx e não tinham outro chamador
   além deste seletor, por isso vieram junto. */
function carregarElementos(): KlingElement[] {
  if (typeof window === "undefined") return [];
  try {
    const bruto = localStorage.getItem(CHAVE_ELEMENTOS);
    return bruto ? (JSON.parse(bruto) as KlingElement[]) : [];
  } catch { return []; }
}

function salvarElementos(elementos: KlingElement[]) {
  if (typeof window === "undefined") return;
  try { localStorage.setItem(CHAVE_ELEMENTOS, JSON.stringify(elementos)); } catch {}
}

interface ImagemEmCriacao {
  id: string;
  objectUrl: string;
  cdnUrl: string | null;
  uploading: boolean;
  error: boolean;
}

function Rotulo({ children }: { children: React.ReactNode }) {
  return (
    <div className="mb-2 text-ms-sm font-semibold uppercase tracking-[0.05em] text-ms-text-tertiary">
      {children}
    </div>
  );
}

/**
 * Só a porteira. O conteúdo é montado do zero a cada abertura, então
 * os inicializadores do `useState` de dentro JÁ SÃO o reset — no
 * original isso era um `useEffect` que disparava seis `setState` em
 * sequência assim que `open` virava true, exatamente o encadeamento
 * de renders que o lint do React proíbe.
 */
export function ElementPickerModal({
  open,
  attached,
  onClose,
  onAttach,
}: {
  open: boolean;
  attached: KlingElement[];
  onClose: () => void;
  onAttach: (el: KlingElement) => void;
}) {
  if (!open) return null;
  return <SeletorAberto attached={attached} onClose={onClose} onAttach={onAttach} />;
}

function SeletorAberto({
  attached,
  onClose,
  onAttach,
}: {
  attached: KlingElement[];
  onClose: () => void;
  onAttach: (el: KlingElement) => void;
}) {
  const [view, setView] = useState<"browse" | "create">("browse");
  const [elements, setElements] = useState<KlingElement[]>(carregarElementos);

  // Formulário de criação
  const [createName, setCreateName] = useState("");
  const [createDesc, setCreateDesc] = useState("");
  const [createImages, setCreateImages] = useState<ImagemEmCriacao[]>([]);
  const [creating, setCreating] = useState(false);
  const createFileRef = useRef<HTMLInputElement>(null);

  // Fechar com Escape — é o que os outros diálogos desta base fazem.
  useEffect(() => {
    const aoTeclar = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", aoTeclar);
    return () => window.removeEventListener("keydown", aoTeclar);
  }, [onClose]);

  const excluirElemento = (id: string) => {
    const atualizados = elements.filter(e => e.id !== id);
    setElements(atualizados);
    salvarElementos(atualizados);
  };

  const receberImagens = async (files: FileList) => {
    const restantes = MAX_IMAGENS - createImages.length;
    const aAdicionar = Array.from(files).slice(0, restantes).filter(
      f => (f.type === "image/jpeg" || f.type === "image/png") && f.size <= MAX_BYTES,
    );
    if (!aAdicionar.length) return;

    const novas: ImagemEmCriacao[] = aAdicionar.map(f => ({
      id: idAleatorio(),
      objectUrl: URL.createObjectURL(f),
      cdnUrl: null,
      uploading: true,
      error: false,
    }));
    setCreateImages(prev => [...prev, ...novas]);

    const token = await getToken();
    await Promise.all(aAdicionar.map(async (file, i) => {
      const entrada = novas[i];
      try {
        const res = await uploadAssetFetch({
          method: "POST",
          headers: { "Content-Type": file.type, ...(token ? { Authorization: `Bearer ${token}` } : {}) },
          body: file,
        });
        const data = await res.json() as { cdnUrl?: string; error?: string };
        if (!res.ok || !data.cdnUrl) throw new Error(data.error ?? "Falha no envio");
        setCreateImages(prev => prev.map(e => e.id === entrada.id ? { ...e, cdnUrl: data.cdnUrl!, uploading: false } : e));
      } catch {
        setCreateImages(prev => prev.map(e => e.id === entrada.id ? { ...e, uploading: false, error: true } : e));
      }
    }));
  };

  const imagensProntas = createImages.filter(e => e.cdnUrl && !e.error);
  const podeCriar = createName.trim().length > 0
    && imagensProntas.length >= MIN_IMAGENS
    && !createImages.some(e => e.uploading)
    && !creating;

  const criar = () => {
    if (!podeCriar) return;
    setCreating(true);
    const novo: KlingElement = {
      id: idAleatorio(),
      name: createName.trim(),
      description: createDesc.trim(),
      imageUrls: imagensProntas.map(e => e.cdnUrl!),
    };
    salvarElementos([...carregarElementos(), novo]);
    createImages.forEach(e => URL.revokeObjectURL(e.objectUrl));
    onAttach(novo);
  };

  return createPortal(
    <div
      data-prompt-overlay=""
      className="pointer-events-none fixed inset-0 z-[9100] flex items-center justify-center"
    >
      {/* Véu. No tema escuro o diálogo flutuava sem nenhum — sobre o
          `#F9F9F9` da página um painel branco sem véu não lê como modal.
          20% de preto separa sem virar um poço, que é o que os 70% do
          `--ms-bg-overlay` fariam numa tela clara. */}
      <div
        onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}
        className="pointer-events-auto absolute inset-0"
        style={{ background: "var(--ms-blackA-4-hex)" }}
      />

      <div
        data-element-picker-modal=""
        role="dialog"
        aria-modal="true"
        aria-label={view === "browse" ? "Elementos" : "Novo elemento"}
        className="acervo-entrada pointer-events-auto relative flex max-h-[80vh] w-[min(520px,calc(100vw-32px))] flex-col overflow-hidden rounded-ms-xl border border-ms-border-subtle bg-ms-bg shadow-ms-lg"
      >
        {/* ── Cabeçalho ── */}
        <div className="flex shrink-0 items-center gap-2.5 border-b border-ms-border-subtle px-[18px] pb-3.5 pt-4">
          {view === "create" && (
            <button
              type="button"
              onClick={() => setView("browse")}
              aria-label="Voltar"
              className="flex size-7 shrink-0 items-center justify-center rounded-ms-full bg-ms-bg-component text-ms-icon-secondary transition-colors duration-150 hover:bg-ms-bg-component-hover hover:text-ms-icon focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ms-ring"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M15 18l-6-6 6-6"/></svg>
            </button>
          )}

          <span className="text-ms-lg font-semibold text-ms-text">
            {view === "browse" ? "Elementos" : "Novo elemento"}
          </span>

          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar"
            className="ml-auto flex size-7 shrink-0 items-center justify-center rounded-ms-full bg-ms-bg-component text-ms-icon-secondary transition-colors duration-150 hover:bg-ms-bg-component-hover hover:text-ms-icon focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ms-ring"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg>
          </button>
        </div>

        {view === "browse" ? (
          /* ── Vista de navegação ── */
          <div className="acervo-rolagem-limpa flex-1 overflow-y-auto px-[18px] pb-[18px] pt-4">
            <div className="grid grid-cols-4 gap-2.5">
              {/* Criar novo */}
              <button
                type="button"
                onClick={() => setView("create")}
                className="acervo-alvo flex aspect-square flex-col items-center justify-center gap-2 rounded-ms-md p-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ms-ring"
              >
                <span className="flex size-8 items-center justify-center rounded-ms-full bg-ms-bg-component">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M12 5v14M5 12h14"/></svg>
                </span>
                <span className="text-ms-sm font-medium">Novo elemento</span>
              </button>

              {/* Elementos salvos */}
              {elements.map(el => {
                const anexado = attached.some(a => a.id === el.id);
                const noLimite = attached.length >= 3 && !anexado;
                return (
                  <div key={el.id} className="relative aspect-square">
                    <button
                      type="button"
                      onClick={() => { if (!anexado && !noLimite) onAttach(el); }}
                      disabled={anexado || noLimite}
                      aria-pressed={anexado}
                      title={el.description || el.name}
                      className={
                        "acervo-elemento" + (anexado ? " acervo-elemento--anexado" : "") +
                        " relative block size-full overflow-hidden rounded-ms-md bg-ms-bg-component p-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ms-ring"
                      }
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={el.imageUrls[0]} alt="" className="block size-full object-cover" />

                      {el.imageUrls.length > 1 && (
                        <span
                          className="absolute left-1.5 top-1.5 rounded-ms-sm px-1.5 py-px text-ms-xs font-bold"
                          style={{ background: "var(--ms-blackA-8-hex)", color: "var(--ms-whiteA-11-hex)" }}
                        >
                          {el.imageUrls.length}
                        </span>
                      )}

                      <span
                        className="absolute inset-x-0 bottom-0 block truncate px-1.5 pb-[5px] pt-3.5 text-left text-ms-xs font-semibold"
                        style={{
                          background: "linear-gradient(to top, var(--ms-blackA-9-hex) 0%, transparent 100%)",
                          color: "var(--ms-whiteA-11-hex)",
                        }}
                      >
                        {el.name}
                      </span>

                      {anexado && (
                        <span
                          className="absolute right-1.5 top-1.5 flex size-[18px] items-center justify-center rounded-ms-full"
                          style={{ background: "var(--signal-success)" }}
                        >
                          {/* Check escuro: branco sobre o verde de sinal mede
                              2,7:1; preto mede 7,9:1. */}
                          <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="var(--ms-blackA-12-hex)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                        </span>
                      )}
                    </button>

                    <button
                      type="button"
                      onClick={e => { e.stopPropagation(); excluirElemento(el.id); }}
                      aria-label={`Excluir ${el.name}`}
                      className="acervo-elemento-excluir absolute bottom-1.5 right-1.5 z-[2] flex size-5 items-center justify-center rounded-ms-full p-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ms-ring"
                    >
                      <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg>
                    </button>
                  </div>
                );
              })}

              {elements.length === 0 && (
                <p className="col-span-full py-8 text-center text-ms-md text-ms-text-placeholder">
                  Nenhum elemento ainda — crie o primeiro
                </p>
              )}
            </div>
          </div>
        ) : (
          /* ── Vista de criação ── */
          <div className="acervo-rolagem-limpa flex flex-1 flex-col gap-4 overflow-y-auto px-[18px] pb-[18px] pt-4">
            {/* Imagens */}
            <div>
              <Rotulo>Imagens ({MIN_IMAGENS}–{MAX_IMAGENS} · JPG/PNG · máx. 10 MB cada)</Rotulo>
              <div className="flex flex-wrap gap-2">
                {createImages.map((img, i) => (
                  <div
                    key={img.id}
                    className="relative size-[72px] shrink-0 overflow-hidden rounded-ms-md border bg-ms-bg-component"
                    style={{ borderColor: img.error ? "var(--signal-critical)" : "var(--ms-border-subtle)" }}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={img.objectUrl} alt="" className="block size-full object-cover" />

                    {img.uploading && (
                      <div className="absolute inset-0 flex items-center justify-center" style={{ background: "var(--ms-blackA-7-hex)" }}>
                        <span className="acervo-giro acervo-giro--claro" style={{ width: 14, height: 14, borderWidth: 2 }} aria-label="Enviando" />
                      </div>
                    )}

                    {img.error && (
                      <div className="absolute inset-0 flex items-center justify-center" style={{ background: "var(--ms-blackA-7-hex)" }}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--signal-critical-soft)" strokeWidth="2" strokeLinecap="round" aria-label="Falhou"><circle cx="12" cy="12" r="10"/><path d="M12 8v4M12 16h.01"/></svg>
                      </div>
                    )}

                    <button
                      type="button"
                      aria-label="Remover imagem"
                      onClick={() => setCreateImages(prev => { URL.revokeObjectURL(img.objectUrl); return prev.filter((_, j) => j !== i); })}
                      className="absolute right-[3px] top-[3px] flex size-4 items-center justify-center rounded-ms-full p-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ms-ring"
                      style={{ background: "var(--ms-blackA-8-hex)", color: "var(--ms-whiteA-11-hex)" }}
                    >
                      <svg width="7" height="7" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg>
                    </button>
                  </div>
                ))}

                {createImages.length < MAX_IMAGENS && (
                  <button
                    type="button"
                    onClick={() => createFileRef.current?.click()}
                    aria-label="Adicionar imagens"
                    title="Adicionar imagens"
                    className="acervo-alvo flex size-[72px] shrink-0 items-center justify-center rounded-ms-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ms-ring"
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M12 5v14M5 12h14"/></svg>
                  </button>
                )}
              </div>

              <input
                ref={createFileRef}
                type="file"
                accept="image/jpeg,image/png"
                multiple
                className="hidden"
                onChange={e => { if (e.target.files) { receberImagens(e.target.files); e.target.value = ""; } }}
              />
            </div>

            {/* Nome */}
            <div>
              <Rotulo>Nome</Rotulo>
              <input
                value={createName}
                onChange={e => setCreateName(e.target.value)}
                placeholder="Nome do elemento"
                maxLength={50}
                aria-label="Nome do elemento"
                className="acervo-campo"
              />
            </div>

            {/* Descrição */}
            <div>
              <Rotulo>Descrição</Rotulo>
              <textarea
                value={createDesc}
                onChange={e => setCreateDesc(e.target.value)}
                placeholder="Descreva este elemento…"
                rows={3}
                maxLength={500}
                aria-label="Descrição do elemento"
                className="acervo-campo resize-none"
              />
            </div>

            <button
              type="button"
              onClick={criar}
              disabled={!podeCriar}
              className="acervo-botao-marca self-start rounded-ms-md px-6 py-2.5 text-ms-md font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ms-ring"
            >
              {creating ? "Criando…" : "Criar elemento"}
            </button>
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}
