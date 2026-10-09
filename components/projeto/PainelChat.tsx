"use client";

/* ============================================================
   O PAINEL DE CHAT — 368px encostado à esquerda

   Junta o cabeçalho, o thread, a barra de status e o composer, e é o
   único lugar que fala com o assistente. O que ele NÃO faz é gerar
   mídia: isso é o ciclo do Cobalto, que escuta `projeto:enviado` em
   `lib/projetoSessao.ts` e escreve o artefato de volta lá. Enquanto o
   ciclo não aterrissa, a conversa já funciona sozinha — o que não
   funciona não é desenhado.

   O painel colapsa com `translate(calc(-100% - 24px))` + `opacity: 0`,
   e ao mesmo tempo `--design-app-v2-toolbar-left` cai de 388 para 12,
   que é o que faz a barra do canvas deslizar em .2s. Essa variável é
   contrato: quem a lê é a frente do canvas.
   ============================================================ */

import * as React from "react";
import { useWorkflowStore } from "@/lib/store";
import { useChatSessionStore } from "@/lib/chatSessionStore";
import {
  useProjetoSessao,
  STATUS,
  type Anexo,
  type Mensagem,
} from "@/lib/projetoSessao";
import { AGENTE_PROMPT } from "@/lib/agentePrompt";
import { getToken } from "@/lib/galleryUtils";
import { lerTurno, type ChamadaCrua } from "@/lib/assistantTurno";
import {
  anexosComoTexto,
  aplicarChamadas,
  grafoComoTexto,
  modelosComoTexto,
  resumoEmTexto,
  type ResumoDaLeva,
} from "@/lib/projetoFluxo";
import { lerModoExecucao } from "@/lib/modoExecucao";
import { PainelCabecalho } from "./PainelCabecalho";
import { PainelThread } from "./PainelThread";
import { PainelStatus } from "./PainelStatus";
import { PainelComposer } from "./PainelComposer";
import "@/components/projeto/painel.css";

/** Uma mensagem no formato neutro que a rota traduz para cada dialeto. */
type MensagemApi = {
  role: "system" | "user" | "assistant" | "tool";
  content: string;
  toolCalls?: ChamadaCrua[];
  toolCallId?: string;
  /** Só em `user`: as imagens que foram junto — a rota as manda como visão. */
  images?: string[];
};

/** A legenda que vai no fim do texto: diz ao modelo qual imagem é qual. */
function legendaDosAnexos(anexos: Anexo[]): string {
  if (anexos.length === 0) return "";
  const itens = anexos.map((a, i) =>
    `imagem ${i + 1} desta mensagem = @${a.rotulo} (${a.tipo}, ${a.largura}×${a.altura}${a.nome ? `, "${a.nome}"` : ""})`,
  );
  return `\n\n[Anexos: ${itens.join("; ")}]`;
}

type LevaPendente = {
  chamadas: ChamadaCrua[];
  historico: MensagemApi[];
  respostaId: string;
  /** Os anexos que a leva pode citar — a foto da leva, não a de agora. */
  anexos: Anexo[];
};

/** Uma linha do cartão de confirmação, no vocabulário do usuário. */
function descreverChamada(c: ChamadaCrua): string {
  const a = c.arguments as Record<string, unknown>;
  switch (c.name) {
    case "criar_no":
      return `Criar um nó ${String(a.tipo ?? "")}`;
    case "conectar":
      return `Ligar ${String(a.de ?? "")} → ${String(a.para ?? "")} (${String(a.entrada ?? "")})`;
    case "definir_no":
      return `Ajustar o nó ${String(a.no ?? "")}`;
    case "montar_fluxo_imagem_video": {
      const n = Number(a.quantidade ?? 0) || 0;
      const refs = Array.isArray(a.referencias) ? (a.referencias as string[]).filter(Boolean) : [];
      const comRefs = refs.length ? ` usando @${[...new Set(refs)].join(", @")}` : "";
      return `Montar um fluxo de ${n} ramo(s): ${n * 4} nós e ${n * 3} ligações${comRefs}`;
    }
    case "usar_anexo":
      return `Colocar @${String(a.anexo ?? "")} no grafo`;
    default:
      return c.name;
  }
}

export function PainelChat({ projetoId }: { projetoId: string }) {
  const sessao = useProjetoSessao((e) => e.sessoes[projetoId]);
  const painelAberto = useProjetoSessao((e) => e.painelAberto);
  const {
    alternarPainel,
    renomearProjeto,
    renomearSessao,
    novaSessao,
    enviar,
    acrescentar,
    atualizarMensagem,
    avaliar,
    definirStatus,
    localizarNoCanvas,
    esvaziarBandeja,
    atualizarAnexo,
  } = useProjetoSessao();

  const setSettingsOpen = useWorkflowStore((s) => s.setSettingsOpen);
  const preferredModel = useChatSessionStore((s) => s.preferredModel);

  const [rascunho, setRascunho] = React.useState("");
  const [ocupado, setOcupado] = React.useState(false);
  /* A leva que o modo "Pedir" segurou, esperando o aval. */
  const [pendente, setPendente] = React.useState<LevaPendente | null>(null);
  const abortRef = React.useRef<AbortController | null>(null);

  React.useEffect(() => () => abortRef.current?.abort(), []);

  /* Memoizados porque `despachar` depende de `mensagens`: sem isso o
     `??` cria um array novo a cada render e o callback nunca estabiliza. */
  const mensagens = React.useMemo(() => sessao?.mensagens ?? [], [sessao?.mensagens]);
  const artefatos = React.useMemo(() => sessao?.artefatos ?? {}, [sessao?.artefatos]);
  const status = sessao?.status ?? "";

  /* ── O turno, agora com ferramentas ────────────────────────────────
     Deixou de ser um pedido e uma resposta: o modelo pode CHAMAR, o app
     executa no grafo, devolve o resultado e o modelo narra. Daí o laço.

     O teto de três voltas não é medo de laço infinito — é o custo: cada
     volta é uma chamada paga. Três dão folga para montar, corrigir um id
     errado e narrar; mais que isso é o modelo se perdendo, e aí é melhor
     parar e dizer o que foi feito. */
  const despachar = React.useCallback(async (texto: string) => {
    const limpo = texto.trim();
    /* A bandeja vai junto: uma mensagem pode ser só fotos. */
    const referencias = sessao?.referencias ?? {};
    const anexosDaMensagem = (sessao?.bandeja ?? [])
      .map((id) => referencias[id])
      .filter((a): a is Anexo => !!a);
    if ((!limpo && anexosDaMensagem.length === 0) || ocupado) return;

    enviar(projetoId, limpo, anexosDaMensagem.map((a) => a.id));
    esvaziarBandeja(projetoId);
    setRascunho("");
    setOcupado(true);

    /* O título da sessão é gerado a partir do primeiro prompt, como na
       referência (`New chat` → `Generate robot mascot illustration`). */
    if (mensagens.length === 0) {
      const base = limpo || `Conversa sobre ${anexosDaMensagem.map((a) => a.rotulo).join(", ")}`;
      const curto = base.length > 48 ? `${base.slice(0, 48).trimEnd()}…` : base;
      renomearSessao(projetoId, curto);
    }

    const respostaId = acrescentar(projetoId, {
      papel: "agente",
      texto: "",
      escrevendo: true,
    });

    /* Todos os anexos que a conversa já viu, na ordem, para o índice do
       contexto e para as ferramentas resolverem "@foto 1". */
    const todosAnexos = Object.values(referencias).sort((a, b) => a.em - b.em);

    /* O GRAFO É O CONTEXTO. Sem isto o assistente propõe o que já
       existe — é metade do valor do pedido. Vai numa mensagem de sistema
       à parte da persona, porque muda a cada turno e a persona não. */
    const contextoDoGrafo = [
      "Você está dentro de um projeto do Pitch Studio e pode escrever no grafo dele",
      "usando as ferramentas. Monte; não gere: quem decide executar é o usuário, pela",
      "pílula de modo de execução. Use apenas ids de modelo da lista abaixo.",
      "",
      grafoComoTexto(),
      "",
      anexosComoTexto(todosAnexos),
      "",
      modelosComoTexto(),
    ].join("\n");

    /* Cada mensagem do usuário leva as próprias imagens e a legenda de
       quem é quem. A rota manda as imagens como visão na mensagem certa
       — é o que deixa "@foto 1" continuar valendo três turnos depois. */
    const paraApi = (textoDaMensagem: string, anexoIds: string[] | undefined): MensagemApi => {
      const anexos = (anexoIds ?? []).map((id) => referencias[id]).filter((a): a is Anexo => !!a);
      const corpo = textoDaMensagem || "Analise os anexos e proponha o fluxo.";
      return {
        role: "user",
        content: corpo + legendaDosAnexos(anexos),
        ...(anexos.length ? { images: anexos.map((a) => a.url) } : {}),
      };
    };

    const historico: MensagemApi[] = [
      { role: "system", content: AGENTE_PROMPT },
      { role: "system", content: contextoDoGrafo },
      ...mensagens.map((m) =>
        m.papel === "usuario"
          ? paraApi(m.texto, m.anexoIds)
          : { role: "assistant" as const, content: m.texto },
      ),
      paraApi(limpo, anexosDaMensagem.map((a) => a.id)),
    ];

    /* O que a leva precisa além do grafo. Depois de aplicar, o `noId`
       volta para o anexo — é o que faz o chip marcar "no canvas" e o
       próximo `usar_anexo` reaproveitar o nó em vez de duplicar. */
    const contextoDaLeva = { anexos: todosAnexos };
    const gravarNos = (usados: ResumoDaLeva["anexosUsados"]) => {
      for (const u of usados) {
        atualizarAnexo(projetoId, u.anexoId, { noId: u.noId });
        const alvo = todosAnexos.find((a) => a.id === u.anexoId);
        if (alvo) alvo.noId = u.noId;
      }
    };

    const abort = new AbortController();
    abortRef.current = abort;

    const token = await getToken();
    const umTurno = async () => {
      const res = await fetch("/api/assistant", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          model: preferredModel,
          messages: historico,
          tools: true,
          stream: true,
        }),
        signal: abort.signal,
      });
      if (!res.ok || !res.body) {
        let motivo = "Não foi possível enviar a mensagem";
        try { const j = await res.json(); motivo = j.error ?? motivo; }
        catch { motivo = await res.text().catch(() => motivo); }
        throw new Error(motivo);
      }
      return lerTurno(res.body, (parcial) =>
        atualizarMensagem(projetoId, respostaId, { texto: parcial }),
      );
    };

    try {
      let narracao = "";
      let feito: ResumoDaLeva | null = null;
      let falhaNoFluxo: string | null = null;

      /* Quatro voltas: entender + usar os anexos, montar, corrigir um id,
         narrar. Cada uma é uma chamada paga; mais que isso é o modelo se
         perdendo, e aí é melhor parar e dizer o que foi feito. */
      for (let volta = 0; volta < 4; volta++) {
        const turno = await umTurno();
        /* Fica no console de propósito: é o único rastro do que o modelo
           pediu em cada volta quando o grafo sai diferente do esperado. */
        console.info(`[projeto] turno ${volta + 1}`, {
          texto: turno.texto,
          chamadas: turno.chamadas.map((c) => ({ nome: c.name, args: c.arguments })),
          falha: turno.falha,
        });
        if (turno.texto) narracao = turno.texto;
        falhaNoFluxo = turno.falha;

        if (turno.chamadas.length === 0) break;

        definirStatus(projetoId, "Montando o fluxo…");

        /* A PÍLULA DECIDE. Em "Pedir", a leva fica esperando o aval e
           nada é escrito; em "Auto", vai direto. É a mesma decisão que já
           governa a geração — não um segundo lugar para ela. */
        if (lerModoExecucao() === "confirmar") {
          setPendente({ chamadas: turno.chamadas, historico: [...historico], respostaId, anexos: todosAnexos });
          atualizarMensagem(projetoId, respostaId, {
            texto: narracao || "Preparei as mudanças no grafo. Confirme para aplicar.",
            escrevendo: false,
          });
          definirStatus(projetoId, "");
          return;
        }

        const { resultados, resumo } = aplicarChamadas(
          turno.chamadas.map((c) => ({ id: c.id, nome: c.name, argumentos: c.arguments })),
          contextoDaLeva,
        );
        gravarNos(resumo.anexosUsados);
        feito = feito
          ? {
              nosCriados: feito.nosCriados + resumo.nosCriados,
              arestasCriadas: feito.arestasCriadas + resumo.arestasCriadas,
              nosAlterados: feito.nosAlterados + resumo.nosAlterados,
              falhas: [...feito.falhas, ...resumo.falhas],
              anexosUsados: [...feito.anexosUsados, ...resumo.anexosUsados],
            }
          : resumo;

        historico.push({ role: "assistant", content: turno.texto, toolCalls: turno.chamadas });
        for (const r of resultados) {
          historico.push({ role: "tool", toolCallId: r.id, content: r.saida });
        }
      }

      const rodape = feito ? `\n\n${resumoEmTexto(feito)}` : "";
      if (!narracao && !feito) {
        atualizarMensagem(projetoId, respostaId, {
          texto: falhaNoFluxo
            ? `O assistente não respondeu: ${falhaNoFluxo}`
            : "O assistente não respondeu.",
          escrevendo: false,
        });
        definirStatus(projetoId, STATUS.erro);
        return;
      }

      atualizarMensagem(projetoId, respostaId, {
        texto: (narracao || "Pronto.") + rodape,
        escrevendo: false,
      });
      definirStatus(projetoId, "");
    } catch (err) {
      if ((err as Error)?.name !== "AbortError") {
        /* A mensagem na tela é para quem está conversando; o motivo
           técnico vai para o console, senão a falha fica sem rastro. */
        console.error("[projeto] falha ao falar com o assistente:", err);
        atualizarMensagem(projetoId, respostaId, {
          texto: (err as Error)?.message ?? "Não foi possível enviar a mensagem.",
          escrevendo: false,
        });
        definirStatus(projetoId, STATUS.erro);
      } else {
        definirStatus(projetoId, "");
      }
    } finally {
      setOcupado(false);
      abortRef.current = null;
    }
  }, [
    ocupado, projetoId, mensagens, preferredModel,
    sessao?.bandeja, sessao?.referencias,
    enviar, acrescentar, atualizarMensagem, definirStatus, renomearSessao,
    esvaziarBandeja, atualizarAnexo,
  ]);

  /* O aval do modo "Pedir": aplica a leva que ficou esperando. O undo
     continua sendo um só — quem foi esperar foi a chamada de
     `aplicarChamadas`, não a foto que ela tira. */
  const confirmarLeva = React.useCallback(() => {
    if (!pendente) return;
    const { chamadas, respostaId, anexos } = pendente;
    setPendente(null);
    const { resumo } = aplicarChamadas(
      chamadas.map((c) => ({ id: c.id, nome: c.name, argumentos: c.arguments })),
      { anexos },
    );
    for (const u of resumo.anexosUsados) atualizarAnexo(projetoId, u.anexoId, { noId: u.noId });
    atualizarMensagem(projetoId, respostaId, {
      texto: `${resumoEmTexto(resumo)}`,
      escrevendo: false,
    });
  }, [pendente, projetoId, atualizarMensagem, atualizarAnexo]);


  return (
    <>
      <aside className="pj-painel" data-colapsado={painelAberto ? undefined : "true"}>
        <div className="pj-caixa">
          <PainelCabecalho
            tituloProjeto={sessao?.tituloProjeto ?? "Sem título"}
            tituloSessao={sessao?.tituloSessao ?? "Nova conversa"}
            onRenomearProjeto={(t) => renomearProjeto(projetoId, t)}
            onNovaSessao={() => novaSessao(projetoId)}
            onColapsar={alternarPainel}
          />

          <PainelThread
            mensagens={mensagens as Mensagem[]}
            artefatos={artefatos}
            anexos={sessao?.referencias ?? {}}
            onAvaliar={(id, voto) => avaliar(projetoId, id, voto)}
            onSugestao={(t) => void despachar(t)}
            onLocalizar={(aid) => localizarNoCanvas(projetoId, aid)}
            vazio={
              <div className="pj-vazio">
                <strong>{sessao?.tituloProjeto ?? "Sem título"}</strong>
                <span>Descreva o que você quer criar e a conversa começa aqui.</span>
              </div>
            }
          />

          <div className="pj-area-entrada">
            {/* O modo "Pedir" segura a leva aqui. A pílula é o único
                lugar dessa decisão: não há um segundo interruptor. */}
            {pendente && (
              <div className="pj-leva" role="dialog" aria-label="Confirmar as mudanças no grafo">
                <div className="pj-leva-titulo">Aplicar no grafo?</div>
                <ul className="pj-leva-lista">
                  {pendente.chamadas.map((c) => (
                    <li key={c.id}>{descreverChamada(c)}</li>
                  ))}
                </ul>
                <div className="pj-leva-acoes">
                  <button type="button" onClick={() => setPendente(null)}>Descartar</button>
                  <button type="button" className="pj-leva-btn--marca" onClick={confirmarLeva}>
                    Aplicar
                  </button>
                </div>
              </div>
            )}

            <PainelStatus texto={status} />
            <PainelComposer
              projetoId={projetoId}
              valor={rascunho}
              onChange={setRascunho}
              onEnviar={() => void despachar(rascunho)}
              ocupado={ocupado}
              aoAbrirAjustes={() => setSettingsOpen(true)}
            />
          </div>
        </div>
      </aside>

      {/* Com o painel fora da tela não sobra nada clicável no canto. A
          referência reabre pela barra do canvas, que é de outra frente e
          ainda não aterrissou; este botão ocupa o mesmo lugar (12px) e
          some quando o painel volta. */}
      {!painelAberto && (
        <button
          type="button"
          className="pj-reabrir"
          onClick={alternarPainel}
          title="Mostrar o painel"
          aria-label="Mostrar o painel"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d="M3 3h18v18H3V3zm2 2v14h4V5H5zm6 0v14h8V5h-8z" />
          </svg>
        </button>
      )}
    </>
  );
}
