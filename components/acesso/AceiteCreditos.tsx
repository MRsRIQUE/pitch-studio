"use client";

/* ============================================================
   ACEITE DA CLÁUSULA DE CRÉDITOS — primeiro acesso ao Studio

   Aparece no lugar do app enquanto a conta não aceitou a cláusula de
   créditos vigente (seção 8 dos Termos). Texto, versão e hash vêm do
   saysell-web; o aceite volta para lá, e o servidor recusa gastar crédito
   sem ele.
   ============================================================ */

import { useState } from "react";
import { SaySellLogo } from "@/components/SaySellLogo";
import "@/app/entrar/entrar.css";

const SITE_SAYSELL = process.env.NEXT_PUBLIC_SAYSELL_SITE_URL || "https://www.saysell.app";

export function AceiteCreditos({
  clausula,
  email,
}: {
  clausula: { version: string; text: string; sha256: string };
  email: string | null;
}) {
  const [marcado, setMarcado] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function aceitar() {
    setEnviando(true);
    setErro(null);
    try {
      const res = await fetch("/api/credit/terms", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ accepted: true, version: clausula.version, sha256: clausula.sha256 }),
      });
      if (res.ok) {
        window.location.reload();
        return;
      }
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      setErro(data.error || "Não deu para registrar o aceite agora.");
    } catch {
      setErro("Sem conexão. Tente de novo.");
    }
    setEnviando(false);
  }

  return (
    <main className="entrar-fundo">
      <section className="entrar-cartao" aria-labelledby="aceite-titulo">
        <SaySellLogo size={40} />
        <h1 id="aceite-titulo">Antes de começar: como funcionam os créditos</h1>
        {email ? (
          <p className="acesso-texto">
            Conta <strong>{email}</strong>
          </p>
        ) : null}
        <blockquote className="aceite-clausula">{clausula.text}</blockquote>
        <p className="acesso-texto">
          Esta cláusula faz parte dos{" "}
          <a href={`${SITE_SAYSELL}/termos`} target="_blank" rel="noreferrer">
            Termos de Uso
          </a>{" "}
          (seção 8), versão {clausula.version}.
        </p>
        <label className="aceite-marca">
          <input type="checkbox" checked={marcado} onChange={(e) => setMarcado(e.target.checked)} />
          <span>Li e aceito a cláusula de créditos do SaySell Studio.</span>
        </label>
        {erro ? (
          <p className="acesso-texto aceite-erro" role="alert">
            {erro}
          </p>
        ) : null}
        <div className="acesso-acoes">
          <button
            type="button"
            className="entrar-primario"
            disabled={!marcado || enviando}
            onClick={() => void aceitar()}
          >
            {enviando ? "Registrando…" : "Aceitar e entrar"}
          </button>
        </div>
      </section>
    </main>
  );
}
