"use client";

/* ============================================================
   O CICLO DE GERAÇÃO — o motor e o turno

   O que a referência comprime em 6 segundos de demonstração aqui é o tempo
   real. Os quatro tempos do §1 do INFO viram quatro instantes medidos:

     t0  o usuário aperta enviar            → `enviadoEm`   → "Pensando..."
     t1  o /api/generate devolve o taskId   → `aceitoEm`    → o placeholder nasce
     …   a espera                            (sem porcentagem — ver abaixo)
     t2  o /api/job-stream resolve          → `concluidoEm` → a imagem entra

   `Pensando a fundo 2.0s` na referência é literal do quadro. Aqui é
   `t1 − t0` medido — o tempo que a NOSSA chamada levou. Nada é simulado.

   **Não há porcentagem, e é de propósito.** A referência faz polling em
   `/api/ai/media-generate/progress`, que devolve `progress: N`. O nosso
   `/api/job-stream` emite exatamente um evento terminal (`done` ou `error`) e
   o job (`lib/data`, `StudioJob`) guarda `pending | done | error` — não existe número de
   progresso em lugar nenhum da nossa pilha. Desenhar uma barra subindo seria
   inventar o dado. O que fica é o que a referência também mostra na tela: o
   shimmer e a pílula "Gerando".

   Nada aqui importa arquivo de outra frente. A costura com o painel é por
   props e callbacks; quando o `lib/projetoSessao.ts` aterrissar, a página passa
   a espelhar `turnos` para lá sem que este arquivo mude.
   ============================================================ */

import * as React from "react";
import { getToken } from "@/lib/galleryUtils";
import { IMAGE_MODELS, VIDEO_MODELS } from "@/lib/modelConfig";
import { CicloArtefato } from "./CicloPlaceholder";
import {
  BlocoPensando,
  LinhaRastro,
  ReguaResposta,
  SeloModelo,
  SugestoesContinuacao,
  type Sugestao,
} from "./RastroAgente";
import {
  T,
  dataDoTurno,
  duracaoCurta,
  geometriaDoArtefato,
  type ArtefatoCiclo,
  type MidiaCiclo,
  type TurnoCiclo,
} from "./CicloTextos";
import { Download, ImagePlus } from "@/components/icones";
import "./ciclo.css";

/* ============================================================
   1) O motor
   ============================================================ */

export interface PedidoCiclo {
  prompt: string;
  modelId: string;
  aspectRatio: string;
  midia?: MidiaCiclo;
}

function novoId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `t-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function nomeDoModelo(modelId: string, midia: MidiaCiclo): string {
  const lista = midia === "video" ? VIDEO_MODELS : IMAGE_MODELS;
  return lista.find(m => m.id === modelId)?.name ?? modelId;
}

export interface RetornoCiclo {
  turnos: TurnoCiclo[];
  /** O texto da barra de status; `null` quando não há nada acontecendo. */
  status: string | null;
  gerando: boolean;
  enviar: (pedido: PedidoCiclo) => Promise<void>;
  votar: (turnoId: string, voto: NonNullable<TurnoCiclo["voto"]>) => void;
}

export function useCicloGeracao(opcoes?: {
  /** Turnos já conhecidos (retomada): os que estão gerando reabrem o SSE. */
  turnosIniciais?: TurnoCiclo[];
  /** Chamado a cada transição, para a sessão do projeto espelhar o estado. */
  aoMudar?: (turnos: TurnoCiclo[]) => void;
}): RetornoCiclo {
  const [turnos, setTurnos] = React.useState<TurnoCiclo[]>(opcoes?.turnosIniciais ?? []);
  const aoMudar = opcoes?.aoMudar;

  React.useEffect(() => {
    aoMudar?.(turnos);
  }, [turnos, aoMudar]);

  const patch = React.useCallback((id: string, mudanca: Partial<TurnoCiclo>) => {
    setTurnos(atual => atual.map(t => (t.id === id ? { ...t, ...mudanca } : t)));
  }, []);

  /* ── A espera do resultado ─────────────────────────────────
     Uma fonte SSE por turno em geração. A lista vira string para ser dependência
     estável: o efeito só refaz as conexões quando o conjunto de tarefas
     pendentes muda de verdade. Vale também na remontagem — um turno retomado
     reabre o mesmo taskId. */
  const pendentes = React.useMemo(
    () =>
      turnos
        .filter(t => t.fase === "gerando" && t.artefato.taskId)
        .map(t => `${t.id}|${t.artefato.taskId}`)
        .join(","),
    [turnos],
  );

  React.useEffect(() => {
    if (!pendentes) return;

    const fontes = pendentes.split(",").map(chave => {
      const [turnoId, taskId] = chave.split("|");
      const es = new EventSource(`/api/job-stream?taskId=${encodeURIComponent(taskId)}`);

      es.onmessage = evento => {
        es.close();
        let corpo: {
          status?: string;
          imageUrl?: string;
          imageUrls?: string[];
          videoUrl?: string;
          error?: string;
        };
        try {
          corpo = JSON.parse(evento.data as string) as typeof corpo;
        } catch {
          return;
        }

        const url = corpo.videoUrl ?? corpo.imageUrl ?? corpo.imageUrls?.[0];
        const agora = Date.now();

        setTurnos(atual =>
          atual.map(t => {
            if (t.id !== turnoId) return t;
            if (corpo.status === "done" && url) {
              return { ...t, fase: "resultado", concluidoEm: agora, artefato: { ...t.artefato, url } };
            }
            return {
              ...t,
              fase: "erro",
              concluidoEm: agora,
              erro: corpo.error ?? T.status.generateError,
            };
          }),
        );
      };

      /* Fechar no erro evita a reconexão automática do EventSource; o turno é
         retomado na próxima montagem, com o mesmo taskId. */
      // O servidor fecha o stream perto do limite da função e o navegador
      // reconecta sozinho (CONNECTING). Só desiste quando ele mesmo desistiu.
      es.onerror = () => { if (es.readyState === EventSource.CLOSED) es.close(); };
      return es;
    });

    return () => fontes.forEach(es => es.close());
  }, [pendentes]);

  const enviar = React.useCallback(
    async (pedido: PedidoCiclo) => {
      const midia = pedido.midia ?? "imagem";
      const { largura, altura } = geometriaDoArtefato(pedido.aspectRatio);

      const artefato: ArtefatoCiclo = {
        id: novoId(),
        midia,
        modelId: pedido.modelId,
        modelName: nomeDoModelo(pedido.modelId, midia),
        aspectRatio: pedido.aspectRatio,
        larguraMundo: largura,
        alturaMundo: altura,
      };

      const turno: TurnoCiclo = {
        id: novoId(),
        prompt: pedido.prompt.trim(),
        fase: "enviado",
        artefato,
        enviadoEm: Date.now(),
      };

      setTurnos(atual => [...atual, turno]);

      try {
        const token = await getToken();
        const res = await fetch("/api/generate", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token ?? "guest"}` },
          body: JSON.stringify({
            prompt: turno.prompt,
            model: pedido.modelId,
            aspectRatio: pedido.aspectRatio,
            quality: "1k",
            imageUrls: [],
          }),
        });

        const texto = await res.text();
        let corpo: { taskId?: string; error?: string } = {};
        try {
          corpo = JSON.parse(texto) as { taskId?: string; error?: string };
        } catch {
          throw new Error(res.ok ? "Resposta inválida do servidor" : `Erro ${res.status}`);
        }
        if (!res.ok || !corpo.taskId) throw new Error(corpo.error ?? `Erro ${res.status}`);

        /* t1: a tarefa foi aceita. É aqui que o placeholder nasce nos dois
           lugares, e é este instante que fecha a conta do "Pensando a fundo". */
        patch(turno.id, {
          fase: "gerando",
          aceitoEm: Date.now(),
          artefato: { ...artefato, taskId: corpo.taskId },
        });
      } catch (e) {
        patch(turno.id, {
          fase: "erro",
          concluidoEm: Date.now(),
          erro: e instanceof Error ? e.message : T.status.generateError,
        });
      }
    },
    [patch],
  );

  const votar = React.useCallback(
    (turnoId: string, voto: NonNullable<TurnoCiclo["voto"]>) => {
      setTurnos(atual =>
        atual.map(t =>
          t.id === turnoId ? { ...t, voto: t.voto === voto ? undefined : voto } : t,
        ),
      );
    },
    [],
  );

  /* A barra de status espelha a fase do turno mais recente que ainda anda. */
  const emCurso = [...turnos].reverse().find(t => t.fase === "enviado" || t.fase === "gerando");
  const status = !emCurso
    ? null
    : emCurso.fase === "enviado"
      ? T.status.thinking
      : `${T.gerando[emCurso.artefato.midia]} com ${emCurso.artefato.modelName}`;

  return { turnos, status, gerando: !!emCurso, enviar, votar };
}

/* ============================================================
   2) As continuações reais

   A referência sugere duas continuações escritas pelo agente. Não temos agente
   escrevendo, e chamar o `/api/assistant` a cada geração gastaria crédito do
   usuário sem ele pedir. O que temos são continuações VERDADEIRAS e imediatas:
   a mesma cena na outra proporção, e a mesma cena no próximo modelo. Cada uma
   dispara de fato.
   ============================================================ */

export function sugestoesDoTurno(
  turno: TurnoCiclo,
  enviar: (p: PedidoCiclo) => void,
): Sugestao[] {
  const lista = turno.artefato.midia === "video" ? VIDEO_MODELS : IMAGE_MODELS;
  const i = lista.findIndex(m => m.id === turno.artefato.modelId);
  const proximo = lista[(i + 1) % lista.length];

  const alvo = turno.artefato.aspectRatio === "1:1" ? "16:9" : "1:1";
  const aceitaAlvo = lista[i]?.ratios.includes(alvo) ?? false;

  const fora: Sugestao[] = [];

  if (aceitaAlvo) {
    fora.push({
      texto: `Gerar de novo em ${alvo}`,
      aoEscolher: () =>
        enviar({ prompt: turno.prompt, modelId: turno.artefato.modelId, aspectRatio: alvo, midia: turno.artefato.midia }),
    });
  }

  if (proximo && proximo.id !== turno.artefato.modelId) {
    fora.push({
      texto: `Gerar de novo com ${proximo.name}`,
      aoEscolher: () =>
        enviar({
          prompt: turno.prompt,
          modelId: proximo.id,
          aspectRatio: proximo.ratios.includes(turno.artefato.aspectRatio)
            ? turno.artefato.aspectRatio
            : proximo.ratios[0],
          midia: turno.artefato.midia,
        }),
    });
  }

  return fora;
}

/**
 * O parágrafo da resposta. A referência tem o agente escrevendo sobre o
 * resultado; nós temos os fatos do que rodou — modelo, proporção e o tempo real.
 * Fatos, não prosa inventada.
 */
export function respostaDoTurno(turno: TurnoCiclo): string {
  const { artefato } = turno;
  const feito = artefato.midia === "video" ? "Vídeo gerado" : "Imagem gerada";
  const duracao =
    turno.concluidoEm && turno.aceitoEm
      ? ` A geração levou ${duracaoCurta(turno.concluidoEm - turno.aceitoEm)}.`
      : "";
  return `${feito} com ${artefato.modelName} em ${artefato.aspectRatio}.${duracao}`;
}

/* ============================================================
   3) O turno na thread
   ============================================================ */

/** A altura da miniatura sai da proporção do artefato, sobre a coluna de 332. */
const COLUNA = 332;

export function TurnoDoCiclo({
  turno,
  aoInserirNoCanvas,
  aoLocalizarNoCanvas,
  aoEditar,
  aoVotar,
  sugestoes = [],
}: {
  turno: TurnoCiclo;
  aoInserirNoCanvas?: (artefato: ArtefatoCiclo) => void;
  aoLocalizarNoCanvas?: (artefato: ArtefatoCiclo) => void;
  aoEditar?: (turno: TurnoCiclo) => void;
  aoVotar: (turnoId: string, voto: NonNullable<TurnoCiclo["voto"]>) => void;
  sugestoes?: Sugestao[];
}) {
  const { artefato } = turno;
  const alturaMiniatura = Math.round((COLUNA * artefato.alturaMundo) / artefato.larguraMundo);
  const agente = T.agente[artefato.midia];
  const mostrouPlaceholder = turno.fase === "gerando" || turno.fase === "resultado";

  const baixar = () => {
    if (!artefato.url) return;
    const nome = `${artefato.modelName.replace(/\s+/g, "-").toLowerCase()}-${artefato.id.slice(0, 8)}`;
    window.open(
      `/api/download?url=${encodeURIComponent(artefato.url)}&filename=${encodeURIComponent(nome)}`,
      "_blank",
      "noopener",
    );
  };

  return (
    <>
      <div className="ciclo-usuario-linha">
        <div className="ciclo-usuario-bolha">{turno.prompt}</div>
      </div>

      {/* A data abre o turno do assistente, como no quadro gen-03. */}
      {turno.fase !== "enviado" && <div className="ciclo-data">{dataDoTurno(turno.enviadoEm)}</div>}

      <div className="ciclo-assistente">
        {turno.aceitoEm && <BlocoPensando duracaoMs={turno.aceitoEm - turno.enviadoEm} />}

        {turno.fase === "gerando" && <LinhaRastro midia={artefato.midia} texto={T.ciclo.takenOver(agente)} />}
        {turno.fase === "resultado" && <LinhaRastro midia={artefato.midia} texto={T.ciclo.completed(agente)} />}
        {turno.fase === "erro" && <LinhaRastro midia={artefato.midia} texto={T.ciclo.failed(agente)} />}

        {turno.fase !== "enviado" && <SeloModelo nome={artefato.modelName} />}

        {mostrouPlaceholder && (
          <div className="ciclo-midia">
            <CicloArtefato
              url={artefato.url}
              alt={turno.prompt}
              largura={COLUNA}
              altura={alturaMiniatura}
            >
              <div className="ciclo-midia-acoes">
                <button type="button" onClick={baixar}>
                  <Download size={14} />
                  {T.midia.download}
                </button>
                {aoInserirNoCanvas && (
                  <button type="button" onClick={() => aoInserirNoCanvas(artefato)}>
                    <ImagePlus size={14} />
                    {T.midia.insertToCanvas}
                  </button>
                )}
              </div>
            </CicloArtefato>
          </div>
        )}

        {turno.fase === "erro" && turno.erro && <div className="ciclo-falha">{turno.erro}</div>}

        {turno.fase === "resultado" && (
          <>
            {/* O segundo bloco não traz duração — é assim nos quadros. */}
            <BlocoPensando />
            <div className="ciclo-resposta">
              <p>{respostaDoTurno(turno)}</p>
            </div>
            <ReguaResposta
              texto={respostaDoTurno(turno)}
              voto={turno.voto}
              aoVotar={v => aoVotar(turno.id, v)}
              aoLocalizar={aoLocalizarNoCanvas ? () => aoLocalizarNoCanvas(artefato) : undefined}
              aoEditar={aoEditar ? () => aoEditar(turno) : undefined}
            />
            <SugestoesContinuacao sugestoes={sugestoes} />
          </>
        )}
      </div>
    </>
  );
}

/** A thread inteira: a coluna de 332 dentro da calha de 12 do painel. */
export function CicloThread({
  turnos,
  aoInserirNoCanvas,
  aoLocalizarNoCanvas,
  aoEditar,
  aoVotar,
  enviar,
}: {
  turnos: TurnoCiclo[];
  aoInserirNoCanvas?: (artefato: ArtefatoCiclo) => void;
  aoLocalizarNoCanvas?: (artefato: ArtefatoCiclo) => void;
  aoEditar?: (turno: TurnoCiclo) => void;
  aoVotar: (turnoId: string, voto: NonNullable<TurnoCiclo["voto"]>) => void;
  enviar: (p: PedidoCiclo) => void;
}) {
  const fim = React.useRef<HTMLDivElement>(null);

  /* A thread acompanha o que chega — o mesmo `scrollDown` do preview. */
  React.useEffect(() => {
    fim.current?.scrollIntoView({ block: "end" });
  }, [turnos]);

  return (
    <div className="ciclo-thread ciclo-raiz">
      <div className="ciclo-thread-inner">
        {turnos.map(t => (
          <TurnoDoCiclo
            key={t.id}
            turno={t}
            aoInserirNoCanvas={aoInserirNoCanvas}
            aoLocalizarNoCanvas={aoLocalizarNoCanvas}
            aoEditar={aoEditar}
            aoVotar={aoVotar}
            sugestoes={t.fase === "resultado" ? sugestoesDoTurno(t, enviar) : []}
          />
        ))}
        <div ref={fim} aria-hidden />
      </div>
    </div>
  );
}
