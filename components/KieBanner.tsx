"use client";
import { useWorkflowStore } from "@/lib/store";

/**
 * Pitch Studio: com o provider simulado ativo a geração NÃO está desativada —
 * ela roda com mídia de placeholder. O banner muda de tom e de texto para não
 * afirmar algo falso. Ver lib/mockProvider.ts.
 */
const MOCK_ON = process.env.NEXT_PUBLIC_MOCK_GENERATION !== "false";

export default function KieBanner() {
  const kieKeySet = useWorkflowStore((s) => s.kieKeySet);
  const setSettingsOpen = useWorkflowStore((s) => s.setSettingsOpen);

  if (kieKeySet !== false) return null;

  if (MOCK_ON) {
    return (
      <button
        onClick={() => setSettingsOpen(true)}
        style={{
          width: "100%",
          flexShrink: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: "8px",
          padding: "9px 16px",
          background: "rgba(134, 140, 255,0.12)",
          border: "none",
          borderBottom: "1px solid rgba(134, 140, 255,0.3)",
          cursor: "pointer",
          transition: "background 150ms",
        }}
        onMouseEnter={e => { e.currentTarget.style.background = "rgba(134, 140, 255,0.18)"; }}
        onMouseLeave={e => { e.currentTarget.style.background = "rgba(134, 140, 255,0.12)"; }}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="rgba(134, 140, 255,0.9)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
          <circle cx="12" cy="12" r="10" />
          <line x1="12" y1="16" x2="12" y2="12" />
          <line x1="12" y1="8" x2="12.01" y2="8" />
        </svg>
        <span style={{ fontSize: "12px", color: "rgba(134, 140, 255,0.95)", fontWeight: 500 }}>
          Modo simulado — a geração produz mídia de placeholder, não imagens reais.
        </span>
        <span style={{
          fontSize: "11px", fontWeight: 600, color: "rgba(134, 140, 255,0.75)",
          background: "rgba(134, 140, 255,0.12)", border: "1px solid rgba(134, 140, 255,0.25)",
          borderRadius: "5px", padding: "2px 8px", marginLeft: "4px",
        }}>
          Adicionar chave kie.ai →
        </span>
      </button>
    );
  }

  return (
    <button
      onClick={() => setSettingsOpen(true)}
      style={{
        width: "100%",
        flexShrink: 0,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: "8px",
        padding: "9px 16px",
        background: "rgba(227, 26, 26,0.12)",
        borderTop: "none",
        borderBottom: "1px solid rgba(227, 26, 26,0.3)",
        borderLeft: "none",
        borderRight: "none",
        cursor: "pointer",
        transition: "background 150ms",
      }}
      onMouseEnter={e => { e.currentTarget.style.background = "rgba(227, 26, 26,0.18)"; }}
      onMouseLeave={e => { e.currentTarget.style.background = "rgba(227, 26, 26,0.12)"; }}
    >
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="rgba(227, 26, 26,0.9)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
        <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
        <line x1="12" y1="9" x2="12" y2="13" />
        <line x1="12" y1="17" x2="12.01" y2="17" />
      </svg>
      <span style={{ fontSize: "12px", color: "rgba(227, 26, 26,0.9)", fontWeight: 500 }}>
        No Kie.ai API key configured — generation is disabled.
      </span>
      <span style={{
        fontSize: "11px", fontWeight: 600, color: "rgba(227, 26, 26,0.7)",
        background: "rgba(227, 26, 26,0.12)", border: "1px solid rgba(227, 26, 26,0.25)",
        borderRadius: "5px", padding: "2px 8px", marginLeft: "4px",
      }}>
        Add in Settings →
      </span>
    </button>
  );
}
