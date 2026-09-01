"use client";
import React, { useState, useEffect } from "react";
import { X, Copy, Check, Globe, Lock } from "lucide-react";
import { useWorkflowStore } from "@/lib/store";

interface ShareModalProps {
  spaceId: string;
  open: boolean;
  onClose: () => void;
}

export default function ShareModal({ spaceId, open, onClose }: ShareModalProps) {
  const spaces = useWorkflowStore((s) => s.spaces);
  const setSpacePublic = useWorkflowStore((s) => s.setSpacePublic);
  const space = spaces.find((sp) => sp.id === spaceId);
  const isPublic = space?.isPublic ?? false;

  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const publicUrl = typeof window !== "undefined"
    ? `${window.location.origin}/public/workflow/${spaceId}`
    : `/public/workflow/${spaceId}`;

  useEffect(() => {
    if (!open) { setError(null); setCopied(false); }
  }, [open]);

  if (!open) return null;

  async function togglePublic() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/spaces/publish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: spaceId, isPublic: !isPublic }),
      });
      if (!res.ok) throw new Error(await res.text());
      setSpacePublic(spaceId, !isPublic);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to update");
    } finally {
      setLoading(false);
    }
  }

  function copyLink() {
    navigator.clipboard.writeText(publicUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <div
      style={{
        position: "fixed", inset: 0, zIndex: 1000,
        display: "flex", alignItems: "center", justifyContent: "center",
        background: "rgba(0,0,0,0.6)",
        backdropFilter: "blur(4px)", WebkitBackdropFilter: "blur(4px)",
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        style={{
          width: 420, maxWidth: "90vw",
          background: "rgba(13,13,15,0.97)",
          border: "1px solid rgba(255,255,255,0.08)",
          borderRadius: 16,
          boxShadow: "0 24px 64px rgba(0,0,0,0.7)",
          padding: "24px",
          display: "flex", flexDirection: "column", gap: 20,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span style={{ color: "#fff", fontWeight: 600, fontSize: 15 }}>Share Workflow</span>
          <button
            onClick={onClose}
            style={{
              background: "transparent", border: "none", cursor: "pointer",
              color: "rgba(255,255,255,0.4)", padding: 4, borderRadius: 6,
              display: "flex", alignItems: "center", justifyContent: "center",
              transition: "color 150ms",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.color = "rgba(255,255,255,0.8)")}
            onMouseLeave={(e) => (e.currentTarget.style.color = "rgba(255,255,255,0.4)")}
          >
            <X size={16} />
          </button>
        </div>

        {/* Status + toggle */}
        <div
          style={{
            display: "flex", alignItems: "center", justifyContent: "space-between",
            padding: "14px 16px",
            background: "rgba(255,255,255,0.04)",
            border: "1px solid rgba(255,255,255,0.07)",
            borderRadius: 12,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            {isPublic
              ? <Globe size={16} style={{ color: "#2DD4BF" }} />
              : <Lock size={16} style={{ color: "rgba(255,255,255,0.4)" }} />
            }
            <div>
              <div style={{ color: "#fff", fontSize: 13, fontWeight: 500 }}>
                {isPublic ? "Public" : "Private"}
              </div>
              <div style={{ color: "rgba(255,255,255,0.4)", fontSize: 12, marginTop: 2 }}>
                {isPublic
                  ? "Anyone with the link can view"
                  : "Only you can access this workflow"}
              </div>
            </div>
          </div>
          <button
            onClick={togglePublic}
            disabled={loading}
            style={{
              height: 28, padding: "0 14px",
              borderRadius: 8, border: "none", cursor: loading ? "wait" : "pointer",
              fontSize: 12, fontWeight: 500,
              transition: "background 150ms, color 150ms, opacity 150ms",
              opacity: loading ? 0.6 : 1,
              background: isPublic ? "rgba(255,255,255,0.08)" : "rgba(45,212,191,0.15)",
              color: isPublic ? "rgba(255,255,255,0.7)" : "#2DD4BF",
            }}
          >
            {loading ? "…" : isPublic ? "Make Private" : "Make Public"}
          </button>
        </div>

        {error && (
          <div style={{ color: "#f87171", fontSize: 12, padding: "0 4px" }}>{error}</div>
        )}

        {/* Link copy — only visible when public */}
        {isPublic && (
          <div style={{ display: "flex", gap: 8 }}>
            <div
              style={{
                flex: 1, padding: "10px 12px",
                background: "rgba(255,255,255,0.04)",
                border: "1px solid rgba(255,255,255,0.07)",
                borderRadius: 10, fontSize: 12,
                color: "rgba(255,255,255,0.6)",
                overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
              }}
            >
              {publicUrl}
            </div>
            <button
              onClick={copyLink}
              title={copied ? "Copied!" : "Copy link"}
              style={{
                width: 40, borderRadius: 10,
                border: "1px solid rgba(255,255,255,0.07)",
                background: copied ? "rgba(45,212,191,0.15)" : "rgba(255,255,255,0.06)",
                color: copied ? "#2DD4BF" : "rgba(255,255,255,0.7)",
                cursor: "pointer", display: "flex", alignItems: "center",
                justifyContent: "center", transition: "background 150ms, color 150ms",
                flexShrink: 0,
              }}
            >
              {copied ? <Check size={15} /> : <Copy size={15} />}
            </button>
          </div>
        )}

        {/* Footer note */}
        <p style={{ color: "rgba(255,255,255,0.3)", fontSize: 11, margin: 0 }}>
          The public view is read-only — visitors can pan and zoom but cannot edit or generate.
        </p>
      </div>
    </div>
  );
}
