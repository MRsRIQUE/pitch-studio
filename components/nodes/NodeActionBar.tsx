"use client";
import React from "react";
import { NodeToolbar, Position } from "@xyflow/react";

interface Props {
  visible: boolean;
  hasContent: boolean;
  isSaving?: boolean;
  onPreview?: () => void;
  onDelete: () => void;
  onSave?: () => void;
  onDuplicate: () => void;
  /** Correção focada: abre o popover que acrescenta um bloco FIX ao prompt. */
  onFix?: () => void;
}

function Btn({
  onClick,
  disabled,
  title,
  danger,
  children,
}: {
  onClick: () => void;
  disabled?: boolean;
  title: string;
  danger?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      onMouseDown={(e) => e.stopPropagation()}
      onClick={(e) => { e.stopPropagation(); if (!disabled) onClick(); }}
      disabled={disabled}
      title={title}
      className={`w-7 h-7 flex items-center justify-center rounded-full transition-colors duration-150 disabled:opacity-30 disabled:cursor-not-allowed ${ danger ? "text-ms-text-secondary hover:text-red-500 hover:bg-red-500/10" : "text-ms-text-secondary hover:text-ms-text hover:bg-ms-bg-hover" }`}
    >
      {children}
    </button>
  );
}

function Spinner() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeOpacity="0.2" />
      <path d="M12 2 A10 10 0 0 1 22 12" style={{ animation: "spin 0.75s linear infinite" }} />
    </svg>
  );
}

export default function NodeActionBar({ visible, hasContent, isSaving, onPreview, onDelete, onSave, onDuplicate, onFix }: Props) {
  return (
    <NodeToolbar isVisible={visible} position={Position.Top} offset={16}>
      <div
        /* Cápsula clara, a mesma da barra vertical: ver `.canvas-pilula` em
           `app/globals.css`. A versão escura sumia no canvas claro. */
        className="canvas-pilula flex items-center gap-0.5 px-1.5 py-1 node-action-bar-enter"
        style={{ zIndex: 10 }}
      >
        {onPreview !== undefined && (
          <Btn onClick={onPreview} disabled={!hasContent} title="Open preview">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 3 21 3 21 9" />
              <polyline points="9 21 3 21 3 15" />
              <line x1="21" y1="3" x2="14" y2="10" />
              <line x1="3" y1="21" x2="10" y2="14" />
            </svg>
          </Btn>
        )}

        {onFix !== undefined && (
          <Btn onClick={onFix} disabled={!hasContent} title="Corrigir só o que saiu errado">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M15 4V2M15 16v-2M8 9h2M20 9h2M17.8 11.8L19 13M15 9h.01M17.8 6.2L19 5M3 21l9-9M12.2 6.2L11 5" />
            </svg>
          </Btn>
        )}

        <span className="canvas-pilula-sep" />

        <Btn onClick={onDuplicate} title="Duplicate node">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
          </svg>
        </Btn>

        <Btn onClick={onDelete} title="Delete node" danger>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="3 6 5 6 21 6" />
            <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
            <path d="M10 11v6M14 11v6" />
            <path d="M9 6V4h6v2" />
          </svg>
        </Btn>

        {onSave !== undefined && (
          <Btn onClick={onSave} disabled={!hasContent || isSaving} title={isSaving ? "Downloading…" : "Save to disk"}>
            {isSaving ? <Spinner /> : (
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="7 10 12 15 17 10" />
                <line x1="12" y1="15" x2="12" y2="3" />
              </svg>
            )}
          </Btn>
        )}
      </div>
    </NodeToolbar>
  );
}
