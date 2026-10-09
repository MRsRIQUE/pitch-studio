"use client";

/* ============================================================
   O ARTEFATO

   É o que separa esta tela do `/chat`: a coluna da direita não é um
   resumo da conversa, é o produto dela — e é editável. O modelo propõe,
   o usuário corrige o que quiser, e o que sai daqui para o Criar ou para
   o grafo é o texto corrigido, não o proposto.

   Três coisas são deliberadas:

   - **Cada pílula mostra dado real.** O id do modelo vem de
     `lib/modelConfig.ts` e a proporção é uma que aquele modelo aceita;
     `lib/estruturaIdeia.ts` conserta antes de chegar aqui e diz o que
     consertou. Onde a referência do Higgsfield mostra crédito, aqui não
     há nada: não temos preço por modelo, e um número ali seria inventado.
   - **As perguntas em aberto ficam à vista.** É o que impede o plano de
     parecer mais resolvido do que está.
   - **A entrega é por cena e por peça.** Uma cena vai sozinha para o
     Criar; o plano inteiro vira um grafo.
   ============================================================ */

/* As referências são fotos do usuário, já em disco. */
/* eslint-disable @next/next/no-img-element */

import * as React from "react";
import { ArrowRight, Copy, Check, Workflow } from "@/components/icones";
import { IMAGE_MODELS, VIDEO_MODELS } from "@/lib/modelConfig";
import type { Cena, Esboco, Estrutura } from "@/lib/estruturaIdeia";
import type { ModoEstrutura } from "@/lib/estruturaStore";

/* ── O esboço do briefing UGC ──
   É a etapa que o modo livre não tem: o modelo propõe ângulo, hook,
   roteiro e fluxo, e NADA de cena até o usuário aprovar aqui. O botão
   de aprovar é o único jeito de marcar `aprovado` — o modelo não marca. */
function BlocoEsboco({ esboco, ocupado, onAprovar }: { esboco: Esboco; ocupado: boolean; onAprovar?: () => void }) {
  return (
    <div className="est-esboco">
      <div className="est-esboco__topo">
        <span className="est-bloco__rotulo">Esboço</span>
        <span className={`est-esboco__estado${esboco.aprovado ? " is-aprovado" : ""}`}>
          {esboco.aprovado ? "Aprovado" : "Aguardando aprovação"}
        </span>
      </div>
      {esboco.angulo && <p className="est-esboco__linha"><b>Ângulo</b>{esboco.angulo}</p>}
      {esboco.hook && <p className="est-esboco__linha"><b>Hook</b>{esboco.hook}</p>}
      {esboco.roteiro && <p className="est-esboco__linha est-esboco__linha--fala"><b>Roteiro</b>{esboco.roteiro}</p>}
      {esboco.fluxo.length > 0 && (
        <ol className="est-esboco__fluxo">
          {esboco.fluxo.map((f, i) => <li key={i}>{f}</li>)}
        </ol>
      )}
      {!esboco.aprovado && onAprovar && (
        <div className="est-esboco__acoes">
          <button type="button" className="est-botao est-botao--principal" onClick={onAprovar} disabled={ocupado}>
            <Check size={14} />
            Aprovar esboço
          </button>
          <span className="est-esboco__dica">Quer mudar algo? Peça na conversa: outro hook, roteiro mais curto, outro ângulo.</span>
        </div>
      )}
    </div>
  );
}

function nomeDoModelo(id: string, video: boolean): string {
  const lista = video ? VIDEO_MODELS : IMAGE_MODELS;
  return lista.find(m => m.id === id)?.name ?? id;
}

function CartaoCena({
  cena,
  indice,
  onPrompt,
  onAbrirNoCriar,
}: {
  cena: Cena;
  indice: number;
  onPrompt: (indice: number, prompt: string) => void;
  onAbrirNoCriar: (cena: Cena) => void;
}) {
  const [copiado, setCopiado] = React.useState(false);
  const [editando, setEditando] = React.useState(false);

  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(cena.prompt);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 1400);
    } catch {
      /* Sem permissão de área de transferência o botão simplesmente não
         confirma — melhor do que um "copiado" que não copiou. */
    }
  };

  return (
    <article className="est-cena">
      <div className="est-cena__topo">
        <span className="est-cena__n">{String(indice + 1).padStart(2, "0")}</span>
        <h3 className="est-cena__titulo">{cena.titulo}</h3>
      </div>

      {cena.descricao && <p className="est-cena__descricao">{cena.descricao}</p>}

      <div className="est-cena__params">
        <span className="est-param">{nomeDoModelo(cena.modelo, false)}</span>
        <span className="est-param">{cena.proporcao}</span>
        {cena.modeloVideo && (
          <span className="est-param est-param--video">
            {nomeDoModelo(cena.modeloVideo, true)}
            {cena.duracao > 0 ? ` · ${cena.duracao}s` : ""}
          </span>
        )}
      </div>

      {editando ? (
        <textarea
          className="est-campo"
          rows={5}
          value={cena.prompt}
          autoFocus
          onChange={e => onPrompt(indice, e.target.value)}
          onBlur={() => setEditando(false)}
          aria-label={`Prompt da cena ${indice + 1}`}
        />
      ) : (
        <p className="est-cena__prompt">{cena.prompt || "— sem prompt ainda —"}</p>
      )}

      <div className="est-cena__acoes">
        <button type="button" className="est-botao est-botao--miudo" onClick={() => setEditando(v => !v)}>
          {editando ? "Pronto" : "Editar"}
        </button>
        <button type="button" className="est-botao est-botao--miudo" onClick={copiar}>
          {copiado ? <Check size={12} /> : <Copy size={12} />}
          {copiado ? "Copiado" : "Copiar"}
        </button>
        <button
          type="button"
          className="est-botao est-botao--miudo"
          onClick={() => onAbrirNoCriar(cena)}
          disabled={!cena.prompt.trim()}
        >
          <ArrowRight size={12} />
          Abrir no Criar
        </button>
      </div>
    </article>
  );
}

export function PainelEstrutura({
  estrutura,
  ocupado,
  modo = "livre",
  onRoteiro,
  onPrompt,
  onAbrirNoCriar,
  onMontarNoGrafo,
  onAprovar,
}: {
  estrutura: Estrutura | null;
  /** O turno ainda está correndo: o artefato pode mudar embaixo do usuário. */
  ocupado: boolean;
  modo?: ModoEstrutura;
  onRoteiro: (roteiro: string) => void;
  onPrompt: (indice: number, prompt: string) => void;
  onAbrirNoCriar: (cena: Cena) => void;
  onMontarNoGrafo: () => void;
  /** Só no briefing UGC: marca o esboço como aprovado e pede as cenas. */
  onAprovar?: () => void;
}) {
  const cenas = estrutura?.cenas ?? [];
  const comPrompt = cenas.filter(c => c.prompt.trim()).length;
  const referencias = estrutura?.referencias ?? [];
  const temAlgo = Boolean(estrutura && (estrutura.roteiro || cenas.length || estrutura.esboco || referencias.length));

  return (
    <aside className="est-painel" aria-label="A estrutura da ideia">
      <div className="est-painel__topo">
        <h2>{estrutura?.titulo || "A estrutura"}</h2>
        <span className="est-painel__contagem">
          {cenas.length === 0 ? "—" : `${cenas.length} ${cenas.length === 1 ? "cena" : "cenas"}`}
        </span>
      </div>

      <div className="est-painel__corpo">
        {!estrutura || !temAlgo ? (
          <p className="est-painel__vazio">
            {modo === "ugc"
              ? "Preencha o briefing ao lado. Primeiro vem o esboço (ângulo, hook, roteiro e fluxo) para você aprovar; depois, as cenas com o prompt de produção — e daí você monta o grafo."
              : "Conte a ideia ao lado. A cada resposta, o roteiro e as cenas aparecem aqui — com o modelo e a proporção de cada uma — e daqui você leva para o Criar ou monta o grafo."}
          </p>
        ) : (
          <>
            {referencias.length > 0 && (
              <div className="est-bloco">
                <span className="est-bloco__rotulo">Referências</span>
                <div className="est-refs">
                  {referencias.map(r => (
                    <figure key={r.url} className="est-ref">
                      <img src={r.url} alt={r.rotulo} />
                      <figcaption>{r.rotulo}</figcaption>
                    </figure>
                  ))}
                </div>
              </div>
            )}

            {estrutura.esboco && <BlocoEsboco esboco={estrutura.esboco} ocupado={ocupado} onAprovar={onAprovar} />}

            {estrutura.formato && (
              <div className="est-bloco">
                <span className="est-bloco__rotulo">Formato</span>
                <p className="est-bloco__valor">{estrutura.formato}</p>
              </div>
            )}

            {estrutura.publico && (
              <div className="est-bloco">
                <span className="est-bloco__rotulo">Público</span>
                <p className="est-bloco__valor">{estrutura.publico}</p>
              </div>
            )}

            {estrutura.roteiro && (
              <div className="est-bloco">
                <span className="est-bloco__rotulo">Roteiro</span>
                <textarea
                  className="est-campo"
                  rows={Math.min(12, Math.max(3, estrutura.roteiro.split("\n").length + 1))}
                  value={estrutura.roteiro}
                  onChange={e => onRoteiro(e.target.value)}
                  aria-label="Roteiro"
                />
              </div>
            )}

            {cenas.length > 0 && (
              <div className="est-bloco">
                <span className="est-bloco__rotulo">Cenas</span>
                {cenas.map((cena, i) => (
                  <CartaoCena
                    key={i}
                    cena={cena}
                    indice={i}
                    onPrompt={onPrompt}
                    onAbrirNoCriar={onAbrirNoCriar}
                  />
                ))}
              </div>
            )}

            {estrutura.perguntas.length > 0 && (
              <div className="est-nota">
                <span className="est-bloco__rotulo">Falta decidir</span>
                <ul>
                  {estrutura.perguntas.map((q, i) => <li key={i}>{q}</li>)}
                </ul>
              </div>
            )}

            {estrutura.ajustes.length > 0 && (
              <div className="est-nota est-nota--ajustes">
                <span className="est-bloco__rotulo">Corrigido aqui</span>
                <ul>
                  {estrutura.ajustes.map((a, i) => <li key={i}>{a}</li>)}
                </ul>
              </div>
            )}
          </>
        )}
      </div>

      <div className="est-painel__rodape">
        <button
          type="button"
          className="est-botao est-botao--principal"
          onClick={onMontarNoGrafo}
          disabled={ocupado || comPrompt === 0}
          title={comPrompt === 0 ? "Nenhuma cena tem prompt ainda" : "Cria um projeto novo com um nó por cena"}
        >
          <Workflow size={14} />
          Montar no grafo
        </button>
        <button
          type="button"
          className="est-botao"
          onClick={() => { const c = cenas.find(x => x.prompt.trim()); if (c) onAbrirNoCriar(c); }}
          disabled={ocupado || comPrompt === 0}
        >
          <ArrowRight size={14} />
          Abrir no Criar
        </button>
      </div>
    </aside>
  );
}
