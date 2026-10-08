"use client";

/**
 * A pílula de créditos do canto superior direito do Workflow.
 *
 * Mora na pílula do topo, ao lado do avatar, porque é ali que a conta
 * já aparece — e porque o Workflow é onde o crédito é gasto: cada
 * gerador do grafo consome saldo da Kie, e até aqui o número só existia
 * na sidebar da lista, fora desta tela.
 *
 * Quatro estados, todos desenhados:
 *   carregando  → `—`, sem pular quando o número chegar (largura mínima)
 *   sem chave   → "Conectar Kie", que abre os Ajustes
 *   saldo baixo → o número em cor de alerta, abaixo de `LIMITE_BAIXO`
 *   normal      → o número; clicar abre a página de comprar créditos
 *
 * O saldo atualiza sozinho (60s, `credits-refresh`, volta para a aba);
 * o botão de atualizar existe para quem acabou de comprar e não quer
 * esperar.
 */

import { useCreditos, formatarCreditos, URL_COMPRAR_CREDITOS } from "@/hooks/useCreditos";
import "./cromo.css";

/** Abaixo disto a cor vira alerta: é menos que uma geração de vídeo. */
const LIMITE_BAIXO = 20;

function IconeCredito() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="9" />
      <path d="M14.8 9.2a3.2 3.2 0 0 0-5.6 2.1v1.4a3.2 3.2 0 0 0 5.6 2.1" />
      <path d="M7.5 12h5" />
    </svg>
  );
}

function IconeAtualizar() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M21 12a9 9 0 1 1-2.6-6.4" />
      <path d="M21 3v6h-6" />
    </svg>
  );
}

export default function CromoCreditos({ onConectar }: { onConectar: () => void }) {
  const { saldo, carregando, semChave, erro, atualizar } = useCreditos();

  if (semChave) {
    return (
      <button
        type="button"
        className="cr-creditos cr-creditos--sem-chave"
        title="Nenhuma chave da Kie.ai configurada — conecte nos Ajustes para ver o saldo"
        onClick={onConectar}
      >
        <IconeCredito />
        <span>Conectar Kie</span>
      </button>
    );
  }

  const baixo = saldo !== null && saldo < LIMITE_BAIXO;
  const texto = saldo === null ? "—" : formatarCreditos(saldo);
  const titulo = saldo === null
    ? (erro ? "Não foi possível ler o saldo da Kie.ai" : "Lendo o saldo da Kie.ai…")
    : `${texto} créditos na Kie.ai${baixo ? " — saldo baixo" : ""}. Clique para adicionar créditos.`;

  return (
    <span
      className="cr-creditos"
      data-baixo={baixo ? "true" : undefined}
      data-carregando={carregando ? "true" : undefined}
      data-erro={erro && saldo === null ? "true" : undefined}
    >
      <a
        className="cr-creditos__saldo"
        href={URL_COMPRAR_CREDITOS}
        target="_blank"
        rel="noreferrer"
        title={titulo}
        aria-label={titulo}
      >
        <IconeCredito />
        <span className="cr-creditos__numero">{texto}</span>
      </a>
      <button
        type="button"
        className="cr-creditos__atualizar"
        title="Atualizar o saldo"
        aria-label="Atualizar o saldo"
        onClick={atualizar}
      >
        <IconeAtualizar />
      </button>
    </span>
  );
}
