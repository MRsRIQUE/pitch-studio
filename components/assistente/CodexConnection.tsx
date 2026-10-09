"use client";

import { useEffect, useState } from "react";

type Status = { installed: boolean; ready: boolean; authType: string | null; error?: string };
type Login = { status: "pending"; url: string; code: string } | { status: "idle" | "starting" | "success" | "error"; error?: string };

export function CodexConnection() {
  const [status, setStatus] = useState<Status | null>(null);
  const [login, setLogin] = useState<Login>({ status: "idle" });
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    const refresh = async () => {
      try {
        const response = await fetch("/api/settings/codex-chat", { cache: "no-store" });
        if (!response.ok) throw new Error("Não foi possível consultar a conexão Codex.");
        const next: Status = await response.json();
        if (active) { setStatus(next); setError(""); }
      } catch (e) { if (active) setError(e instanceof Error ? e.message : "Falha de conexão."); }
    };
    void refresh();
    window.addEventListener("focus", refresh);
    return () => { active = false; window.removeEventListener("focus", refresh); };
  }, [login.status]);

  useEffect(() => {
    if (login.status !== "pending") return;
    let active = true;
    const interval = setInterval(async () => {
      try {
        const res = await fetch("/api/settings/codex-login", { cache: "no-store" });
        if (!res.ok) throw new Error("Não foi possível acompanhar o login.");
        const next: Login = await res.json();
        if (active && (next.status === "success" || next.status === "error")) setLogin(next);
      } catch { /* Keep the code visible; transient network failures can recover. */ }
    }, 2500);
    return () => { active = false; clearInterval(interval); };
  }, [login.status]);

  async function connect() {
    setLogin({ status: "starting" });
    try {
      const res = await fetch("/api/settings/codex-login", { method: "POST" });
      const next: Login = await res.json();
      if (next.status === "pending" && new URL(next.url).origin !== "https://auth.openai.com") throw new Error("O Codex retornou um endereço de login inesperado.");
      setLogin(next);
    } catch (e) { setLogin({ status: "error", error: e instanceof Error ? e.message : "Não foi possível iniciar o login." }); }
  }

  return <div className="text-ms-sm text-ms-text-secondary mt-3" aria-live="polite">
    <p>{error || status?.error || (status?.ready ? `Codex conectado ${status.authType === "chatgpt" ? "à sua conta ChatGPT" : "com chave de API"}. Pronto para conversar e montar workflows.` : status ? "Entre com sua conta ChatGPT para usar o Codex neste computador." : "Verificando conexão com o Codex…")}</p>
    <p>Retratos de personagens usam Kie.ai e os créditos desse provedor.</p>
    {status?.installed && login.status !== "pending" && <button className="underline mt-2" type="button" disabled={login.status === "starting"} onClick={() => void connect()}>{login.status === "starting" ? "Abrindo login…" : status.ready ? "Reconectar conta" : "Conectar com ChatGPT"}</button>}
    {login.status === "pending" && <p className="mt-2">Acesse <a className="underline" href={login.url} target="_blank" rel="noreferrer">o login da OpenAI</a> e informe o código <strong className="select-all">{login.code}</strong>. Aguardando confirmação…</p>}
    {login.status === "error" && <p role="alert">{login.error}</p>}
  </div>;
}
