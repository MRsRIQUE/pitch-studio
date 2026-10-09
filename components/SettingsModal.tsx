"use client";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { IMAGE_MODELS, VIDEO_MODELS } from "@/lib/modelConfig";
import { MODEL_GROUPS } from "@/lib/models";
import { useWorkflowStore } from "@/lib/store";
import { PROVIDERS, ProviderId, loadModelProviders, saveModelProviders, getModelProvider } from "@/lib/providers";

/* ─── Provider options (re-exported for backwards compat) ───────────────────── */

export { PROVIDERS, loadModelProviders, saveModelProviders, getModelProvider };
export type { ProviderId };

export type CodexStatus =
  | { kind: "unknown" }
  | { kind: "ready" }
  | { kind: "not_ready"; installed: boolean; authFound: boolean };

/* ─── Persistência ───────────────────────────────────────────────────────────
   Movida para `lib/azureSettings.ts`. `app/chat/page.tsx` e
   `components/QuickAssist.tsx` importavam estas funções de dentro deste
   arquivo, o que acoplava duas telas a um modal de 1.696 linhas. A
   reexportação mantém esses imports funcionando. */

import {
  loadAzureEndpoints,
  saveAzureEndpoints,
  loadAzureBaseUrl,
  saveAzureBaseUrl,
  loadAzureTextDeployment,
  saveAzureTextDeployment,
  loadAzureTextModelName,
  saveAzureTextModelName,
} from "@/lib/azureSettings";

/* Um `export … from` não traz os nomes para o escopo local, e este modal
   usa oito deles nos próprios handlers — por isso o import acima além da
   reexportação abaixo. */
export {
  loadAzureEndpoints,
  saveAzureEndpoints,
  getAzureDeployment,
  getAzureEndpoint,
  loadAzureBaseUrl,
  saveAzureBaseUrl,
  loadAzureTextDeployment,
  saveAzureTextDeployment,
  loadAzureTextModelName,
  saveAzureTextModelName,
} from "@/lib/azureSettings";

/* ─── Nav items ─────────────────────────────────────────────────────────────── */

const IS_DEBUG = process.env.NEXT_PUBLIC_DEBUG === "true";

type NavId = "api-keys" | "image-models" | "video-models" | "text-models" | "debug";

const NAV_BASE: { id: NavId; label: string; icon: React.ReactNode }[] = [
  {
    id: "api-keys",
    label: "Chaves de API",
    icon: (
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="8" cy="15" r="4" />
        <path d="m11.31 11.31 5.19-5.19" />
        <path d="m17 5 1.5 1.5" />
        <path d="m14 8 1.5 1.5" />
      </svg>
    ),
  },
  {
    id: "image-models",
    label: "Modelos de imagem",
    icon: (
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="18" height="18" rx="2" />
        <circle cx="8.5" cy="8.5" r="1.5" />
        <path d="m21 15-5-5L5 21" />
      </svg>
    ),
  },
  {
    id: "video-models",
    label: "Modelos de vídeo",
    icon: (
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="m22 8-6 4 6 4V8z" />
        <rect x="2" y="6" width="14" height="12" rx="2" />
      </svg>
    ),
  },
  {
    id: "text-models",
    label: "Modelos de texto",
    icon: (
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
      </svg>
    ),
  },
];

const DEBUG_NAV_ITEM: { id: NavId; label: string; icon: React.ReactNode } = {
  id: "debug",
  label: "Depuração",
  icon: (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z" />
      <path d="M12 8v4" />
      <path d="M12 16h.01" />
    </svg>
  ),
};

const NAV = IS_DEBUG ? [...NAV_BASE, DEBUG_NAV_ITEM] : NAV_BASE;

/* ─── Props ─────────────────────────────────────────────────────────────────── */

interface SettingsModalProps {
  onClose: () => void;
}

/* ─── Provider brand icons (kie/azure/codex backend pills) ───────────────────── */

function ProviderBrandIcon({ id, size = 12 }: { id: ProviderId; size?: number }) {
  if (id === "kie") {
    return (
      <span className="text-ms-text-brand shrink-0" style={{ display: "flex", alignItems: "center", justifyContent: "center", width: `${size}px`, height: `${size}px`, fontSize: `${Math.round(size * 0.83)}px`, fontWeight: 700 }}>
        K
      </span>
    );
  }
  if (id === "codex") {
    return (
      <svg className="text-ms-text-brand shrink-0" width={size} height={size} viewBox="0 0 24 24" fill="currentColor" fillRule="evenodd">
        <path d="M9.205 8.658v-2.26c0-.19.072-.333.238-.428l4.543-2.616c.619-.357 1.356-.523 2.117-.523 2.854 0 4.662 2.212 4.662 4.566 0 .167 0 .357-.024.547l-4.71-2.759a.797.797 0 00-.856 0l-5.97 3.473zm10.609 8.8V12.06c0-.333-.143-.57-.429-.737l-5.97-3.473 1.95-1.118a.433.433 0 01.476 0l4.543 2.617c1.309.76 2.189 2.378 2.189 3.948 0 1.808-1.07 3.473-2.76 4.163zM7.802 12.703l-1.95-1.142c-.167-.095-.239-.238-.239-.428V5.899c0-2.545 1.95-4.472 4.591-4.472 1 0 1.927.333 2.712.928L8.23 5.067c-.285.166-.428.404-.428.737v6.898zM12 15.128l-2.795-1.57v-3.33L12 8.658l2.795 1.57v3.33L12 15.128zm1.796 7.23c-1 0-1.927-.332-2.712-.927l4.686-2.712c.285-.166.428-.404.428-.737v-6.898l1.974 1.142c.167.095.238.238.238.428v5.233c0 2.545-1.974 4.472-4.614 4.472zm-5.637-5.303l-4.544-2.617c-1.308-.761-2.188-2.378-2.188-3.948A4.482 4.482 0 014.21 6.327v5.423c0 .333.143.571.428.738l5.947 3.449-1.95 1.118a.432.432 0 01-.476 0zm-.262 3.9c-2.688 0-4.662-2.021-4.662-4.519 0-.19.024-.38.047-.57l4.686 2.71c.286.167.571.167.856 0l5.97-3.448v2.26c0 .19-.07.333-.237.428l-4.543 2.616c-.619.357-1.356.523-2.117.523zm5.899 2.83a5.947 5.947 0 005.827-4.756C22.287 18.339 24 15.84 24 13.296c0-1.665-.713-3.282-1.998-4.448.119-.5.19-.999.19-1.498 0-3.401-2.759-5.947-5.946-5.947-.642 0-1.26.095-1.88.31A5.962 5.962 0 0010.205 0a5.947 5.947 0 00-5.827 4.757C1.713 5.447 0 7.945 0 10.49c0 1.666.713 3.283 1.998 4.448-.119.5-.19 1-.19 1.499 0 3.401 2.759 5.946 5.946 5.946.642 0 1.26-.095 1.88-.309a5.96 5.96 0 004.162 1.713z" />
      </svg>
    );
  }
  if (id === "azure") {
    return (
      <svg className="shrink-0" width={size} height={size} viewBox="0 0 256 199">
        <path d="M118.432 187.698c32.89-5.81 60.055-10.618 60.367-10.684l.568-.12l-31.052-36.935c-17.078-20.314-31.051-37.014-31.051-37.11c0-.182 32.063-88.477 32.243-88.792c.06-.105 21.88 37.567 52.893 91.32c29.035 50.323 52.973 91.815 53.195 92.203l.405.707l-98.684-.012l-98.684-.013l59.8-10.564zM0 176.435c0-.052 14.631-25.451 32.514-56.442l32.514-56.347l37.891-31.799C123.76 14.358 140.867.027 140.935.001c.069-.026-.205.664-.609 1.534s-18.919 40.582-41.145 88.25l-40.41 86.67l-29.386.037c-16.162.02-29.385-.005-29.385-.057z" fill="var(--signal-info)" fillRule="nonzero" />
      </svg>
    );
  }
  return null;
}

/* ─── Toggle ─────────────────────────────────────────────────────────────────── */

function ProviderToggle({
  modelId,
  value,
  onChange,
}: {
  modelId: string;
  value: ProviderId;
  onChange: (v: ProviderId) => void;
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        background: "var(--ms-bg-component)",
        borderRadius: "8px",
        padding: "3px",
        gap: "2px",
        border: "1px solid var(--ms-border-subtle)",
        flexShrink: 0,
      }}
    >
      {PROVIDERS.map((p) => {
        const active = value === p.id;
        return (
          <button
            key={p.id}
            id={`provider-${modelId}-${p.id}`}
            onClick={() => onChange(p.id)}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "5px",
              padding: "4px 10px",
              borderRadius: "6px",
              border: "none",
              cursor: "pointer",
              fontSize: "11px",
              fontWeight: 500,
              letterSpacing: "0.01em",
              transition: "background 140ms ease, color 140ms ease",
              background: active ? "var(--ms-bg-component-active)" : "transparent",
              color: active ? "var(--ms-text)" : "var(--ms-text-tertiary)",
              whiteSpace: "nowrap",
            }}
          >
            <ProviderBrandIcon id={p.id} />
            {p.label}
          </button>
        );
      })}
    </div>
  );
}

/* ─── Model row ─────────────────────────────────────────────────────────────── */

function ModelRow({
  id,
  name,
  providerLabel,
  category,
  value,
  onChange,
  azureSupported,
}: {
  id: string;
  name: string;
  providerLabel: string;
  category: string;
  value: ProviderId;
  onChange: (v: ProviderId) => void;
  azureSupported: boolean;
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: "14px",
        padding: "11px 16px",
        borderRadius: "10px",
        background: "var(--ms-bg-subtle)",
        border: "1px solid var(--ms-border-subtle)",
      }}
    >
      {/* Labels */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontSize: "13px",
            fontWeight: 500,
            color: "var(--ms-text)",
            lineHeight: 1.3,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {name}
        </div>
        <div
          style={{
            fontSize: "11px",
            color: "var(--ms-text-placeholder)",
            marginTop: "2px",
          }}
        >
          {providerLabel} · {category}
        </div>
      </div>

      {/* Provider toggle — only shown for models with more than one backend to choose from */}
      {azureSupported && <ProviderToggle modelId={id} value={value} onChange={onChange} />}
    </div>
  );
}

/* ─── Section group ─────────────────────────────────────────────────────────── */

function ModelGroup({
  title,
  accent,
  models,
  providers,
  onProviderChange,
  azureDeployments,
  onDeploymentChange,
}: {
  title: string;
  accent: string;
  models: { id: string; name: string; provider: string; category: string; hasAzureDeployment?: boolean }[];
  providers: Record<string, ProviderId>;
  onProviderChange: (modelId: string, v: ProviderId) => void;
  azureDeployments: Record<string, string>;
  onDeploymentChange: (modelId: string, v: string) => void;
}) {
  return (
    <div>
      {/* Group header */}
      <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "10px" }}>
        <span style={{ display: "inline-block", width: "6px", height: "6px", borderRadius: "50%", background: accent, flexShrink: 0 }} />
        <span style={{ fontSize: "11px", fontWeight: 600, letterSpacing: "0.08em", color: "var(--ms-text-tertiary)", textTransform: "uppercase" }}>
          {title}
        </span>
      </div>

      {/* Rows */}
      <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
        {models.map((m) => (
          <div key={m.id} style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
            <ModelRow
              id={m.id}
              name={m.name}
              providerLabel={m.provider}
              category={m.category}
              value={providers[m.id] ?? "kie"}
              onChange={(v) => onProviderChange(m.id, v)}
              azureSupported={!!m.hasAzureDeployment}
            />
            {/* Deployment name — shown only for Azure-capable models when Azure is selected */}
            {m.hasAzureDeployment && (providers[m.id] ?? "kie") === "azure" && (
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "6px",
                  padding: "10px 14px",
                  background: "color-mix(in srgb, var(--signal-info) 8%, var(--ms-bg))",
                  border: "1px solid color-mix(in srgb, var(--signal-info) 18%, transparent)",
                  borderRadius: "10px",
                }}
              >
                <label
                  htmlFor={`azure-deploy-${m.id}`}
                  style={{ fontSize: "11px", fontWeight: 600, color: "var(--signal-info)", letterSpacing: "0.05em", textTransform: "uppercase" }}
                >
                  Nome do deployment
                </label>
                <input
                  id={`azure-deploy-${m.id}`}
                  type="text"
                  placeholder={`e.g. ${m.id}`}
                  value={azureDeployments[m.id] ?? ""}
                  onChange={(e) => onDeploymentChange(m.id, e.target.value)}
                  style={{
                    background: "var(--ms-bg-component)",
                    border: "1px solid var(--ms-border)",
                    borderRadius: "7px",
                    padding: "7px 11px",
                    fontSize: "12px",
                    color: "var(--ms-text)",
                    outline: "none",
                    fontFamily: "inherit",
                    fontFeatureSettings: "\"tnum\"",
                  }}
                  onFocus={(e) => { (e.target as HTMLInputElement).style.borderColor = "color-mix(in srgb, var(--signal-info) 60%, transparent)"; }}
                  onBlur={(e)  => { (e.target as HTMLInputElement).style.borderColor = "var(--ms-border)"; }}
                />
                <p style={{ fontSize: "10px", color: "var(--ms-text-placeholder)", margin: 0, lineHeight: 1.5 }}>
                  O nome do deployment dentro do seu recurso Azure. Combina com a URL base acima.
                </p>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

/* ─── API Keys panel ─────────────────────────────────────────────────────────── */

const INPUT_STYLE: React.CSSProperties = {
  background: "var(--ms-bg-component)",
  border: "1px solid var(--ms-border)",
  borderRadius: "7px",
  padding: "7px 11px",
  fontSize: "12px",
  color: "var(--ms-text)",
  outline: "none",
  fontFamily: "inherit",
  width: "100%",
};

function ApiKeysPanel({
  azureBaseUrl,
  onBaseUrlChange,
  kieKeyStatus,
  onKieKeySave,
  onKieKeyDelete,
  higgsfieldKeyStatus,
  onHiggsfieldKeySave,
  onHiggsfieldKeyDelete,
  azureKeyStatus,
  onAzureKeySave,
  onAzureKeyDelete,
  codexStatus,
  onCodexLoginSuccess,
}: {
  azureBaseUrl: string;
  onBaseUrlChange: (v: string) => void;
  kieKeyStatus: "unknown" | "set" | "unset";
  onKieKeySave: (token: string) => Promise<void>;
  onKieKeyDelete: () => Promise<void>;
  higgsfieldKeyStatus: "unknown" | "set" | "unset";
  onHiggsfieldKeySave: (keyId: string, keySecret: string) => Promise<void>;
  onHiggsfieldKeyDelete: () => Promise<void>;
  azureKeyStatus: "unknown" | "set" | "unset";
  onAzureKeySave: (key: string) => Promise<void>;
  onAzureKeyDelete: () => Promise<void>;
  codexStatus: CodexStatus;
  onCodexLoginSuccess: () => void;
}) {
  const [kieInput, setKieInput]       = useState("");
  const [kieSaving, setKieSaving]     = useState(false);
  const [kieError, setKieError]       = useState<string | null>(null);
  const [higgsfieldKeyId, setHiggsfieldKeyId] = useState("");
  const [higgsfieldKeySecret, setHiggsfieldKeySecret] = useState("");
  const [higgsfieldSaving, setHiggsfieldSaving] = useState(false);
  const [higgsfieldError, setHiggsfieldError] = useState<string | null>(null);
  const [azureInput, setAzureInput]   = useState("");
  const [azureSaving, setAzureSaving] = useState(false);
  const [azureError, setAzureError]   = useState<string | null>(null);

  type CodexLoginFlow =
    | { status: "idle" }
    | { status: "starting" }
    | { status: "pending"; url: string; code: string }
    | { status: "error"; error: string };
  const [loginFlow, setLoginFlow] = useState<CodexLoginFlow>({ status: "idle" });
  const [codeCopied, setCodeCopied] = useState(false);

  const handleConnectCodex = async () => {
    setLoginFlow({ status: "starting" });
    try {
      const res = await fetch("/api/settings/codex-login", { method: "POST" });
      const d = await res.json();
      if (d.status === "pending") setLoginFlow({ status: "pending", url: d.url, code: d.code });
      else setLoginFlow({ status: "error", error: d.error ?? "Não consegui iniciar o login." });
    } catch (e: unknown) {
      setLoginFlow({ status: "error", error: e instanceof Error ? e.message : "Não consegui iniciar o login." });
    }
  };

  const handleCopyCode = (code: string) => {
    navigator.clipboard.writeText(code).then(() => {
      setCodeCopied(true);
      setTimeout(() => setCodeCopied(false), 1500);
    }).catch(() => {});
  };

  /* Poll while a device-code login is pending, until it resolves */
  useEffect(() => {
    if (loginFlow.status !== "pending") return;
    const interval = setInterval(async () => {
      try {
        const res = await fetch("/api/settings/codex-login");
        const d = await res.json();
        if (d.status === "success") {
          setLoginFlow({ status: "idle" });
          onCodexLoginSuccess();
        } else if (d.status === "error") {
          // Safety net: the login-store verdict can race the credential write.
          // Before showing a red error, confirm against codex-status (which
          // just checks auth.json on disk) — if the login actually landed,
          // treat it as success instead of latching an error.
          let recovered = false;
          try {
            const s = await fetch("/api/settings/codex-status").then((r) => r.json());
            if (s.ready || s.authFound) recovered = true;
          } catch { /* fall through to error */ }
          if (recovered) {
            setLoginFlow({ status: "idle" });
            onCodexLoginSuccess();
          } else {
            setLoginFlow({ status: "error", error: d.error ?? "O login falhou." });
          }
        }
        // "pending" → keep polling
      } catch { /* network hiccup — keep polling */ }
    }, 2500);
    return () => clearInterval(interval);
  }, [loginFlow.status, onCodexLoginSuccess]);

  const handleKieSave = async () => {
    if (!kieInput.trim()) return;
    setKieSaving(true);
    setKieError(null);
    try {
      await onKieKeySave(kieInput.trim());
      setKieInput("");
    } catch (e: unknown) {
      setKieError(e instanceof Error ? e.message : "Não consegui salvar.");
    } finally {
      setKieSaving(false);
    }
  };

  const handleAzureSave = async () => {
    if (!azureInput.trim()) return;
    setAzureSaving(true);
    setAzureError(null);
    try {
      await onAzureKeySave(azureInput.trim());
      setAzureInput("");
    } catch (e: unknown) {
      setAzureError(e instanceof Error ? e.message : "Não consegui salvar.");
    } finally {
      setAzureSaving(false);
    }
  };

  const handleHiggsfieldSave = async () => {
    if (!higgsfieldKeyId.trim() && !higgsfieldKeySecret.trim()) return;
    setHiggsfieldSaving(true);
    setHiggsfieldError(null);
    try {
      await onHiggsfieldKeySave(higgsfieldKeyId.trim(), higgsfieldKeySecret.trim());
      setHiggsfieldKeyId("");
      setHiggsfieldKeySecret("");
    } catch (e: unknown) {
      setHiggsfieldError(e instanceof Error ? e.message : "Não consegui salvar.");
    } finally {
      setHiggsfieldSaving(false);
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "28px" }}>
      {/* Header */}
      <div>
        <h2 style={{ fontSize: "17px", fontWeight: 600, color: "var(--ms-text)", margin: 0, lineHeight: 1.2 }}>
          Chaves de API
        </h2>
        <p style={{ fontSize: "12px", color: "var(--ms-text-placeholder)", marginTop: "6px", lineHeight: 1.5 }}>
          As credenciais ficam guardadas no servidor e nunca são devolvidas ao navegador.
        </p>
      </div>

      {/* ──── Kie.ai API key ──────────────────────────────────────────── */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "10px",
          padding: "16px",
          background: "var(--ms-bg-subtle)",
          border: "1px solid var(--ms-border)",
          borderRadius: "12px",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <span
            style={{
              width: "28px", height: "28px", borderRadius: "7px",
              background: "var(--ms-bg-component-hover)", border: "1px solid var(--ms-border)",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}
          >
            <ProviderBrandIcon id="kie" size={16} />
          </span>
          <div>
            <div style={{ fontSize: "13px", fontWeight: 600, color: "var(--ms-text)" }}>Kie.ai</div>
            <div style={{ fontSize: "10px", color: "var(--ms-text-placeholder)", marginTop: "1px" }}>
              Usada em toda geração de imagem e de vídeo
            </div>
          </div>
          {kieKeyStatus === "set" && (
            <span
              style={{
                marginLeft: "auto", fontSize: "10px", fontWeight: 600,
                color: "var(--signal-success)", background: "color-mix(in srgb, var(--signal-success) 16%, var(--ms-bg))",
                border: "1px solid color-mix(in srgb, var(--signal-success) 30%, transparent)", borderRadius: "5px",
                padding: "2px 7px", letterSpacing: "0.04em",
              }}
            >
              SALVA
            </span>
          )}
        </div>

        {kieKeyStatus === "unknown" ? (
          <div style={{ display: "flex", gap: "8px" }}>
            <div style={{
              flex: 1, height: "31px", borderRadius: "7px",
              background: "var(--ms-bg-component)",
              animation: "skeleton-pulse 1.4s ease-in-out infinite",
            }} />
            <div style={{
              width: "72px", height: "31px", borderRadius: "7px",
              background: "var(--ms-bg-component)",
              animation: "skeleton-pulse 1.4s ease-in-out infinite 0.2s",
            }} />
          </div>
        ) : kieKeyStatus === "set" ? (
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <input
              type="password"
              value="placeholdertoken"
              readOnly
              style={{ ...INPUT_STYLE, flex: 1, cursor: "default", color: "var(--ms-text-tertiary)" }}
            />
            <button
              onClick={onKieKeyDelete}
              style={{
                padding: "7px 12px", borderRadius: "7px", border: "1px solid color-mix(in srgb, var(--signal-critical) 45%, transparent)",
                background: "color-mix(in srgb, var(--signal-critical) 12%, var(--ms-bg))", color: "var(--signal-critical)",
                cursor: "pointer", fontSize: "12px", fontWeight: 500, whiteSpace: "nowrap",
              }}
            >
              Remover
            </button>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
            <div style={{ display: "flex", gap: "8px" }}>
              <input
                type="password"
                placeholder="Cole o seu token da Kie.ai"
                value={kieInput}
                onChange={(e) => setKieInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") handleKieSave(); }}
                style={{ ...INPUT_STYLE, flex: 1 }}
                onFocus={(e) => { (e.target as HTMLInputElement).style.borderColor = "var(--ms-border-brand)"; }}
                onBlur={(e)  => { (e.target as HTMLInputElement).style.borderColor = "var(--ms-border)"; }}
              />
              <button
                onClick={handleKieSave}
                disabled={!kieInput.trim() || kieSaving}
                style={{
                  padding: "7px 14px", borderRadius: "7px", border: "none",
                  background: kieInput.trim() ? "var(--ms-solid-brand)" : "var(--ms-bg-component)",
                  color: kieInput.trim() ? "var(--ms-text-on-solid)" : "var(--ms-text-placeholder)",
                  cursor: kieInput.trim() ? "pointer" : "default",
                  fontSize: "12px", fontWeight: 500, whiteSpace: "nowrap",
                  transition: "background 140ms ease, color 140ms ease",
                }}
              >
                {kieSaving ? "Salvando…" : "Salvar"}
              </button>
            </div>
            {kieError && (
              <p style={{ fontSize: "11px", color: "var(--signal-critical)", margin: 0 }}>{kieError}</p>
            )}
            <p style={{ fontSize: "10px", color: "var(--ms-text-placeholder)", margin: 0, lineHeight: 1.5 }}>
              Pegue o seu token em{" "}
              <a href="https://kie.ai/api-key" target="_blank" rel="noreferrer" style={{ color: "var(--ms-text-tertiary)" }}>
                kie.ai/api-key
              </a>
            </p>
          </div>
        )}
      </div>

      {/* ──── Higgsfield credentials ─────────────────────────────────── */}
      <div style={{ display: "flex", flexDirection: "column", gap: "10px", padding: "16px", background: "var(--ms-bg-subtle)", border: "1px solid var(--ms-border)", borderRadius: "12px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <span style={{ width: "28px", height: "28px", borderRadius: "7px", background: "var(--ms-bg-component-hover)", border: "1px solid var(--ms-border)", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: "11px" }}>HF</span>
          <div>
            <div style={{ fontSize: "13px", fontWeight: 600, color: "var(--ms-text)" }}>Higgsfield</div>
            <div style={{ fontSize: "10px", color: "var(--ms-text-placeholder)", marginTop: "1px" }}>Seedance 2.0 e Genjutsu — uma credencial para todos os modelos</div>
          </div>
          {higgsfieldKeyStatus === "set" && <span style={{ marginLeft: "auto", fontSize: "10px", fontWeight: 600, color: "var(--signal-success)", padding: "2px 7px" }}>SALVA</span>}
        </div>
        {higgsfieldKeyStatus === "unknown" ? (
          <div style={{ height: "31px", borderRadius: "7px", background: "var(--ms-bg-component)", animation: "skeleton-pulse 1.4s ease-in-out infinite" }} />
        ) : higgsfieldKeyStatus === "set" ? (
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <input type="password" value="placeholdertoken" readOnly style={{ ...INPUT_STYLE, flex: 1, cursor: "default", color: "var(--ms-text-tertiary)" }} />
            <button onClick={onHiggsfieldKeyDelete} style={{ padding: "7px 12px", borderRadius: "7px", border: "1px solid color-mix(in srgb, var(--signal-critical) 45%, transparent)", background: "color-mix(in srgb, var(--signal-critical) 12%, var(--ms-bg))", color: "var(--signal-critical)", cursor: "pointer", fontSize: "12px", fontWeight: 500 }}>Remover</button>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr auto", gap: "8px", alignItems: "end" }}>
              <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 10, color: "var(--ms-text-placeholder)" }}>Key ID<input type="password" aria-label="Higgsfield API key ID" placeholder="Cole o Key ID" value={higgsfieldKeyId} onChange={(e) => setHiggsfieldKeyId(e.target.value)} style={INPUT_STYLE} /></label>
              <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 10, color: "var(--ms-text-placeholder)" }}>Key Secret<input type="password" aria-label="Higgsfield API key secret" placeholder="Cole o Key Secret" value={higgsfieldKeySecret} onChange={(e) => setHiggsfieldKeySecret(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") handleHiggsfieldSave(); }} style={INPUT_STYLE} /></label>
              <button onClick={handleHiggsfieldSave} disabled={(!higgsfieldKeyId.trim() && !higgsfieldKeySecret.trim()) || higgsfieldSaving} style={{ padding: "7px 14px", borderRadius: "7px", border: "none", background: higgsfieldKeyId.trim() || higgsfieldKeySecret.trim() ? "var(--ms-solid-brand)" : "var(--ms-bg-component)", color: higgsfieldKeyId.trim() || higgsfieldKeySecret.trim() ? "var(--ms-text-on-solid)" : "var(--ms-text-placeholder)", cursor: higgsfieldKeyId.trim() || higgsfieldKeySecret.trim() ? "pointer" : "default", fontSize: "12px", fontWeight: 500, minHeight: 31 }}>{higgsfieldSaving ? "Salvando…" : "Salvar"}</button>
            </div>
            {higgsfieldError && <p style={{ fontSize: "11px", color: "var(--signal-critical)", margin: 0 }}>{higgsfieldError}</p>}
            <p style={{ fontSize: "10px", color: "var(--ms-text-placeholder)", margin: 0, lineHeight: 1.5 }}>Crie as credenciais em <a href="https://open.higgsfield.ai/api-keys" target="_blank" rel="noreferrer" style={{ color: "var(--ms-text-tertiary)" }}>open.higgsfield.ai/api-keys</a>. Você também pode colar <code>KEY_ID:KEY_SECRET</code> em um único campo.</p>
          </div>
        )}
      </div>

      {/* ──── Azure Foundry API key + endpoint ────────────────────────── */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "10px",
          padding: "16px",
          background: "color-mix(in srgb, var(--signal-info) 8%, var(--ms-bg))",
          border: "1px solid color-mix(in srgb, var(--signal-info) 21%, transparent)",
          borderRadius: "12px",
        }}
      >
        {/* Azure logo/title row */}
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <span
            style={{
              width: "28px", height: "28px", borderRadius: "7px",
              background: "color-mix(in srgb, var(--signal-info) 18%, var(--ms-bg))", border: "1px solid color-mix(in srgb, var(--signal-info) 30%, transparent)",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}
          >
            <ProviderBrandIcon id="azure" size={16} />
          </span>
          <div>
            <div style={{ fontSize: "13px", fontWeight: 600, color: "var(--ms-text)" }}>Azure Foundry</div>
            <div style={{ fontSize: "10px", color: "var(--ms-text-placeholder)", marginTop: "1px" }}>
              Chave e URL base — usadas por todos os modelos roteados pelo Azure
            </div>
          </div>
          {azureKeyStatus === "set" && (
            <span
              style={{
                marginLeft: "auto", fontSize: "10px", fontWeight: 600,
                color: "var(--signal-success)", background: "color-mix(in srgb, var(--signal-success) 16%, var(--ms-bg))",
                border: "1px solid color-mix(in srgb, var(--signal-success) 30%, transparent)", borderRadius: "5px",
                padding: "2px 7px", letterSpacing: "0.04em",
              }}
            >
              SALVA
            </span>
          )}
        </div>

        {/* API Key */}
        <div style={{ display: "flex", flexDirection: "column", gap: "5px" }}>
          <label
            htmlFor="azure-api-key"
            style={{ fontSize: "11px", fontWeight: 600, color: "var(--signal-info)", letterSpacing: "0.05em", textTransform: "uppercase" }}
          >
            Chave de API
          </label>
          {azureKeyStatus === "unknown" ? (
            <div style={{
              height: "31px", borderRadius: "7px",
              background: "var(--ms-bg-component)",
              animation: "skeleton-pulse 1.4s ease-in-out infinite",
            }} />
          ) : azureKeyStatus === "set" ? (
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <input
                type="password"
                value="placeholdertoken"
                readOnly
                style={{ ...INPUT_STYLE, flex: 1, cursor: "default", color: "var(--ms-text-tertiary)" }}
              />
              <button
                onClick={onAzureKeyDelete}
                style={{
                  padding: "7px 12px", borderRadius: "7px", border: "1px solid color-mix(in srgb, var(--signal-critical) 45%, transparent)",
                  background: "color-mix(in srgb, var(--signal-critical) 12%, var(--ms-bg))", color: "var(--signal-critical)",
                  cursor: "pointer", fontSize: "12px", fontWeight: 500, whiteSpace: "nowrap",
                }}
              >
                Remover
              </button>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
              <div style={{ display: "flex", gap: "8px" }}>
                <input
                  id="azure-api-key"
                  type="password"
                  placeholder="Cole a sua chave do Azure Foundry"
                  value={azureInput}
                  onChange={(e) => setAzureInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") handleAzureSave(); }}
                  style={{ ...INPUT_STYLE, flex: 1 }}
                  onFocus={(e) => { (e.target as HTMLInputElement).style.borderColor = "color-mix(in srgb, var(--signal-info) 60%, transparent)"; }}
                  onBlur={(e)  => { (e.target as HTMLInputElement).style.borderColor = "var(--ms-border)"; }}
                />
                <button
                  onClick={handleAzureSave}
                  disabled={!azureInput.trim() || azureSaving}
                  style={{
                    padding: "7px 14px", borderRadius: "7px", border: "none",
                    background: azureInput.trim() ? "var(--ms-solid-brand)" : "var(--ms-bg-component)",
                    color: azureInput.trim() ? "var(--ms-text-on-solid)" : "var(--ms-text-placeholder)",
                    cursor: azureInput.trim() ? "pointer" : "default",
                    fontSize: "12px", fontWeight: 500, whiteSpace: "nowrap",
                    transition: "background 140ms ease, color 140ms ease",
                  }}
                >
                  {azureSaving ? "Salvando…" : "Salvar"}
                </button>
              </div>
              {azureError && (
                <p style={{ fontSize: "11px", color: "var(--signal-critical)", margin: 0 }}>{azureError}</p>
              )}
            </div>
          )}
        </div>

        {/* Base URL */}
        <div style={{ display: "flex", flexDirection: "column", gap: "5px" }}>
          <label
            htmlFor="azure-global-base-url"
            style={{ fontSize: "11px", fontWeight: 600, color: "var(--signal-info)", letterSpacing: "0.05em", textTransform: "uppercase" }}
          >
            URL base
          </label>
          <input
            id="azure-global-base-url"
            type="url"
            placeholder="https://<resource>.cognitiveservices.azure.com"
            value={azureBaseUrl}
            onChange={(e) => onBaseUrlChange(e.target.value)}
            style={INPUT_STYLE}
            onFocus={(e) => { (e.target as HTMLInputElement).style.borderColor = "color-mix(in srgb, var(--signal-info) 60%, transparent)"; }}
            onBlur={(e)  => { (e.target as HTMLInputElement).style.borderColor = "var(--ms-border)"; }}
          />
          <p style={{ fontSize: "10px", color: "var(--ms-text-placeholder)", margin: 0, lineHeight: 1.5 }}>
            Combinada com os nomes de deployment de cada modelo, abaixo.
          </p>
        </div>
      </div>

      {/* ──── Codex CLI status ─────────────────────────────────────────── */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "10px",
          padding: "16px",
          background: "color-mix(in srgb, var(--signal-success) 8%, var(--ms-bg))",
          border: "1px solid color-mix(in srgb, var(--signal-success) 21%, transparent)",
          borderRadius: "12px",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <span
            style={{
              width: "28px", height: "28px", borderRadius: "7px",
              background: "color-mix(in srgb, var(--signal-success) 18%, var(--ms-bg))", border: "1px solid color-mix(in srgb, var(--signal-success) 30%, transparent)",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}
          >
            <ProviderBrandIcon id="codex" size={16} />
          </span>
          <div>
            <div style={{ fontSize: "13px", fontWeight: 600, color: "var(--ms-text)" }}>Codex CLI</div>
            <div style={{ fontSize: "10px", color: "var(--ms-text-placeholder)", marginTop: "1px" }}>
              Usa a sessão <code style={{ fontFamily: "monospace" }}>codex login</code> local do servidor — sem chave por usuário
            </div>
          </div>
          <span
            style={{
              marginLeft: "auto", fontSize: "10px", fontWeight: 600,
              color: codexStatus.kind === "ready" ? "var(--signal-success)" : "var(--signal-warning)",
              background: codexStatus.kind === "ready" ? "color-mix(in srgb, var(--signal-success) 16%, var(--ms-bg))" : "color-mix(in srgb, var(--signal-warning) 16%, var(--ms-bg))",
              border: `1px solid ${codexStatus.kind === "ready" ? "color-mix(in srgb, var(--signal-success) 30%, transparent)" : "color-mix(in srgb, var(--signal-warning) 30%, transparent)"}`,
              borderRadius: "5px", padding: "2px 7px", letterSpacing: "0.04em", whiteSpace: "nowrap",
            }}
          >
            {codexStatus.kind === "unknown" ? "VERIFICANDO…" : codexStatus.kind === "ready" ? "PRONTO" : "SEM CONFIGURAR"}
          </span>
        </div>

        {/* auth.json can exist but hold a stale/invalidated refresh token (e.g. the
            "session has ended" 401) — the status check only sees that the file is
            there, so it still reports READY. Offer a manual reauth escape hatch. */}
        {codexStatus.kind === "ready" && loginFlow.status === "idle" && (
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <p style={{ fontSize: "10px", color: "var(--ms-text-placeholder)", margin: 0, lineHeight: 1.5, flex: 1 }}>
              Apareceu &quot;session has ended&quot; ou erro 401? Refaça a autenticação abaixo.
            </p>
            <button
              onClick={handleConnectCodex}
              style={{
                padding: "7px 14px", borderRadius: "7px", border: "1px solid color-mix(in srgb, var(--signal-success) 45%, transparent)",
                background: "color-mix(in srgb, var(--signal-success) 18%, var(--ms-bg))", color: "var(--signal-success)",
                cursor: "pointer", fontSize: "12px", fontWeight: 500, whiteSpace: "nowrap",
              }}
            >
              Reautenticar
            </button>
          </div>
        )}

        {/* Starting a new login immediately invalidates any existing session on this
            host — the CLI clears old credentials the moment a login attempt begins,
            before the user does anything in the browser. Only offer it when auth is
            actually missing; a missing binary alone shouldn't risk a working login. */}
        {codexStatus.kind === "not_ready" && !codexStatus.authFound && loginFlow.status === "idle" && (
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <p style={{ fontSize: "10px", color: "var(--ms-text-placeholder)", margin: 0, lineHeight: 1.5, flex: 1 }}>
              Requires <a href="https://github.com/jdmnk/codex-imagegen-cli" target="_blank" rel="noreferrer" style={{ color: "var(--ms-text-tertiary)" }}>codex-imagegen-cli</a> installed on this server. Sign in below.
            </p>
            <button
              onClick={handleConnectCodex}
              style={{
                padding: "7px 14px", borderRadius: "7px", border: "1px solid color-mix(in srgb, var(--signal-success) 45%, transparent)",
                background: "color-mix(in srgb, var(--signal-success) 18%, var(--ms-bg))", color: "var(--signal-success)",
                cursor: "pointer", fontSize: "12px", fontWeight: 500, whiteSpace: "nowrap",
              }}
            >
              Conectar o Codex
            </button>
          </div>
        )}

        {codexStatus.kind === "not_ready" && codexStatus.authFound && !codexStatus.installed && loginFlow.status === "idle" && (
          <p style={{ fontSize: "10px", color: "var(--ms-text-placeholder)", margin: 0, lineHeight: 1.5 }}>
            Autenticado, mas o <a href="https://github.com/jdmnk/codex-imagegen-cli" target="_blank" rel="noreferrer" style={{ color: "var(--ms-text-tertiary)" }}>codex-imagegen-cli</a> ainda não está instalado neste servidor — a geração de imagem vai falhar até que esteja.
          </p>
        )}

        {loginFlow.status === "starting" && (
          <p style={{ fontSize: "11px", color: "var(--ms-text-tertiary)", margin: 0 }}>Starting login…</p>
        )}

        {loginFlow.status === "pending" && (
          <div style={{ display: "flex", flexDirection: "column", gap: "8px", padding: "12px", background: "var(--ms-bg-subtle)", border: "1px solid var(--ms-border)", borderRadius: "8px" }}>
            <p style={{ fontSize: "11px", color: "var(--ms-text-secondary)", margin: 0, lineHeight: 1.6 }}>
              1. Abra{" "}
              <a href={loginFlow.url} target="_blank" rel="noreferrer" style={{ color: "var(--signal-success)" }}>
                {loginFlow.url}
              </a>
              <br />
              2. Digite este código de uso único:
            </p>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <span
                style={{
                  fontFamily: "monospace", fontSize: "15px", fontWeight: 700, letterSpacing: "0.06em",
                  color: "var(--signal-success)", background: "color-mix(in srgb, var(--signal-success) 16%, var(--ms-bg))",
                  border: "1px solid color-mix(in srgb, var(--signal-success) 30%, transparent)", borderRadius: "6px", padding: "6px 12px",
                }}
              >
                {loginFlow.code}
              </span>
              <button
                onClick={() => handleCopyCode(loginFlow.code)}
                style={{
                  padding: "6px 10px", borderRadius: "6px", border: "1px solid var(--ms-border)",
                  background: "var(--ms-bg-component)", color: "var(--ms-text-secondary)",
                  cursor: "pointer", fontSize: "11px", fontWeight: 500,
                }}
              >
                {codeCopied ? "Copied" : "Copy"}
              </button>
            </div>
            <p style={{ fontSize: "10px", color: "var(--ms-text-placeholder)", margin: 0 }}>
              Esperando a confirmação… o código expira em 15 minutos.
            </p>
          </div>
        )}

        {loginFlow.status === "error" && (
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <p style={{ fontSize: "11px", color: "var(--signal-critical)", margin: 0, flex: 1 }}>{loginFlow.error}</p>
            <button
              onClick={handleConnectCodex}
              style={{
                padding: "6px 12px", borderRadius: "7px", border: "1px solid var(--ms-border)",
                background: "var(--ms-bg-component)", color: "var(--ms-text-secondary)",
                cursor: "pointer", fontSize: "12px", fontWeight: 500, whiteSpace: "nowrap",
              }}
            >
              Tentar de novo
            </button>
          </div>
        )}
      </div>

    </div>
  );
}

/* ─── Provider legend (shared) ───────────────────────────────────────────────── */

function ProviderLegend() {
  return (
    <div style={{ display: "flex", gap: "12px", padding: "12px 16px", background: "var(--ms-bg-subtle)", border: "1px solid var(--ms-border-subtle)", borderRadius: "10px" }}>
      {PROVIDERS.map((p) => (
        <div key={p.id} style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <span style={{ width: "24px", height: "24px", borderRadius: "6px", background: "var(--ms-bg-component-hover)", border: "1px solid var(--ms-border)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "10px", fontWeight: 700, color: "var(--ms-text-secondary)", letterSpacing: "0.02em" }}>
            <ProviderBrandIcon id={p.id} />
          </span>
          <span style={{ fontSize: "12px", color: "var(--ms-text-secondary)", fontWeight: 500 }}>{p.label}</span>
        </div>
      ))}
    </div>
  );
}

/* ─── Image Models panel ─────────────────────────────────────────────────────── */

function ImageModelsPanel({
  providers,
  onProviderChange,
  azureDeployments,
  onDeploymentChange,
}: {
  providers: Record<string, ProviderId>;
  onProviderChange: (modelId: string, v: ProviderId) => void;
  azureDeployments: Record<string, string>;
  onDeploymentChange: (modelId: string, v: string) => void;
}) {
  const models = IMAGE_MODELS.map((m) => ({
    id: m.id,
    name: m.name,
    provider: m.provider,
    category: "Image",
    hasAzureDeployment: !!m.azureSizeMap,
  }));

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "28px" }}>
      <div>
        <h2 style={{ fontSize: "17px", fontWeight: 600, color: "var(--ms-text)", margin: 0, lineHeight: 1.2 }}>
          Modelos de imagem
        </h2>
        <p style={{ fontSize: "12px", color: "var(--ms-text-placeholder)", marginTop: "6px", lineHeight: 1.5 }}>
          Escolha qual provedor atende cada modelo de imagem. Os modelos compatíveis com Azure mostram um campo de deployment quando o Azure é escolhido.
        </p>
      </div>
      <ProviderLegend />
      <ModelGroup
        title="Modelos de imagem"
        accent="var(--signal-warning)"
        models={models}
        providers={providers}
        onProviderChange={onProviderChange}
        azureDeployments={azureDeployments}
        onDeploymentChange={onDeploymentChange}
      />
    </div>
  );
}

/* ─── Video Models panel ─────────────────────────────────────────────────────── */

function VideoModelsPanel({
  providers,
  onProviderChange,
  azureDeployments,
  onDeploymentChange,
}: {
  providers: Record<string, ProviderId>;
  onProviderChange: (modelId: string, v: ProviderId) => void;
  azureDeployments: Record<string, string>;
  onDeploymentChange: (modelId: string, v: string) => void;
}) {
  const models = VIDEO_MODELS.map((m) => ({
    id: m.id,
    name: m.name,
    provider: m.provider,
    category: "Video",
    hasAzureDeployment: false,
  }));

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "28px" }}>
      <div>
        <h2 style={{ fontSize: "17px", fontWeight: 600, color: "var(--ms-text)", margin: 0, lineHeight: 1.2 }}>
          Modelos de vídeo
        </h2>
        <p style={{ fontSize: "12px", color: "var(--ms-text-placeholder)", marginTop: "6px", lineHeight: 1.5 }}>
          Escolha qual provedor atende cada modelo de vídeo.
        </p>
      </div>
      <ProviderLegend />
      <ModelGroup
        title="Modelos de vídeo"
        accent="var(--brand-solid)"
        models={models}
        providers={providers}
        onProviderChange={onProviderChange}
        azureDeployments={azureDeployments}
        onDeploymentChange={onDeploymentChange}
      />
    </div>
  );
}

/* ─── Text Models panel ──────────────────────────────────────────────────────── */

function TextModelsPanel({
  azureKeyStatus,
  azureBaseUrl,
  azureTextDeployment,
  azureTextModelName,
  onDeploymentChange,
  onModelNameChange,
}: {
  azureKeyStatus: "unknown" | "set" | "unset";
  azureBaseUrl: string;
  azureTextDeployment: string;
  azureTextModelName: string;
  onDeploymentChange: (v: string) => void;
  onModelNameChange: (v: string) => void;
}) {
  const azureReady = azureKeyStatus === "set" && !!azureBaseUrl.trim();
  const kieGroups = MODEL_GROUPS.filter(g => g.label !== "Azure");

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "28px" }}>
      {/* Header */}
      <div>
        <h2 style={{ fontSize: "17px", fontWeight: 600, color: "var(--ms-text)", margin: 0, lineHeight: 1.2 }}>
          Modelos de texto
        </h2>
        <p style={{ fontSize: "12px", color: "var(--ms-text-placeholder)", marginTop: "6px", lineHeight: 1.5 }}>
          Configure os modelos de texto do chat. O Azure Auto usa as credenciais do Azure Foundry da aba Chaves de API.
        </p>
      </div>

      {/* Kie.ai models */}
      <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
        {kieGroups.map((group) => (
          <div key={group.label}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "10px" }}>
              <span style={{ display: "inline-block", width: "6px", height: "6px", borderRadius: "50%", background: "var(--ms-bg-component-active)", flexShrink: 0 }} />
              <span style={{ fontSize: "11px", fontWeight: 600, letterSpacing: "0.08em", color: "var(--ms-text-tertiary)", textTransform: "uppercase" }}>
                {group.label}
              </span>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
              {group.models.map((m) => (
                <div
                  key={m.id}
                  style={{
                    display: "flex", alignItems: "center", gap: "14px",
                    padding: "11px 16px", borderRadius: "10px",
                    background: "var(--ms-bg-subtle)",
                    border: "1px solid var(--ms-border-subtle)",
                  }}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: "13px", fontWeight: 500, color: "var(--ms-text)", lineHeight: 1.3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {m.label}
                    </div>
                    <div style={{ fontSize: "11px", color: "var(--ms-text-placeholder)", marginTop: "2px" }}>
                      Kie.ai · {m.desc}
                    </div>
                  </div>
                  <span style={{
                    display: "flex", alignItems: "center", gap: "5px",
                    padding: "3px 8px", borderRadius: "6px",
                    background: "var(--ms-bg-component)", border: "1px solid var(--ms-border)",
                    fontSize: "11px", fontWeight: 500, color: "var(--ms-text-tertiary)",
                    whiteSpace: "nowrap",
                  }}>
                    <span style={{ fontWeight: 700, color: "var(--ms-text-secondary)" }}>K</span>
                    Kie.ai
                  </span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Azure Auto card */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "14px",
          padding: "16px",
          background: "color-mix(in srgb, var(--signal-info) 8%, var(--ms-bg))",
          border: "1px solid color-mix(in srgb, var(--signal-info) 21%, transparent)",
          borderRadius: "12px",
        }}
      >
        {/* Header row */}
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <span
            style={{
              width: "28px", height: "28px", borderRadius: "7px",
              background: "color-mix(in srgb, var(--signal-info) 18%, var(--ms-bg))", border: "1px solid color-mix(in srgb, var(--signal-info) 30%, transparent)",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: "11px", fontWeight: 700, color: "var(--signal-info)",
            }}
          >
            Az
          </span>
          <div>
            <div style={{ fontSize: "13px", fontWeight: 600, color: "var(--ms-text)" }}>Azure Auto</div>
            <div style={{ fontSize: "10px", color: "var(--ms-text-placeholder)", marginTop: "1px" }}>
              Model-router — escolhe sozinho o melhor modelo para cada pedido
            </div>
          </div>
          <span
            style={{
              marginLeft: "auto", fontSize: "10px", fontWeight: 600,
              color: azureReady ? "var(--signal-success)" : "var(--signal-warning)",
              background: azureReady ? "color-mix(in srgb, var(--signal-success) 16%, var(--ms-bg))" : "color-mix(in srgb, var(--signal-warning) 16%, var(--ms-bg))",
              border: `1px solid ${azureReady ? "color-mix(in srgb, var(--signal-success) 30%, transparent)" : "color-mix(in srgb, var(--signal-warning) 30%, transparent)"}`,
              borderRadius: "5px", padding: "2px 7px", letterSpacing: "0.04em", whiteSpace: "nowrap",
            }}
          >
            {azureReady ? "PRONTO" : "SEM CONFIGURAR"}
          </span>
        </div>

        {/* Status notice if not ready */}
        {!azureReady && (
          <div
            style={{
              padding: "10px 12px",
              background: "color-mix(in srgb, var(--signal-warning) 10%, var(--ms-bg))",
              border: "1px solid color-mix(in srgb, var(--signal-warning) 22%, transparent)",
              borderRadius: "8px",
              fontSize: "11px",
              color: "var(--signal-warning)",
              lineHeight: 1.5,
            }}
          >
            {azureKeyStatus !== "set"
              ? "Cadastre a chave do Azure Foundry na aba Chaves de API para liberar este modelo."
              : "Cadastre a URL base do Azure Foundry na aba Chaves de API para liberar este modelo."}
          </div>
        )}

        {/* Two-column grid: Model Name + Deployment */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
          {/* Model Name */}
          <div style={{ display: "flex", flexDirection: "column", gap: "5px" }}>
            <label
              htmlFor="azure-text-model-name"
              style={{ fontSize: "11px", fontWeight: 600, color: "var(--signal-info)", letterSpacing: "0.05em", textTransform: "uppercase" }}
            >
              Nome do modelo
            </label>
            <input
              id="azure-text-model-name"
              type="text"
              placeholder="model-router"
              value={azureTextModelName}
              onChange={(e) => onModelNameChange(e.target.value)}
              style={{
                background: "var(--ms-bg-component)",
                border: "1px solid var(--ms-border)",
                borderRadius: "7px",
                padding: "7px 11px",
                fontSize: "12px",
                color: "var(--ms-text)",
                outline: "none",
                fontFamily: "inherit",
              }}
              onFocus={(e) => { (e.target as HTMLInputElement).style.borderColor = "color-mix(in srgb, var(--signal-info) 60%, transparent)"; }}
              onBlur={(e)  => { (e.target as HTMLInputElement).style.borderColor = "var(--ms-border)"; }}
            />
            <p style={{ fontSize: "10px", color: "var(--ms-text-placeholder)", margin: 0, lineHeight: 1.5 }}>
              Vai como <code style={{ fontFamily: "monospace" }}>model</code> no corpo da requisição.
            </p>
          </div>

          {/* Deployment */}
          <div style={{ display: "flex", flexDirection: "column", gap: "5px" }}>
            <label
              htmlFor="azure-text-deployment"
              style={{ fontSize: "11px", fontWeight: 600, color: "var(--signal-info)", letterSpacing: "0.05em", textTransform: "uppercase" }}
            >
              Deployment
            </label>
            <input
              id="azure-text-deployment"
              type="text"
              placeholder="auto-model"
              value={azureTextDeployment}
              onChange={(e) => onDeploymentChange(e.target.value)}
              style={{
                background: "var(--ms-bg-component)",
                border: "1px solid var(--ms-border)",
                borderRadius: "7px",
                padding: "7px 11px",
                fontSize: "12px",
                color: "var(--ms-text)",
                outline: "none",
                fontFamily: "inherit",
              }}
              onFocus={(e) => { (e.target as HTMLInputElement).style.borderColor = "color-mix(in srgb, var(--signal-info) 60%, transparent)"; }}
              onBlur={(e)  => { (e.target as HTMLInputElement).style.borderColor = "var(--ms-border)"; }}
            />
            <p style={{ fontSize: "10px", color: "var(--ms-text-placeholder)", margin: 0, lineHeight: 1.5 }}>
              Usado no caminho da URL <code style={{ fontFamily: "monospace" }}>/deployments/{"{deployment}"}</code>.
            </p>
          </div>
        </div>

        {/* API version (read-only) */}
        <div style={{ display: "flex", flexDirection: "column", gap: "5px" }}>
          <span style={{ fontSize: "11px", fontWeight: 600, color: "var(--signal-info)", letterSpacing: "0.05em", textTransform: "uppercase" }}>
            Versão da API
          </span>
          <div style={{ padding: "7px 11px", background: "var(--ms-bg-subtle)", border: "1px solid var(--ms-border-subtle)", borderRadius: "7px", fontSize: "12px", color: "var(--ms-text-tertiary)", fontFamily: "monospace" }}>
            2024-04-01-preview
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── Debug panel ───────────────────────────────────────────────────────────── */

function DebugPanel() {
  const debugMode     = useWorkflowStore((s) => s.debugMode);
  const toggleDebug   = useWorkflowStore((s) => s.toggleDebug);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
      <div>
        <h2 style={{ fontSize: "15px", fontWeight: 600, color: "var(--ms-text)", margin: 0, marginBottom: "4px" }}>Debug</h2>
        <p style={{ fontSize: "12px", color: "var(--ms-text-tertiary)", margin: 0 }}>
          Só aparece quando <code style={{ fontFamily: "monospace", color: "var(--signal-warning)" }}>NEXT_PUBLIC_DEBUG=true</code>
        </p>
      </div>

      {/* Simular geração */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "16px", padding: "14px 16px", borderRadius: "10px", background: "var(--ms-bg-subtle)", border: "1px solid var(--ms-border-subtle)" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: "3px" }}>
          <span style={{ fontSize: "13px", fontWeight: 500, color: "var(--ms-text)" }}>Simular geração</span>
          <span style={{ fontSize: "11px", color: "var(--ms-text-tertiary)", lineHeight: 1.5 }}>
            Pula a chamada real da API — simula uma geração de 5 segundos e imprime o payload no console do servidor.
          </span>
        </div>
        <button
          onClick={toggleDebug}
          style={{
            flexShrink: 0,
            width: "40px",
            height: "22px",
            borderRadius: "11px",
            border: "none",
            cursor: "pointer",
            padding: "2px",
            background: debugMode ? "var(--ms-solid-brand)" : "var(--ms-bg-component-active)",
            transition: "background 200ms",
            display: "flex",
            alignItems: "center",
          }}
        >
          <div style={{
            width: "18px",
            height: "18px",
            borderRadius: "50%",
            background: "var(--ms-bg)",
            transform: debugMode ? "translateX(18px)" : "translateX(0px)",
            transition: "transform 200ms cubic-bezier(0.34,1.56,0.64,1)",
            boxShadow: "var(--ms-shadow-sm)",
          }} />
        </button>
      </div>
    </div>
  );
}

/* ─── Main modal ─────────────────────────────────────────────────────────────── */

export default function SettingsModal({ onClose }: SettingsModalProps) {
  const [activeNav, setActiveNav]             = useState<NavId>("api-keys");
  const [modelProviders, setModelProviders]   = useState<Record<string, ProviderId>>({});
  const [azureDeployments, setAzureDeployments] = useState<Record<string, string>>({});
  const [azureBaseUrl, setAzureBaseUrl]               = useState("");
  const [azureTextDeployment, setAzureTextDeployment] = useState("auto-model");
  const [azureTextModelName, setAzureTextModelName]   = useState("model-router");
  const [kieKeyStatus, setKieKeyStatus]               = useState<"unknown" | "set" | "unset">("unknown");
  const [higgsfieldKeyStatus, setHiggsfieldKeyStatus] = useState<"unknown" | "set" | "unset">("unknown");
  const [azureKeyStatus, setAzureKeyStatus]   = useState<"unknown" | "set" | "unset">("unknown");
  const [codexStatus, setCodexStatus]         = useState<CodexStatus>({ kind: "unknown" });
  const setKieKeySet    = useWorkflowStore((s) => s.setKieKeySet);
  const setAzureKeySet  = useWorkflowStore((s) => s.setAzureKeySet);
  const overlayRef = useRef<HTMLDivElement>(null);

  async function authHeader(): Promise<Record<string, string>> {
    return {};
  }

  const refreshCodexStatus = useCallback(() => {
    fetch("/api/settings/codex-status")
      .then((r) => r.json())
      .then((d: { ready: boolean; installed: boolean; authFound: boolean }) =>
        setCodexStatus(d.ready ? { kind: "ready" } : { kind: "not_ready", installed: d.installed, authFound: d.authFound })
      )
      .catch(() => setCodexStatus({ kind: "not_ready", installed: false, authFound: false }));
  }, []);

  /* Load persisted data on mount */
  useEffect(() => {
    setModelProviders(loadModelProviders());
    setAzureDeployments(loadAzureEndpoints());
    setAzureBaseUrl(loadAzureBaseUrl());
    setAzureTextDeployment(loadAzureTextDeployment());
    setAzureTextModelName(loadAzureTextModelName());
    // Check if Kie key is saved on the server
    authHeader().then((h) =>
      fetch("/api/settings/kie-key", { headers: h })
        .then((r) => r.json())
        .then((d) => setKieKeyStatus(d.hasToken ? "set" : "unset"))
        .catch(() => setKieKeyStatus("unset"))
    );
    authHeader().then((h) =>
      fetch("/api/settings/higgsfield-key", { headers: h })
        .then((r) => r.json())
        .then((d) => setHiggsfieldKeyStatus(d.hasCredentials ? "set" : "unset"))
        .catch(() => setHiggsfieldKeyStatus("unset"))
    );
    // Check if Azure key is saved on the server
    authHeader().then((h) =>
      fetch("/api/settings/azure-key", { headers: h })
        .then((r) => r.json())
        .then((d) => setAzureKeyStatus(d.hasToken ? "set" : "unset"))
        .catch(() => setAzureKeyStatus("unset"))
    );
    // Check whether the server has a working codex-imagegen + codex login
    refreshCodexStatus();
  }, [refreshCodexStatus]);

  /* Close on Escape */
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onClose]);

  /* Close on backdrop click */
  const handleOverlayClick = (e: React.MouseEvent) => {
    if (e.target === overlayRef.current) onClose();
  };

  const handleProviderChange = (modelId: string, v: ProviderId) => {
    const next = { ...modelProviders, [modelId]: v };
    saveModelProviders(next);
    setModelProviders(next);
  };

  const handleDeploymentChange = (modelId: string, v: string) => {
    setAzureDeployments((prev) => {
      const next = { ...prev, [modelId]: v };
      saveAzureEndpoints(next);
      return next;
    });
  };

  const handleBaseUrlChange = (v: string) => {
    setAzureBaseUrl(v);
    saveAzureBaseUrl(v);
  };

  const handleKieKeySave = async (token: string) => {
    const h = await authHeader();
    const res = await fetch("/api/settings/kie-key", {
      method: "POST",
      headers: { ...h, "Content-Type": "application/json" },
      body: JSON.stringify({ kieApiToken: token }),
    });
    if (!res.ok) throw new Error((await res.json()).error ?? "Não consegui salvar.");
    setKieKeyStatus("set");
    setKieKeySet(true);
  };

  const handleKieKeyDelete = async () => {
    const h = await authHeader();
    await fetch("/api/settings/kie-key", { method: "DELETE", headers: h });
    setKieKeyStatus("unset");
    setKieKeySet(false);
  };

  const handleHiggsfieldKeySave = async (keyId: string, keySecret: string) => {
    const h = await authHeader();
    const res = await fetch("/api/settings/higgsfield-key", {
      method: "POST",
      headers: { ...h, "Content-Type": "application/json" },
      body: JSON.stringify({ keyId, keySecret }),
    });
    if (!res.ok) throw new Error((await res.json()).error ?? "Não consegui salvar.");
    setHiggsfieldKeyStatus("set");
  };

  const handleHiggsfieldKeyDelete = async () => {
    const h = await authHeader();
    await fetch("/api/settings/higgsfield-key", { method: "DELETE", headers: h });
    setHiggsfieldKeyStatus("unset");
  };

  const handleAzureKeySave = async (key: string) => {
    const h = await authHeader();
    const res = await fetch("/api/settings/azure-key", {
      method: "POST",
      headers: { ...h, "Content-Type": "application/json" },
      body: JSON.stringify({ azureApiKey: key }),
    });
    if (!res.ok) throw new Error((await res.json()).error ?? "Não consegui salvar.");
    setAzureKeyStatus("set");
    setAzureKeySet(true);
  };

  const handleAzureKeyDelete = async () => {
    const h = await authHeader();
    await fetch("/api/settings/azure-key", { method: "DELETE", headers: h });
    setAzureKeyStatus("unset");
    setAzureKeySet(false);
  };

  const handleAzureTextDeploymentChange = (v: string) => {
    setAzureTextDeployment(v);
    saveAzureTextDeployment(v);
  };

  const handleAzureTextModelNameChange = (v: string) => {
    setAzureTextModelName(v);
    saveAzureTextModelName(v);
  };

  return (
    <>
      {/* ── Keyframe animations ── */}
      <style>{`
        @keyframes settingsOverlayIn {
          from { opacity: 0; }
          to   { opacity: 1; }
        }
        @keyframes settingsModalIn {
          from { opacity: 0; transform: translate(-50%, -48%) scale(0.96); }
          to   { opacity: 1; transform: translate(-50%, -50%) scale(1); }
        }
        @keyframes skeleton-pulse {
          0%, 100% { opacity: 1; }
          50%       { opacity: 0.4; }
        }
      `}</style>

      {/* ── Backdrop ── */}
      <div
        ref={overlayRef}
        onClick={handleOverlayClick}
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 9999,
          background: "var(--ms-bg-overlay)",
          animation: "settingsOverlayIn 180ms ease both",
        }}
      />

      {/* ── Modal shell ── */}
      <div
        id="settings-modal"
        style={{
          position: "fixed",
          left: "50%",
          top: "50%",
          transform: "translate(-50%, -50%)",
          zIndex: 10000,
          width: "min(75vw, 960px)",
          height: "min(75vh, 680px)",
          display: "flex",
          borderRadius: "var(--ms-radius-xl)",
          background: "var(--ms-bg)",
          border: "1px solid var(--ms-border-subtle)",
          boxShadow: "var(--ms-shadow-lg)",
          overflow: "hidden",
          animation: "settingsModalIn 220ms cubic-bezier(0.22,1,0.36,1) both",
        }}
      >
        {/* ── Left sidebar ── */}
        <div
          style={{
            width: "200px",
            flexShrink: 0,
            background: "var(--ms-bg-subtle)",
            borderRight: "1px solid var(--ms-border-subtle)",
            display: "flex",
            flexDirection: "column",
            padding: "20px 12px",
            gap: "2px",
          }}
        >
          {/* Title */}
          <div
            style={{
              fontSize: "14px",
              fontWeight: 600,
              color: "var(--ms-text-secondary)",
              padding: "4px 10px 14px",
              letterSpacing: "0.01em",
            }}
          >
            Ajustes
          </div>

          {/* Nav items */}
          {NAV.map((item) => {
            const isActive = activeNav === item.id;
            return (
              <button
                key={item.id}
                id={`settings-nav-${item.id}`}
                onClick={() => setActiveNav(item.id)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "9px",
                  padding: "8px 10px",
                  borderRadius: "8px",
                  border: "none",
                  cursor: "pointer",
                  background: isActive ? "var(--ms-bg-component-hover)" : "transparent",
                  color: isActive ? "var(--ms-text)" : "var(--ms-text-tertiary)",
                  fontSize: "13px",
                  fontWeight: isActive ? 500 : 400,
                  textAlign: "left",
                  transition: "background 130ms ease, color 130ms ease",
                  width: "100%",
                }}
                onMouseEnter={(e) => {
                  if (!isActive) {
                    (e.currentTarget as HTMLButtonElement).style.background = "var(--ms-bg-component)";
                    (e.currentTarget as HTMLButtonElement).style.color = "var(--ms-text-secondary)";
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isActive) {
                    (e.currentTarget as HTMLButtonElement).style.background = "transparent";
                    (e.currentTarget as HTMLButtonElement).style.color = "var(--ms-text-tertiary)";
                  }
                }}
              >
                <span style={{ opacity: isActive ? 1 : 0.6, flexShrink: 0 }}>{item.icon}</span>
                {item.label}
              </button>
            );
          })}
        </div>

        {/* ── Right content ── */}
        <div
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            minWidth: 0,
            overflow: "hidden",
          }}
        >
          {/* Top bar */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "flex-end",
              padding: "16px 20px",
              borderBottom: "1px solid var(--ms-border-subtle)",
              flexShrink: 0,
            }}
          >
            <button
              id="settings-close"
              onClick={onClose}
              title="Fechar (Esc)"
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                width: "28px",
                height: "28px",
                borderRadius: "7px",
                border: "none",
                cursor: "pointer",
                background: "var(--ms-bg-component)",
                color: "var(--ms-text-tertiary)",
                transition: "background 130ms ease, color 130ms ease",
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLButtonElement).style.background = "var(--ms-bg-component-active)";
                (e.currentTarget as HTMLButtonElement).style.color = "var(--ms-text)";
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLButtonElement).style.background = "var(--ms-bg-component)";
                (e.currentTarget as HTMLButtonElement).style.color = "var(--ms-text-tertiary)";
              }}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
                <path d="M18 6 6 18M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Scrollable body */}
          <div
            style={{
              flex: 1,
              overflowY: "auto",
              padding: "28px 28px 40px",
            }}
          >
            {activeNav === "api-keys" && (
              <ApiKeysPanel
                azureBaseUrl={azureBaseUrl}
                onBaseUrlChange={handleBaseUrlChange}
                kieKeyStatus={kieKeyStatus}
                onKieKeySave={handleKieKeySave}
                onKieKeyDelete={handleKieKeyDelete}
                higgsfieldKeyStatus={higgsfieldKeyStatus}
                onHiggsfieldKeySave={handleHiggsfieldKeySave}
                onHiggsfieldKeyDelete={handleHiggsfieldKeyDelete}
                azureKeyStatus={azureKeyStatus}
                onAzureKeySave={handleAzureKeySave}
                onAzureKeyDelete={handleAzureKeyDelete}
                codexStatus={codexStatus}
                onCodexLoginSuccess={refreshCodexStatus}
              />
            )}
            {activeNav === "image-models" && (
              <ImageModelsPanel
                providers={modelProviders}
                onProviderChange={handleProviderChange}
                azureDeployments={azureDeployments}
                onDeploymentChange={handleDeploymentChange}
              />
            )}
            {activeNav === "video-models" && (
              <VideoModelsPanel
                providers={modelProviders}
                onProviderChange={handleProviderChange}
                azureDeployments={azureDeployments}
                onDeploymentChange={handleDeploymentChange}
              />
            )}
            {activeNav === "text-models" && (
              <TextModelsPanel
                azureKeyStatus={azureKeyStatus}
                azureBaseUrl={azureBaseUrl}
                azureTextDeployment={azureTextDeployment}
                azureTextModelName={azureTextModelName}
                onDeploymentChange={handleAzureTextDeploymentChange}
                onModelNameChange={handleAzureTextModelNameChange}
              />
            )}
            {activeNav === "debug" && IS_DEBUG && <DebugPanel />}
          </div>
        </div>
      </div>
    </>
  );
}
