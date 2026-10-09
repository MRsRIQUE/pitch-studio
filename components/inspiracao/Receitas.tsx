"use client";

/* ============================================================
   RECEITAS — o chip "Receitas" da Inspiração

   A grade de gerações mostra o que o usuário já fez; esta mostra o que
   dá para fazer. Cada card é uma receita de `lib/receitas.ts`: título,
   resumo, os modelos (nomes vindos do catálogo, nunca escritos aqui),
   os passos e as ações — e a primeira ação abre a tela ou o template
   certo já montado.

   Os passos ficam recolhidos num `<details>`: o card é um convite, não
   um manual; quem quer o passo a passo abre.
   ============================================================ */

import * as React from "react";
import { useRouter } from "next/navigation";
import { IMAGE_MODELS, VIDEO_MODELS } from "@/lib/modelConfig";
import { RECEITAS, destinoDaAcao, type Receita } from "@/lib/receitas";
import "@/components/inspiracao/receitas.css";

function nomeDoModelo(id: string): { nome: string; video: boolean } | null {
  const img = IMAGE_MODELS.find(m => m.id === id);
  if (img) return { nome: img.name, video: false };
  const vid = VIDEO_MODELS.find(m => m.id === id);
  if (vid) return { nome: vid.name, video: true };
  return null;
}

function CardReceita({ receita }: { receita: Receita }) {
  const router = useRouter();
  const modelos = receita.modelos.map(nomeDoModelo).filter((m): m is NonNullable<typeof m> => m !== null);

  return (
    <article className="rec-card">
      <header className="rec-card__topo">
        <h2 className="rec-card__titulo">{receita.titulo}</h2>
        {modelos.length > 0 && (
          <div className="rec-card__modelos" aria-label="Modelos usados">
            {modelos.map(m => (
              <span key={m.nome} className={`rec-pill${m.video ? " rec-pill--video" : ""}`}>{m.nome}</span>
            ))}
          </div>
        )}
      </header>

      <p className="rec-card__resumo">{receita.resumo}</p>

      <details className="rec-card__passos">
        <summary>{receita.passos.length} passos</summary>
        <ol>
          {receita.passos.map((p, i) => <li key={i}>{p}</li>)}
        </ol>
      </details>

      <footer className="rec-card__rodape">
        <div className="rec-card__acoes">
          {receita.acoes.map((acao, i) => (
            <button
              key={acao.rotulo}
              type="button"
              className={`rec-botao${i === 0 ? " rec-botao--principal" : ""}`}
              onClick={() => router.push(destinoDaAcao(acao))}
            >
              {acao.rotulo}
            </button>
          ))}
        </div>
        {receita.credito && <span className="rec-card__credito">{receita.credito}</span>}
      </footer>
    </article>
  );
}

export function Receitas({ query }: { query: string }) {
  const needle = query.trim().toLowerCase();
  const visiveis = needle
    ? RECEITAS.filter(r => `${r.titulo} ${r.resumo} ${r.passos.join(" ")}`.toLowerCase().includes(needle))
    : RECEITAS;

  if (visiveis.length === 0) {
    return (
      <div className="insp-empty">
        <h2>Nenhuma receita com essa busca</h2>
        <p>Tente outra palavra ou limpe a busca.</p>
      </div>
    );
  }

  return (
    <section className="rec-grade" aria-label="Receitas">
      {visiveis.map(r => <CardReceita key={r.id} receita={r} />)}
    </section>
  );
}
