"use client";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useReactFlow } from "@xyflow/react";
import { useWorkflowStore, NodeData } from "@/lib/store";
import { NODES, NODE_META } from "@/lib/nodeTypes";
import { criarNo } from "@/lib/adicionarNo";
import { getToken } from "@/lib/galleryUtils";
import { MediaPickerModal } from "@/components/MediaPickerModal";
import PersonagemPickerMenu from "@/components/PersonagemPickerMenu";

import { Search, X, Upload, LayoutGrid, UserRound } from "@/components/icones";

/* Um retângulo de 1×1 não é um botão: é a posição de um cursor. É assim que
   o menu do botão direito diz "o nó nasce AQUI" sem mudar a assinatura que o
   `WorkflowCanvas` congelado usa. Ver `app/workflow/layout.tsx`. */
function ehCursor(r: DOMRect) { return r.width <= 1 && r.height <= 1; }

/* Node types replaced by Upload/Assets — hide from search results */
const HIDDEN_FROM_MENU = new Set(["imageInputNode", "videoInputNode"]);

const SECTIONS: Array<{ id: string; label: string; nodeTypes: string[] }> = [
  {
    id: "generators",
    label: "GERAÇÃO",
    nodeTypes: ["generateNode", "videoGeneratorNode", "assistantNode"],
  },
  { id: "production", label: "PRODUÇÃO", nodeTypes: ["audioNode", "scriptNode", "directorStudioNode", "smartEditNode", "smartBreakdownNode", "directorConsoleNode"] },
  {
    id: "resources",
    label: "RECURSOS",
    nodeTypes: ["promptNode"],
  },
  {
    id: "annotate",
    label: "ANOTAÇÕES",
    nodeTypes: ["commentNode"],
  },
];

interface AddNodeMenuProps {
  anchorRect: DOMRect;
  onClose: () => void;
}

export default function AddNodeMenu({ anchorRect, onClose }: AddNodeMenuProps) {
  const { screenToFlowPosition } = useReactFlow();

  const menuRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [focused, setFocused] = useState<string | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerPos, setPickerPos] = useState({ x: 0, y: 0 });
  /* O seletor de personagens abre ao lado da linha que o chamou. Enquanto
     está aberto, o clique fora dele não pode fechar ESTE menu. */
  const [personagensAnchor, setPersonagensAnchor] = useState<DOMRect | null>(null);

  useEffect(() => { searchRef.current?.focus(); }, []);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (pickerOpen || personagensAnchor) return;
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener("mousedown", handler, true);
    return () => document.removeEventListener("mousedown", handler, true);
  }, [onClose, pickerOpen, personagensAnchor]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      /* O seletor de personagens trata o próprio Esc; aqui só não fechamos junto. */
      if (personagensAnchor) return;
      if (pickerOpen) setPickerOpen(false); else onClose();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onClose, pickerOpen, personagensAnchor]);

  const q = query.trim().toLowerCase();
  const allNodes = NODES.filter((n) => !HIDDEN_FROM_MENU.has(n.type));
  const filtered = q
    ? allNodes.filter((n) => n.label.toLowerCase().includes(q) || n.description.toLowerCase().includes(q))
    : null;

  /* Cria o nó e fecha o menu. O posicionamento mora em `lib/adicionarNo.ts`
     desde a leva 5, porque a barra vertical passou a criar os mesmos tipos —
     duas cópias da mesma conta divergiriam. O comportamento para quem já
     chamava (o botão da barra) é o mesmo de antes: sem `ponto`, vale o
     posicionamento automático. */
  const addNextToToolbar = useCallback(
    (type: string, extraData?: Partial<NodeData>): string => {
      const nodeId = criarNo(type, screenToFlowPosition, {
        ponto: ehCursor(anchorRect) ? { x: anchorRect.left, y: anchorRect.top } : undefined,
        dados: extraData,
      });
      onClose();
      return nodeId;
    },
    [screenToFlowPosition, anchorRect, onClose],
  );

  /* Handle file selected via the Upload button */
  const handleFileSelected = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      e.target.value = "";

      const isVideo = file.type.startsWith("video/");
      const type = isVideo ? "videoInputNode" : "imageInputNode";
      const blobUrl = URL.createObjectURL(file);

      const nodeId = addNextToToolbar(type, isVideo ? { videoUrl: blobUrl } : { inputImage: blobUrl });

      if (!isVideo) {
        const img = new window.Image();
        img.onload = () => {
          useWorkflowStore.getState().updateNodeData(nodeId, {
            imageNaturalRatio: `${img.naturalWidth} / ${img.naturalHeight}`,
          });
        };
        img.src = blobUrl;
      }

      const bytes = await file.arrayBuffer();
      const token = await getToken();
      const headers: Record<string, string> = { "Content-Type": file.type || (isVideo ? "video/mp4" : "image/jpeg") };
      if (token) headers["Authorization"] = `Bearer ${token}`;
      try {
        const res = await fetch("/api/upload-asset", {
          method: "POST",
          headers,
          body: bytes,
        });
        const { cdnUrl } = await res.json() as { cdnUrl?: string };
        if (cdnUrl) {
          URL.revokeObjectURL(blobUrl);
          useWorkflowStore.getState().updateNodeData(
            nodeId,
            isVideo ? { videoUrl: cdnUrl } : { inputImage: cdnUrl, r2Url: cdnUrl },
          );
        }
      } catch {
        // blob URL stays as fallback until page reload
      }
    },
    [addNextToToolbar],
  );

  /* Handle asset selected from the picker */
  const handleAssetPick = useCallback(
    async (url: string, mediaType: "image" | "video") => {
      setPickerOpen(false);
      if (mediaType === "image") {
        const thumbnailSrc = url;
        const ratio = await new Promise<string | undefined>((resolve) => {
          const img = new window.Image();
          let done = false;
          const finish = () => {
            if (done) return;
            done = true;
            resolve(img.naturalWidth && img.naturalHeight
              ? `${img.naturalWidth} / ${img.naturalHeight}`
              : undefined);
          };
          img.onload = finish;
          img.onerror = () => { done = true; resolve(undefined); };
          img.src = thumbnailSrc;
          if (img.complete && img.naturalWidth > 0) finish();
        });
        addNextToToolbar("imageInputNode", {
          inputImage: url,
          r2Url: url,
          ...(ratio ? { imageNaturalRatio: ratio } : {}),
        });
      } else {
        addNextToToolbar("videoInputNode", { videoUrl: url });
      }
    },
    [addNextToToolbar],
  );

  /* Menu position

     Ancorado num BOTÃO, o menu abre ao lado dele e centrado na sua altura —
     é o comportamento de sempre, e o `WorkflowCanvas` congelado depende dele.
     Ancorado no CURSOR (retângulo de 1×1), ele abre a partir do ponto, como
     todo menu de contexto, sempre dentro da janela. */
  const MENU_W = 280;
  const MENU_MAX_H = 460;
  const noCursor = ehCursor(anchorRect);
  const leftRaw = anchorRect.right + 10;
  const left = noCursor
    ? Math.max(12, Math.min(leftRaw, window.innerWidth - MENU_W - 12))
    : leftRaw;
  const topRaw = noCursor
    ? anchorRect.top
    : anchorRect.top + anchorRect.height / 2 - MENU_MAX_H / 2;
  const top = Math.max(12, Math.min(topRaw, window.innerHeight - MENU_MAX_H - 12));

  const ROW_STYLE = (isHovered: boolean) => ({
    display: "flex" as const,
    alignItems: "center" as const,
    gap: "12px",
    width: "100%",
    padding: "9px 14px",
    background: isHovered ? "var(--ms-bg-brand-subtle)" : "transparent",
    border: "1px solid transparent",
    cursor: "pointer",
    textAlign: "left" as const,
    transition: "background 120ms ease, border-color 120ms ease",
    borderRadius: "8px",
  });

  function NodeRow({ nodeType }: { nodeType: string }) {
    const node = allNodes.find((n) => n.type === nodeType);
    if (!node) return null;
    const meta = NODE_META[nodeType];
    const isHovered = focused === nodeType;

    return (
      <button
        key={nodeType}
        id={`add-node-${nodeType}`}
        onMouseEnter={() => setFocused(nodeType)}
        onMouseLeave={() => setFocused(null)}
        onClick={() => addNextToToolbar(nodeType)}
        style={ROW_STYLE(isHovered)}
      >
        <span style={{
          flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center",
          width: "34px", height: "34px", borderRadius: "9px",
          background: `${meta?.accent ?? "#6b7280"}14`,
          color: meta?.accent ?? "var(--ms-icon-secondary)",
          border: `1px solid ${meta?.accent ?? "#6b7280"}30`,
        }}>
          {meta?.bigIcon ?? node.icon}
        </span>
        <span style={{ display: "flex", flexDirection: "column", gap: "2px", minWidth: 0 }}>
          <span style={{ fontSize: "13px", fontWeight: 600, color: "var(--ms-text)", lineHeight: 1.2, transition: "color 120ms ease" }}>
            {node.label}
          </span>
          <span style={{ fontSize: "11px", color: "var(--ms-text-secondary)", lineHeight: 1.3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {node.description}
          </span>
        </span>
        {isHovered && (
          <span style={{ marginLeft: "auto", flexShrink: 0, fontSize: "10px", color: "var(--ms-text-secondary)", background: "var(--ms-bg)", border: "1px solid var(--ms-border)", borderRadius: "4px", padding: "2px 5px", fontFamily: "monospace" }}>
            ↵
          </span>
        )}
      </button>
    );
  }

  function CustomRow({
    id,
    icon,
    accent,
    bg,
    label,
    description,
    onClick,
  }: {
    id: string;
    icon: React.ReactNode;
    accent: string;
    bg: string;
    label: string;
    description: string;
    onClick: (e: React.MouseEvent) => void;
  }) {
    const isHovered = focused === id;
    return (
      <button
        onMouseEnter={() => setFocused(id)}
        onMouseLeave={() => setFocused(null)}
        onClick={onClick}
        style={ROW_STYLE(isHovered)}
      >
        <span style={{
          flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center",
          width: "34px", height: "34px", borderRadius: "9px",
          background: `${accent}14`, color: accent,
          border: `1px solid ${accent}30`,
        }}>
          {icon}
        </span>
        <span style={{ display: "flex", flexDirection: "column", gap: "2px", minWidth: 0 }}>
          <span style={{ fontSize: "13px", fontWeight: 600, color: "var(--ms-text)", lineHeight: 1.2, transition: "color 120ms ease" }}>
            {label}
          </span>
          <span style={{ fontSize: "11px", color: "var(--ms-text-secondary)", lineHeight: 1.3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {description}
          </span>
        </span>
      </button>
    );
  }

  const menu = (
    <>
      {/* Hidden file input for Upload */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*,video/*"
        className="hidden"
        onChange={handleFileSelected}
      />

      <div
        id="add-node-menu"
        ref={menuRef}
        onMouseDown={(e) => e.stopPropagation()}
        style={{
          position: "fixed", left, top, width: MENU_W, maxHeight: MENU_MAX_H, zIndex: 99999,
          display: "flex", flexDirection: "column",
          background: "color-mix(in srgb, var(--ms-bg) 96%, transparent)",
          backdropFilter: "blur(24px)", WebkitBackdropFilter: "blur(24px)",
          border: "1px solid var(--ms-border)", borderRadius: "16px",
          boxShadow: "0 22px 54px rgba(42, 31, 74, 0.16), 0 5px 16px rgba(42, 31, 74, 0.08)",
          overflow: "hidden",
          animation: "addMenuIn 160ms cubic-bezier(0.22,1,0.36,1) both",
        }}
      >
        <style>{`
          @keyframes addMenuIn {
            from { opacity: 0; transform: translateX(-10px) scale(0.96); }
            to   { opacity: 1; transform: translateX(0) scale(1); }
          }
          #add-node-search::placeholder { color: var(--ms-text-placeholder); opacity: 1; }
          #add-node-menu button:focus-visible {
            outline: 2px solid var(--ms-ring);
            outline-offset: -2px;
          }
        `}</style>

        {/* Search bar */}
        <div style={{ display: "flex", alignItems: "center", gap: "8px", padding: "11px 14px", borderBottom: "1px solid var(--ms-border-subtle)", background: "var(--ms-bg-subtle)" }}>
          <Search size={14} color="var(--ms-icon-secondary)" />
          <input
            ref={searchRef}
            id="add-node-search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar nodes…"
            style={{ flex: 1, background: "transparent", border: "none", outline: "none", color: "var(--ms-text)", fontSize: "13px", caretColor: "var(--ms-solid-brand)" }}
          />
          {query && (
            <button onClick={() => setQuery("")} aria-label="Limpar busca" style={{ background: "transparent", border: "none", cursor: "pointer", color: "var(--ms-icon-secondary)", padding: 0, lineHeight: 1 }}>
              <X size={14} />
            </button>
          )}
        </div>

        {/* Node list */}
        <div style={{ overflowY: "auto", flex: 1, padding: "8px" }}>
          {filtered ? (
            filtered.length === 0 ? (
              <p style={{ fontSize: "12px", color: "var(--ms-text-secondary)", textAlign: "center", padding: "24px 0" }}>
                Nenhum node corresponde a &ldquo;{query}&rdquo;
              </p>
            ) : (
              filtered.map((n) => <NodeRow key={n.type} nodeType={n.type} />)
            )
          ) : (
            SECTIONS.map((section) => (
              <div key={section.id} style={{ marginBottom: "4px" }}>
                <p style={{ fontSize: "10px", fontWeight: 700, letterSpacing: "0.08em", color: "var(--ms-text-tertiary)", padding: "8px 14px 4px", margin: 0 }}>
                  {section.label}
                </p>
                {section.nodeTypes.map((t) => <NodeRow key={t} nodeType={t} />)}
                {section.id === "resources" && (
                  <>
                    <CustomRow
                      id="upload"
                      label="Upload"
                      description="Image or video — auto-detects type"
                      accent="#01b574"
                      bg="#05261c"
                      icon={<Upload size={18} strokeWidth={1.8} />}
                      onClick={() => fileInputRef.current?.click()}
                    />
                    <CustomRow
                      id="assets"
                      label="Assets"
                      description="Browse your generations & uploads"
                      accent="#1b84ff"
                      bg="#16162b"
                      icon={<LayoutGrid size={18} strokeWidth={1.8} />}
                      onClick={(e) => {
                        setPickerPos({ x: e.clientX, y: e.clientY });
                        setPickerOpen(true);
                      }}
                    />
                    <CustomRow
                      id="personagens"
                      label="Personagens"
                      description="Retrato ou descrição do seu elenco"
                      accent="#a855f7"
                      bg="#2a1f4a"
                      icon={<UserRound size={18} strokeWidth={1.8} />}
                      onClick={(e) => setPersonagensAnchor(e.currentTarget.getBoundingClientRect())}
                    />
                  </>
                )}
              </div>
            ))
          )}
        </div>

        {/* Bottom hint bar */}
        <div style={{ display: "flex", alignItems: "center", gap: "12px", padding: "8px 14px", borderTop: "1px solid var(--ms-border-subtle)", background: "var(--ms-bg-subtle)", fontSize: "11px", color: "var(--ms-text-secondary)" }}>
          <span><kbd style={{ fontFamily: "monospace", opacity: 0.7 }}>↑↓</kbd> Navigate</span>
          <span><kbd style={{ fontFamily: "monospace", opacity: 0.7 }}>↵</kbd> Insert</span>
          <span style={{ marginLeft: "auto" }}><kbd style={{ fontFamily: "monospace", opacity: 0.7 }}>Esc</kbd> Close</span>
        </div>
      </div>

      <MediaPickerModal
        open={pickerOpen}
        mediaKind="any"
        onClose={() => setPickerOpen(false)}
        onPickUrl={handleAssetPick}
        x={pickerPos.x}
        y={pickerPos.y}
      />

      {personagensAnchor && (
        <PersonagemPickerMenu
          anchorRect={personagensAnchor}
          onClose={() => setPersonagensAnchor(null)}
          /* `addNextToToolbar` respeita o ponto do cursor quando o menu veio
             do botão direito, e fecha este menu depois de criar. */
          onCriarNo={(tipo, dados) => { addNextToToolbar(tipo, dados); }}
        />
      )}
    </>
  );

  return createPortal(menu, document.body);
}
