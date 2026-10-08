"use client";

/* ============================================================
   O THREAD — a coluna de 332px

   A ordem das peças é a do quadro `estados/img-01`, de cima para baixo:

     bolha do usuário → data → bloco `Deep thinking` → linhas de rastro
     → miniatura do artefato → resposta → régua → sugestões

   A miniatura e o nó do canvas nascem JUNTOS e do MESMO tamanho, e a
   mídia entra na caixa que o placeholder já ocupava. Por isso a altura
   sai da proporção do artefato, e não do que chegou: é o que impede o
   salto de layout que denuncia o clone preguiçoso.
   ============================================================ */

import * as React from "react";
import { GyroNaCaixa } from "@/components/notas/GyroNaCaixa";
import { copiarTexto } from "@/lib/copiarTexto";
import {
  ArrowRight,
  ChevronDown,
  ChevronUp,
  Copy,
  Download,
  ImageIcon,
  ImagePlus,
  Film,
  MoreHorizontal,
  Package,
  Sparkles,
} from "@/components/icones";
import {
  ROTULO_GERANDO,
  type Anexo,
  type Artefato,
  type LinhaRastro,
  type Mensagem,
  type TipoArtefato,
} from "@/lib/projetoSessao";
import "@/components/projeto/painel.css";

/* O `@foto 1` no texto sai destacado como o chip — é o mesmo
   referenciador visto de dois lugares. Só os rótulos de anexo contam;
   um `@` solto num e-mail fica como texto. */
const MENCAO = /(@(?:foto|video)\s\d+)/gi;
function comMencoes(texto: string): React.ReactNode {
  const partes = texto.split(MENCAO);
  if (partes.length === 1) return texto;
  /* Com um grupo de captura no `split`, as posições ímpares são as
     menções e as pares o texto entre elas. */
  return partes.map((p, i) =>
    i % 2 === 1
      ? <span className="pj-mencao-inline" key={i}>{p}</span>
      : <React.Fragment key={i}>{p}</React.Fragment>,
  );
}

const ICONE_RASTRO: Record<LinhaRastro["icone"], React.ComponentType<{ size?: number }>> = {
  imagem: ImageIcon,
  video: Film,
  audio: Package,
  "3d": Package,
  modelo: Sparkles,
};

/** A data da referência é `Sep 5, 2026`; aqui, o mesmo em português. */
function rotuloData(em: number): string {
  return new Date(em).toLocaleDateString("pt-BR", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function mesmoDia(a: number, b: number): boolean {
  const x = new Date(a);
  const y = new Date(b);
  return x.toDateString() === y.toDateString();
}

export function PainelThread({
  mensagens,
  artefatos,
  anexos = {},
  onAvaliar,
  onSugestao,
  onLocalizar,
  vazio,
}: {
  mensagens: Mensagem[];
  artefatos: Record<string, Artefato>;
  /** As referências da sessão, pelo id — para a bolha mostrar as fotos. */
  anexos?: Record<string, Anexo>;
  onAvaliar: (mensagemId: string, voto: "positiva" | "negativa") => void;
  onSugestao: (texto: string) => void;
  onLocalizar: (artefatoId: string) => void;
  vazio: React.ReactNode;
}) {
  const fimRef = React.useRef<HTMLDivElement>(null);
  const caixaRef = React.useRef<HTMLDivElement>(null);

  /* Só rola sozinho quando já estava no fim: quem subiu para reler uma
     mensagem antiga não quer ser puxado de volta a cada token. */
  React.useEffect(() => {
    const caixa = caixaRef.current;
    if (!caixa) return;
    const perto = caixa.scrollHeight - caixa.scrollTop - caixa.clientHeight < 80;
    if (perto) fimRef.current?.scrollIntoView({ block: "end" });
  }, [mensagens]);

  return (
    <div className="pj-thread" ref={caixaRef}>
      <div className="pj-thread-inner">
        {mensagens.length === 0 ? vazio : null}

        {mensagens.map((m, i) => {
          const anterior = mensagens[i - 1];
          const abreDia = !anterior || !mesmoDia(anterior.em, m.em);

          if (m.papel === "usuario") {
            const fotos = (m.anexoIds ?? []).map((id) => anexos[id]).filter((a): a is Anexo => !!a);
            return (
              <React.Fragment key={m.id}>
                {abreDia && i > 0 && <div className="pj-data">{rotuloData(m.em)}</div>}
                <div className="pj-usuario-linha">
                  {fotos.length > 0 && (
                    <div className="pj-usuario-anexos">
                      {fotos.map((a) => (
                        <div className="pj-usuario-anexo" key={a.id} title={a.nome ?? a.rotulo}>
                          {a.tipo === "video" ? (
                            <video src={a.url} muted preload="metadata" />
                          ) : (
                            /* eslint-disable-next-line @next/next/no-img-element */
                            <img src={a.url} alt={a.rotulo} />
                          )}
                          <span>@{a.rotulo}</span>
                        </div>
                      ))}
                    </div>
                  )}
                  {m.texto && <div className="pj-usuario-bolha">{comMencoes(m.texto)}</div>}
                </div>
              </React.Fragment>
            );
          }

          const artefato = m.artefatoId ? artefatos[m.artefatoId] : undefined;

          return (
            <React.Fragment key={m.id}>
              {abreDia && <div className="pj-data">{rotuloData(m.em)}</div>}
              <div className="pj-agente">
                {m.pensamento && (
                  <div className="pj-pensamento">
                    {m.pensamento.rotulo}
                    {m.pensamento.segundos !== undefined && ` ${m.pensamento.segundos.toFixed(1)}s`}
                  </div>
                )}

                {m.rastro?.map((linha, li) => {
                  const Icone = ICONE_RASTRO[linha.icone];
                  return (
                    <div className="pj-rastro" key={`${m.id}-r${li}`}>
                      <Icone size={16} />
                      <span>{linha.texto}</span>
                    </div>
                  );
                })}

                {artefato && <BlocoMidia artefato={artefato} onLocalizar={onLocalizar} />}

                {m.texto && <div className="pj-resposta">{m.texto}</div>}

                {/* A régua só aparece quando a resposta terminou de
                    chegar: avaliar um texto pela metade não faz sentido. */}
                {m.texto && !m.escrevendo && (
                  <div className="pj-regua">
                    <button
                      type="button"
                      title="Copiar"
                      aria-label="Copiar a resposta"
                      onClick={() => void copiarTexto(m.texto)}
                    >
                      <Copy size={14} />
                    </button>
                    <button
                      type="button"
                      title="Gostei"
                      aria-label="Gostei da resposta"
                      aria-pressed={m.avaliacao === "positiva"}
                      onClick={() => onAvaliar(m.id, "positiva")}
                    >
                      <ChevronUp size={14} />
                    </button>
                    <button
                      type="button"
                      title="Não gostei"
                      aria-label="Não gostei da resposta"
                      aria-pressed={m.avaliacao === "negativa"}
                      onClick={() => onAvaliar(m.id, "negativa")}
                    >
                      <ChevronDown size={14} />
                    </button>
                    <button type="button" title="Mais" aria-label="Mais ações">
                      <MoreHorizontal size={14} />
                    </button>
                  </div>
                )}

                {m.sugestoes && m.sugestoes.length > 0 && (
                  <div className="pj-sugestoes">
                    {m.sugestoes.map((s) => (
                      <button
                        key={s}
                        type="button"
                        className="pj-sugestao"
                        onClick={() => onSugestao(s)}
                      >
                        <span>{s}</span>
                        <ArrowRight size={14} />
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </React.Fragment>
          );
        })}

        <div ref={fimRef} />
      </div>
    </div>
  );
}

/* ── A miniatura ───────────────────────────────────────────────
   332 de largura; a altura é a proporção do artefato aplicada a 332.
   O placeholder e a mídia dividem a MESMA caixa. */
function BlocoMidia({
  artefato,
  onLocalizar,
}: {
  artefato: Artefato;
  onLocalizar: (artefatoId: string) => void;
}) {
  const altura = Math.round((332 * artefato.altura) / artefato.largura);

  if (artefato.estado !== "pronto" || !artefato.url) {
    return (
      <div className="pj-midia">
        {/* A CAIXA NAO MUDA: 332 x a altura que vem da proporcao do artefato.
            É ela que impede o layout de pular quando a imagem chega. O que
            saiu foi o shimmer; o loop entra DENTRO, centrado, sem opinar sobre
            o tamanho. */}
        <div className="pj-placeholder" style={{ width: 332, height: altura }}>
          <GyroNaCaixa />
        </div>
        <div className="pj-pilula-gerando">
          {artefato.estado === "erro" ? "Não deu certo" : ROTULO_GERANDO}
        </div>
      </div>
    );
  }

  return (
    <div className="pj-midia">
      {ehVideo(artefato.tipo) ? (
        <video src={artefato.url} width={332} height={altura} controls preload="metadata" />
      ) : (
        /* eslint-disable-next-line @next/next/no-img-element */
        <img src={artefato.url} alt="" width={332} height={altura} />
      )}
      <div className="pj-midia-acoes">
        <a
          href={artefato.url}
          download
          className="contents"
          aria-label="Baixar o resultado"
        >
          <button type="button" title="Baixar">
            <Download size={14} /> Baixar
          </button>
        </a>
        <button
          type="button"
          title="Localizar no canvas"
          onClick={() => onLocalizar(artefato.id)}
        >
          <ImagePlus size={14} /> Localizar no canvas
        </button>
      </div>
    </div>
  );
}

function ehVideo(tipo: TipoArtefato): boolean {
  return tipo === "video";
}
