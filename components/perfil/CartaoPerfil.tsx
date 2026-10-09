"use client";

/* ============================================================
   O CARTÃO DE PERFIL — a primeira seção (680×592)

   Geometria literal da referência: capa `absolute` de 165px, corpo
   com `padding-top: 124px` (é isso que faz o avatar de 80 morder os
   últimos 40px da faixa), vão de 15px entre os três blocos, e os
   botões subindo 34px para dentro da capa.

   Onde a referência mostra dado que não temos, o campo foi trocado
   por dado nosso — nunca preenchido com invenção:

     capa (imagem)      → a imagem mais recente do Acervo
     @arroba            → "Membro desde <mês/ano da primeira peça>"
     selo PRO           → selo "Local" (o app roda na máquina; é
                          verificável, ao contrário de um plano)
     Share              → "Exportar", que abre o Acervo, onde o
                          download em lote já existe
     Edit               → "Editar", que abre as Configurações
     $7.462 +14,8%      → saldo real de créditos + total de gerações
     4 caixas de tokens → Gerações · Projetos · Pastas · Maior sequência

   O que ficou de fora e por quê está em
   `.migracao/relatos/prisma-leva8.md`.
   ============================================================ */

import * as React from "react";
import { useRouter } from "next/navigation";

import { Download, Pencil } from "@/components/icones";
import { useWorkflowStore } from "@/lib/store";
import { MapaAtividade, type Periodo } from "./MapaAtividade";
import { desde, num, plural, saldo, type DadosPerfil } from "./dados";

/* Espelha o `displayName` de `components/AppSidebar.tsx`. Duplicado de
   propósito: aquele arquivo é do Maestro e não exporta a constante. Se
   o nome mudar lá, muda aqui. */
const NOME = "Workspace pessoal";

export function CartaoPerfil({
  dados,
  periodo,
  onPeriodo,
}: {
  dados: DadosPerfil;
  periodo: Periodo;
  onPeriodo: (p: Periodo) => void;
}) {
  const router = useRouter();
  const abrirConfiguracoes = useWorkflowStore(s => s.setSettingsOpen);

  const caixas = [
    { valor: num(dados.totalGeracoes), rotulo: "Gerações" },
    { valor: num(dados.projetos), rotulo: "Projetos" },
    { valor: num(dados.pastas), rotulo: "Pastas" },
    {
      valor: dados.maiorSequencia === 0 ? "—" : plural(dados.maiorSequencia, "dia", "dias"),
      rotulo: "Maior sequência",
    },
  ];

  return (
    <div className="pf-cartao">
      <div className="pf-capa">
        {dados.capa && (
          // eslint-disable-next-line @next/next/no-img-element
          <img className="pf-capa__img" src={dados.capa} alt="" aria-hidden="true" draggable={false} />
        )}
      </div>

      <div className="pf-corpo">
        <span className="pf-avatar" aria-hidden="true">{NOME.charAt(0)}</span>

        <div className="pf-identidade">
          <div className="pf-identidade__texto">
            <p className="pf-nome">{NOME}</p>
            <div className="pf-subtitulo">
              <p className="pf-subtitulo__texto">{desde(dados.primeira)}</p>
              <span className="pf-selo" title="Tudo neste perfil vive na sua máquina">Local</span>
            </div>
          </div>

          <div className="pf-acoes">
            <button
              type="button"
              className="pf-botao pf-press"
              title="Abrir o Acervo para baixar as peças"
              onClick={() => router.push("/gallery?tab=images")}
            >
              <Download size={18} />
              <span className="pf-botao__rotulo">Exportar</span>
            </button>
            <button
              type="button"
              className="pf-botao pf-press"
              title="Abrir as Configurações"
              onClick={() => abrirConfiguracoes(true)}
            >
              <Pencil size={18} />
              <span className="pf-botao__rotulo">Editar</span>
            </button>
          </div>
        </div>

        <div className="pf-bloco">
          <div className="pf-destaque">
            <p className="pf-rotulo">Créditos disponíveis</p>
            <div className="pf-destaque__linha">
              {/* Reacende quando o saldo chega — a mesma animação de .22s
                  que a referência usa nos números que trocam. */}
              <p key={dados.creditos ?? "—"} className="pf-destaque__valor pf-anima-numero">
                {saldo(dados.creditos)}
              </p>
              <span className="pf-selo pf-selo--marca">
                {plural(dados.totalGeracoes, "geração", "gerações")}
              </span>
            </div>
          </div>

          <div className="pf-tiles">
            {caixas.map(caixa => (
              <div key={caixa.rotulo} className="pf-tile">
                <p className="pf-tile__valor" title={caixa.valor}>{caixa.valor}</p>
                <p className="pf-tile__rotulo" title={caixa.rotulo}>{caixa.rotulo}</p>
              </div>
            ))}
          </div>

          <MapaAtividade porDia={dados.porDia} periodo={periodo} onPeriodo={onPeriodo} />
        </div>
      </div>
    </div>
  );
}
