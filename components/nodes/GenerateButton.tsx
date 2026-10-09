"use client";
import React, { useState } from "react";

interface Props {
  onClick: () => void;
  busy?: boolean;
  disabled?: boolean;
  extracting?: boolean;
  warningMessages?: string[];
}

export default function GenerateButton({ onClick, busy, disabled, extracting, warningMessages }: Props) {
  const [tooltipVisible, setTooltipVisible] = useState(false);
  const hasWarning = !!(warningMessages?.length);

  const bg = hasWarning
    ? "rgba(227, 26, 26,0.15)"
    : extracting
    ? "rgba(255, 181, 71,0.15)"
    : "rgba(134, 140, 255,0.18)";

  const border = hasWarning
    ? "1px solid rgba(227, 26, 26,0.45)"
    : extracting
    ? "1px solid rgba(255, 181, 71,0.45)"
    : "1px solid rgba(134, 140, 255,0.55)";

  return (
    <div
      style={{ position: "relative", flexShrink: 0 }}
      onMouseEnter={() => hasWarning && setTooltipVisible(true)}
      onMouseLeave={() => setTooltipVisible(false)}
    >
      <button
        onMouseDown={(e) => e.stopPropagation()}
        onClick={(e) => { e.stopPropagation(); onClick(); }}
        disabled={disabled || busy || extracting}
        className="h-7 px-3 rounded-lg flex items-center gap-1.5 transition-all disabled:opacity-50 hover:brightness-110"
        style={{
          background: bg,
          backdropFilter: "blur(10px)",
          WebkitBackdropFilter: "blur(10px)",
          border,
          cursor: disabled || busy || hasWarning ? "not-allowed" : "pointer",
        }}
      >
        {busy ? (
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none" style={{ animation: "spin 0.9s linear infinite" }}>
            <circle cx="5" cy="5" r="4" stroke="var(--ms-grayA-5-hex)" strokeWidth="1.5" />
            <path d="M5 1 A4 4 0 0 1 9 5" stroke="var(--ms-grayA-12-hex)" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        ) : extracting ? (
          <>
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none" style={{ animation: "spin 0.9s linear infinite", flexShrink: 0 }}>
              <circle cx="5" cy="5" r="4" stroke="rgba(255, 181, 71,0.25)" strokeWidth="1.5" />
              <path d="M5 1 A4 4 0 0 1 9 5" stroke="var(--ms-solid-warning)" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
            <span className="text-[11px] font-medium" style={{ color: "var(--ms-text-warning)" }}>Extracting…</span>
          </>
        ) : (
          <>
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke={hasWarning ? "var(--ms-text-danger)" : "var(--ms-grayA-12-hex)"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
              <line x1="22" y1="2" x2="11" y2="13" />
              <polygon points="22 2 15 22 11 13 2 9 22 2" />
            </svg>
            <span className="text-[11px] font-medium" style={{ color: hasWarning ? "var(--ms-text-danger)" : "var(--ms-grayA-12-hex)" }}>Generate</span>
          </>
        )}
      </button>

      {tooltipVisible && warningMessages && (
        <div
          style={{
            position: "absolute",
            bottom: "calc(100% + 5px)",
            right: 0,
            background: "var(--ms-bg)",
            border: "1px solid rgba(227, 26, 26,0.3)",
            borderRadius: 6,
            padding: "5px 9px",
            whiteSpace: "nowrap",
            fontSize: 11,
            color: "var(--ms-text)",
            boxShadow: "0 4px 14px rgba(0,0,0,0.55)",
            zIndex: 200,
            pointerEvents: "none",
          }}
        >
          {warningMessages.map((msg, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ color: "var(--ms-text-danger)", fontSize: 8 }}>●</span>
              {msg}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
