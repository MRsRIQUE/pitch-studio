"use client";

/* ============================================================
   PERFIL — a tela

   Réplica do template `ai-profile` do BoardUI: três seções
   empilhadas numa coluna de 680px centrada, com 16px de vão.

     1. cartão de perfil        680×592
     2. barras por dia          680×317
     3. área do acervo          680×267

   A coluna vive dentro do `SidebarInset` do `ShellApp`, então a
   barra lateral do app continua onde está — a referência também
   mantém a dela.
   ============================================================ */

import * as React from "react";

import { AreaAcervo } from "./AreaAcervo";
import { BarrasPorDia } from "./BarrasPorDia";
import { CartaoPerfil } from "./CartaoPerfil";
import { useDadosPerfil } from "./dados";
import type { Periodo } from "./MapaAtividade";
import "./perfil.css";

export function Perfil() {
  const dados = useDadosPerfil();
  const [periodo, setPeriodo] = React.useState<Periodo>("mensal");

  return (
    <main className="pf-pagina">
      <div className="pf-coluna">
        <CartaoPerfil dados={dados} periodo={periodo} onPeriodo={setPeriodo} />
        <BarrasPorDia porDia={dados.porDia} />
        <AreaAcervo pecas={dados.pecas} />
      </div>
    </main>
  );
}
