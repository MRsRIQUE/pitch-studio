"use client";

/* ============================================================
   ENTRAR — login com a conta do SaySell

   O Studio não tem cadastro próprio: quem entra é assinante do SaySell,
   com o mesmo Firebase Auth do site. O ID token sai do navegador uma vez,
   vira cookie de sessão em `/api/session`, e a navegação segue com ele.
   ============================================================ */

import * as React from "react";
import { Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  GoogleAuthProvider,
  signInWithEmailAndPassword,
  signInWithPopup,
  type UserCredential,
} from "firebase/auth";
import { SaySellLogo } from "@/components/SaySellLogo";
import { abrirSessao, firebaseAuth } from "@/lib/auth/firebaseClient";
import "./entrar.css";

const SITE_SAYSELL = process.env.NEXT_PUBLIC_SAYSELL_SITE_URL || "https://www.saysell.app";

/** Só aceita voltar para um caminho interno — nunca para outro domínio. */
function destinoSeguro(voltar: string | null): string {
  if (!voltar || !voltar.startsWith("/") || voltar.startsWith("//")) return "/";
  if (voltar.startsWith("/entrar")) return "/";
  return voltar;
}

function mensagemDeErro(erro: unknown): string {
  const code = (erro as { code?: string })?.code ?? "";
  if (code === "auth/invalid-credential" || code === "auth/wrong-password" || code === "auth/user-not-found") {
    return "E-mail ou senha incorretos.";
  }
  if (code === "auth/too-many-requests") return "Muitas tentativas. Espere um pouco e tente de novo.";
  if (code === "auth/popup-closed-by-user" || code === "auth/cancelled-popup-request") return "";
  if (code === "auth/popup-blocked") return "O navegador bloqueou a janela do Google. Libere pop-ups e tente de novo.";
  if (code === "auth/unauthorized-domain") return "Este endereço ainda não está liberado para login.";
  return erro instanceof Error && erro.message ? erro.message : "Não foi possível entrar agora.";
}

function FormularioEntrar() {
  const router = useRouter();
  const params = useSearchParams();
  const destino = destinoSeguro(params.get("voltar"));
  const [email, setEmail] = React.useState("");
  const [senha, setSenha] = React.useState("");
  const [ocupado, setOcupado] = React.useState(false);
  const [erro, setErro] = React.useState("");

  const concluir = React.useCallback(
    async (credencial: Promise<UserCredential>) => {
      setOcupado(true);
      setErro("");
      try {
        const { user } = await credencial;
        await abrirSessao(await user.getIdToken());
        router.replace(destino);
        router.refresh();
      } catch (e) {
        setErro(mensagemDeErro(e));
        setOcupado(false);
      }
    },
    [destino, router],
  );

  return (
    <main className="entrar-fundo">
      <section className="entrar-cartao" aria-labelledby="entrar-titulo">
        <SaySellLogo size={40} />
        <h1 id="entrar-titulo">Entre no Studio</h1>
        <p className="entrar-sub">Use a mesma conta do SaySell.</p>

        <button
          type="button"
          className="entrar-google"
          disabled={ocupado}
          onClick={() => void concluir(signInWithPopup(firebaseAuth(), new GoogleAuthProvider()))}
        >
          <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
            <path fill="#EA4335" d="M12 10.2v3.9h5.5c-.2 1.3-1.6 3.8-5.5 3.8-3.3 0-6-2.7-6-6.1s2.7-6.1 6-6.1c1.9 0 3.1.8 3.8 1.5l2.6-2.5C16.8 3.2 14.6 2.2 12 2.2 6.6 2.2 2.2 6.6 2.2 12s4.4 9.8 9.8 9.8c5.7 0 9.4-4 9.4-9.6 0-.6-.1-1.1-.2-1.6H12z" />
          </svg>
          Entrar com Google
        </button>

        <div className="entrar-ou" role="separator">
          <span>ou</span>
        </div>

        <form
          className="entrar-form"
          onSubmit={(e) => {
            e.preventDefault();
            void concluir(signInWithEmailAndPassword(firebaseAuth(), email.trim(), senha));
          }}
        >
          <label>
            E-mail
            <input
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </label>
          <label>
            Senha
            <input
              type="password"
              autoComplete="current-password"
              required
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
            />
          </label>
          {erro && (
            <p className="entrar-erro" role="alert">
              {erro}
            </p>
          )}
          <button type="submit" className="entrar-primario" disabled={ocupado}>
            {ocupado ? "Entrando…" : "Entrar"}
          </button>
        </form>

        <p className="entrar-rodape">
          <a href={`${SITE_SAYSELL}/reset-password`}>Esqueci a senha</a>
          <span aria-hidden="true">·</span>
          <a href={`${SITE_SAYSELL}/planos`}>Ainda não assina? Ver planos</a>
        </p>
      </section>
    </main>
  );
}

export default function EntrarPage() {
  return (
    <Suspense fallback={<main className="entrar-fundo" />}>
      <FormularioEntrar />
    </Suspense>
  );
}
