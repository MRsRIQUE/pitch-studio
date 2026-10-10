"use client";

/* ============================================================
   BLOQUEIO DE ACESSO — no lugar do app quando a conta não pode usar o Studio

   `sem_plano`: o saysell-web disse `level: "none"` (Start, Free ou plano
   vencido). `indisponivel`: não deu para perguntar ao saysell-web — o
   Studio fecha em vez de liberar sem saber o plano.
   ============================================================ */

import { SaySellLogo } from "@/components/SaySellLogo";
import "@/app/entrar/entrar.css";

const SITE_SAYSELL = process.env.NEXT_PUBLIC_SAYSELL_SITE_URL || "https://www.saysell.app";

async function sair() {
  await fetch("/api/session", { method: "DELETE" }).catch(() => undefined);
  window.location.assign("/entrar");
}

export function BloqueioAcesso({
  motivo,
  email,
}: {
  motivo: "sem_plano" | "indisponivel";
  email: string | null;
}) {
  return (
    <main className="entrar-fundo">
      <section className="entrar-cartao" aria-labelledby="acesso-titulo">
        <SaySellLogo size={40} />
        {motivo === "sem_plano" ? (
          <>
            <h1 id="acesso-titulo">O Studio está nos planos Pro e Max</h1>
            <p className="acesso-texto">
              {email ? <>A conta <strong>{email}</strong> ainda não tem o Studio. </> : null}
              Assine o Pro para gerar imagens e vídeos com 1.200 créditos por mês, ou o Max para
              usar todos os modelos com 4.000 créditos.
            </p>
            <div className="acesso-acoes">
              <a className="entrar-primario" href={`${SITE_SAYSELL}/planos`}>
                Ver planos
              </a>
              <button type="button" className="entrar-google" onClick={() => void sair()}>
                Entrar com outra conta
              </button>
            </div>
          </>
        ) : (
          <>
            <h1 id="acesso-titulo">Não deu para conferir seu plano</h1>
            <p className="acesso-texto">
              O Studio não conseguiu falar com o SaySell agora. Tente de novo em alguns instantes.
            </p>
            <div className="acesso-acoes">
              <button type="button" className="entrar-primario" onClick={() => window.location.reload()}>
                Tentar de novo
              </button>
              <button type="button" className="entrar-google" onClick={() => void sair()}>
                Sair
              </button>
            </div>
          </>
        )}
      </section>
    </main>
  );
}
