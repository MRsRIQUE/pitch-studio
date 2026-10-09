"use client";

/* ============================================================
   O POPOVER DE CORREÇÃO FOCADA

   Abre da barra de ações do gerador de vídeo, depois de um vídeo pronto.
   Uma pergunta só — "o que saiu errado?" — e um botão. O resultado não
   é gerado aqui: o prompt corrigido volta para o nó de texto ligado ao
   gerador (ou para o próprio gerador, quando não há texto ligado), e o
   usuário gera de novo quando quiser. Montar não gera, como sempre.

   Renderiza num portal, fora do nó: um textarea dentro do React Flow
   briga com o arrasto do canvas, e um véu fixo centralizado é o mesmo
   tratamento que o lightbox do vídeo já usa.
   ============================================================ */

import * as React from "react";
import { createPortal } from "react-dom";
import { MODEL_GROUPS } from "@/lib/models";
import { useChatSessionStore } from "@/lib/chatSessionStore";
import { gerarCorrecao } from "@/lib/correcaoFocada";

const EXEMPLOS = [
  "A mão está segurando o produto pela tampa",
  "O rótulo ficou de costas para a câmera",
  "Apareceu uma segunda garrafa na mesa",
  "Ela olha para o lado em vez de olhar para a câmera",
];

export function CorrecaoPopover({
  open,
  promptAtual,
  onAplicar,
  onClose,
}: {
  open: boolean;
  /** O prompt que gerou o vídeo — do nó de texto ligado, ou do próprio nó. */
  promptAtual: string;
  onAplicar: (promptCorrigido: string) => void;
  onClose: () => void;
}) {
  const preferido = useChatSessionStore(s => s.preferredModel);
  const [modelo, setModelo] = React.useState(preferido);
  const [queixa, setQueixa] = React.useState("");
  const [ocupado, setOcupado] = React.useState(false);
  const [erro, setErro] = React.useState("");
  const [resultado, setResultado] = React.useState("");

  React.useEffect(() => {
    if (!open) return;
    const tecla = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", tecla);
    return () => document.removeEventListener("keydown", tecla);
  }, [open, onClose]);

  if (!open || typeof document === "undefined") return null;

  const corrigir = async () => {
    if (ocupado) return;
    setOcupado(true); setErro("");
    try {
      setResultado(await gerarCorrecao(promptAtual, queixa, modelo));
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível gerar a correção.");
    } finally {
      setOcupado(false);
    }
  };

  const aplicar = () => {
    if (!resultado.trim()) return;
    onAplicar(resultado.trim());
    setResultado(""); setQueixa("");
    onClose();
  };

  const campo: React.CSSProperties = {
    width: "100%",
    padding: "8px 10px",
    border: "1px solid var(--ms-border-subtle)",
    borderRadius: 8,
    background: "var(--ms-bg)",
    color: "var(--ms-text)",
    font: "inherit",
    fontSize: 12,
    lineHeight: "18px",
    resize: "vertical",
  };
  const botao: React.CSSProperties = {
    height: 30,
    padding: "0 12px",
    border: "1px solid var(--ms-border-subtle)",
    borderRadius: 8,
    background: "var(--ms-bg)",
    color: "var(--ms-text)",
    font: "inherit",
    fontSize: 12,
    fontWeight: 500,
    cursor: "pointer",
  };

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center"
      style={{ background: "rgba(0,0,0,0.55)" }}
      onClick={onClose}
      onMouseDown={e => e.stopPropagation()}
    >
      <div
        role="dialog"
        aria-label="Corrigir o vídeo"
        className="nodrag nowheel"
        style={{
          width: "min(520px, 92vw)",
          maxHeight: "88vh",
          overflowY: "auto",
          padding: 18,
          borderRadius: 14,
          background: "var(--ms-bg-component, #16171b)",
          color: "var(--ms-text)",
          border: "1px solid var(--ms-border)",
          boxShadow: "0 24px 64px rgba(0,0,0,0.5)",
          display: "flex",
          flexDirection: "column",
          gap: 12,
        }}
        onClick={e => e.stopPropagation()}
      >
        <div>
          <div style={{ fontSize: 14, fontWeight: 600 }}>Corrigir só o que saiu errado</div>
          <p style={{ margin: "4px 0 0", fontSize: 12, lineHeight: "18px", color: "var(--ms-text-secondary)" }}>
            O prompt continua o mesmo e ganha um bloco FIX no fim. Nada é gerado agora: você gera de novo quando quiser.
          </p>
        </div>

        <label style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 12 }}>
          O que saiu errado?
          <textarea
            style={campo}
            rows={3}
            value={queixa}
            autoFocus
            disabled={ocupado}
            placeholder="Ex.: a mão segura o produto pela tampa e o rótulo não aparece"
            onChange={e => setQueixa(e.target.value)}
          />
        </label>

        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          {EXEMPLOS.map(ex => (
            <button
              key={ex}
              type="button"
              style={{ ...botao, height: 26, padding: "0 10px", fontWeight: 400, fontSize: 11, color: "var(--ms-text-secondary)" }}
              disabled={ocupado}
              onClick={() => setQueixa(ex)}
            >
              {ex}
            </button>
          ))}
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <select
            aria-label="Modelo do assistente"
            value={modelo}
            disabled={ocupado}
            onChange={e => setModelo(e.target.value)}
            style={{ ...botao, paddingRight: 8, flex: 1, minWidth: 160 }}
          >
            {MODEL_GROUPS.map(g => (
              <optgroup key={g.label} label={g.label}>
                {g.models.map(m => <option key={m.id} value={m.id}>{m.label}</option>)}
              </optgroup>
            ))}
          </select>
          <button
            type="button"
            style={{ ...botao, background: "var(--app-v2-button-bg, var(--ms-text))", color: "var(--app-v2-button-fg, var(--ms-bg))", borderColor: "transparent" }}
            disabled={ocupado || !queixa.trim() || !promptAtual.trim()}
            onClick={() => void corrigir()}
          >
            {ocupado ? "Gerando correção…" : "Gerar correção"}
          </button>
        </div>

        {!promptAtual.trim() && (
          <p style={{ margin: 0, fontSize: 12, color: "var(--ms-text-secondary)" }}>
            Este gerador não tem prompt. Ligue um nó de texto com o prompt que gerou o vídeo.
          </p>
        )}

        {erro && <p style={{ margin: 0, fontSize: 12, color: "#f87171" }}>{erro}</p>}

        {resultado && (
          <>
            <label style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 12 }}>
              Prompt corrigido (editável)
              <textarea style={campo} rows={10} value={resultado} onChange={e => setResultado(e.target.value)} />
            </label>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
              <button type="button" style={botao} onClick={onClose}>Cancelar</button>
              <button
                type="button"
                style={{ ...botao, background: "var(--app-v2-button-bg, var(--ms-text))", color: "var(--app-v2-button-fg, var(--ms-bg))", borderColor: "transparent" }}
                onClick={aplicar}
              >
                Aplicar no nó de texto
              </button>
            </div>
          </>
        )}
      </div>
    </div>,
    document.body,
  );
}
