"use client";

/* ============================================================
   O RASTRO DO AGENTE — interface, não log

   É a parte do bloco 09 que explica o que está acontecendo enquanto nada
   aparece: o bloco `Pensando a fundo` com a duração, a linha do ciclo de vida
   de quem fez o trabalho, o selo do modelo que rodou, e no fim a régua da
   resposta e as sugestões de continuação com a seta que desliza.

   Cada linha vem de uma chave real do i18n do bloco (§7 do INFO). O que muda em
   relação à referência é qual chave do ciclo de vida aparece em cada momento:
   lá, `completed` já aparece no despacho da ferramenta; aqui a tarefa só está
   concluída quando o `/api/job-stream` resolve, então o despacho mostra
   `takenOver`. Marcar como concluído o que ainda está gerando seria mentir
   sobre o estado — e o estado é justamente o que este bloco serve para mostrar.
   ============================================================ */

import * as React from "react";
import {
  ArrowRight,
  Bot,
  Check,
  ChevronDown,
  ChevronUp,
  Copy,
  Film,
  ImageIcon,
  MoreHorizontal,
  Pencil,
  Search,
} from "@/components/icones";
import { T, duracaoCurta, type MidiaCiclo, type TurnoCiclo } from "./CicloTextos";
import "./ciclo.css";

/** O bloco dobrável da referência; sem transcript, mostra rótulo e duração. */
export function BlocoPensando({ duracaoMs }: { duracaoMs?: number }) {
  return (
    <div className="ciclo-pensando">
      {T.pensandoAFundo}
      {duracaoMs !== undefined ? ` ${duracaoCurta(duracaoMs)}` : ""}
    </div>
  );
}

/** Uma linha cinza do ciclo de vida, com o ícone do meio que está sendo gerado. */
export function LinhaRastro({ midia, texto }: { midia: MidiaCiclo; texto: string }) {
  const Icone = midia === "video" ? Film : ImageIcon;
  return (
    <div className="ciclo-rastro">
      <Icone size={14} />
      <span>{texto}</span>
    </div>
  );
}

/** O selo do modelo que rodou — na referência, `Nano2`. */
export function SeloModelo({ nome }: { nome: string }) {
  return (
    <div className="ciclo-rastro">
      <Bot size={14} />
      <span>{nome}</span>
    </div>
  );
}

export interface AcaoRegua {
  rotulo: string;
  aoAtivar: () => void;
}

/**
 * A régua: Copiar · Gostei · Não gostei (exclusivos entre si) · Mais.
 *
 * O menu de "Mais" carrega os dois verbos que o dicionário `mediaResult` do
 * bloco define e que a captura não tem onde mostrar (`locate` e `edit`) — em vez
 * de um botão que abre o nada.
 */
export function ReguaResposta({
  texto,
  voto,
  aoVotar,
  aoLocalizar,
  aoEditar,
}: {
  texto: string;
  voto?: TurnoCiclo["voto"];
  aoVotar: (v: NonNullable<TurnoCiclo["voto"]>) => void;
  aoLocalizar?: () => void;
  aoEditar?: () => void;
}) {
  const [copiado, setCopiado] = React.useState(false);
  const [menu, setMenu] = React.useState(false);
  const caixa = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (!copiado) return;
    const t = setTimeout(() => setCopiado(false), 1200);
    return () => clearTimeout(t);
  }, [copiado]);

  /* Clique fora e Esc fecham o menu — sem isso ele fica pendurado ao rolar. */
  React.useEffect(() => {
    if (!menu) return;
    const fora = (e: MouseEvent) => {
      if (!caixa.current?.contains(e.target as Node)) setMenu(false);
    };
    const tecla = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMenu(false);
    };
    document.addEventListener("mousedown", fora);
    document.addEventListener("keydown", tecla);
    return () => {
      document.removeEventListener("mousedown", fora);
      document.removeEventListener("keydown", tecla);
    };
  }, [menu]);

  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(texto);
      setCopiado(true);
    } catch {
      /* clipboard bloqueado (contexto não seguro): sem sinal falso de sucesso */
    }
  };

  const acoes: AcaoRegua[] = [];
  if (aoLocalizar) acoes.push({ rotulo: T.midia.locate, aoAtivar: aoLocalizar });
  if (aoEditar) acoes.push({ rotulo: T.midia.edit, aoAtivar: aoEditar });

  return (
    <div className="ciclo-regua" ref={caixa}>
      <button type="button" title={copiado ? T.regua.copiado : T.regua.copiar} onClick={copiar}>
        {copiado ? <Check size={16} /> : <Copy size={16} />}
      </button>

      {/* Os dois votos são exclusivos entre si, como na referência. */}
      <button
        type="button"
        title={T.regua.cima}
        aria-pressed={voto === "cima"}
        onClick={() => aoVotar("cima")}
      >
        <ChevronUp size={16} />
      </button>
      <button
        type="button"
        title={T.regua.baixo}
        aria-pressed={voto === "baixo"}
        onClick={() => aoVotar("baixo")}
      >
        <ChevronDown size={16} />
      </button>

      {acoes.length > 0 && (
        <>
          <button
            type="button"
            title={T.regua.mais}
            aria-expanded={menu}
            aria-haspopup="menu"
            onClick={() => setMenu(v => !v)}
          >
            <MoreHorizontal size={16} />
          </button>

          {menu && (
            <ul className="ciclo-menu" role="menu">
              {acoes.map(a => (
                <li key={a.rotulo} role="none">
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      a.aoAtivar();
                      setMenu(false);
                    }}
                  >
                    {a.rotulo === T.midia.edit ? <Pencil size={14} /> : <Search size={14} />}
                    {a.rotulo}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  );
}

export interface Sugestao {
  texto: string;
  aoEscolher: () => void;
}

/** As continuações. A seta desliza 2px na diagonal e o texto vai para o link. */
export function SugestoesContinuacao({ sugestoes }: { sugestoes: Sugestao[] }) {
  if (sugestoes.length === 0) return null;
  return (
    <div className="ciclo-sugestoes">
      {sugestoes.map(s => (
        <button key={s.texto} type="button" className="ciclo-sugestao" onClick={s.aoEscolher}>
          <span>{s.texto}</span>
          <ArrowRight size={14} />
        </button>
      ))}
    </div>
  );
}
