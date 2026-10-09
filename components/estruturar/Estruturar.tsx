"use client";

/* ============================================================
   ESTRUTURAR A IDEIA — a tela

   O `/chat` responde; esta tela CONSTRÓI. A cada turno o assistente
   devolve duas coisas: uma prosa curta, que fica na conversa, e o
   artefato inteiro, que substitui a coluna da direita. O artefato é o
   que sai daqui — para o composer, uma cena por vez, ou para o grafo,
   o plano inteiro virando projeto.

   Duas decisões que valem explicar:

   1. **A estrutura vai no histórico como contexto, não como fala.** A
      mensagem guardada do assistente é só a prosa; o bloco é separado
      antes. Se reenviássemos só a prosa, o modelo perderia o plano no
      turno seguinte. Então o plano ATUAL — já com as edições do usuário
      — volta a cada pedido numa mensagem de sistema. O efeito colateral
      é o certo: corrigir o roteiro à direita muda o que o modelo
      continua, sem precisar dizer o que foi corrigido.

   2. **Um turno, sem laço de ferramenta.** A rota só declara as
      ferramentas do grafo quando `tools: true`; aqui não mandamos, e com
      isso o raciocínio estendido do provedor continua ligado
      (`thinkingFlag` na rota) — que é o que esta tela quer, já que o
      trabalho é planejar, não executar.
   ============================================================ */

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ComposerShell } from "@/components/gallery/Composer/ComposerShell";
import { PainelEstrutura } from "@/components/estruturar/PainelEstrutura";
import { BriefingUGC, type EnvioBriefing } from "@/components/estruturar/BriefingUGC";
import { lerTurno } from "@/lib/assistantTurno";
import { getToken } from "@/lib/galleryUtils";
import { remixToComposer } from "@/lib/remixHandoff";
import { useWorkflowStore } from "@/lib/store";
import {
  ESTRUTURA_VAZIA,
  lerEstrutura,
  moldeDoGrafo,
  promptDeSistema,
  promptDeSistemaUGC,
  separarTexto,
  type Cena,
  type Estrutura,
  type Referencia,
} from "@/lib/estruturaIdeia";
import { MODEL_GROUPS } from "@/lib/models";
import { useEstruturaStore, novoId, type MensagemEstrutura, type ModoEstrutura } from "@/lib/estruturaStore";
import "@/components/estruturar/estruturar.css";

/* Partidas: pedidos reais e completos, não temas soltos. Existem porque
   a primeira mensagem é a que decide a qualidade do plano, e "faça um
   vídeo" produz um plano genérico. */
const PARTIDAS = [
  "Um reel vertical de 15 segundos apresentando um tênis novo, com três cenas e narração curta.",
  "Uma sequência de quatro imagens para o lançamento de um café especial, mesma direção de arte.",
  "Um anúncio de 20 segundos para uma clínica odontológica, tom acolhedor, com cena de abertura e fechamento.",
];

const TEXTO_PADRAO = ["Conte a ideia. Eu devolvo o roteiro e as cenas."];
const TEXTO_UGC = ["Peça um ajuste no esboço — outro hook, roteiro mais curto, outro ângulo."];

/** O que o usuário manda junto com o texto: as fotos do briefing e as
 *  referências que elas viram no grafo. Só o briefing UGC preenche isto. */
type ExtrasDoTurno = {
  imagens?: string[];
  referencias?: Referencia[];
  /** Uma estrutura já editada neste mesmo instante (a aprovação do esboço)
      que ainda não chegou ao store pelo ciclo do React. */
  estruturaAtual?: Estrutura;
};

export function Estruturar() {
  const router = useRouter();
  /* `?modo=ugc` é a porta que a receita usa para cair direto no briefing. */
  const searchParams = useSearchParams();
  const modoDaUrl: ModoEstrutura = searchParams.get("modo") === "ugc" ? "ugc" : "livre";

  const sessoes = useEstruturaStore(s => s.sessoes);
  const modelo = useEstruturaStore(s => s.modelo);
  const criarSessao = useEstruturaStore(s => s.criarSessao);
  const definirModelo = useEstruturaStore(s => s.definirModelo);
  const renomear = useEstruturaStore(s => s.renomear);
  const adicionarMensagem = useEstruturaStore(s => s.adicionarMensagem);
  const atualizarMensagem = useEstruturaStore(s => s.atualizarMensagem);
  const definirEstrutura = useEstruturaStore(s => s.definirEstrutura);
  const addToast = useWorkflowStore(s => s.addToast);

  const [rascunho, setRascunho] = React.useState("");
  const [ocupado, setOcupado] = React.useState(false);
  const fimRef = React.useRef<HTMLDivElement>(null);

  /* O store é persistido: no servidor nasce vazio e no cliente vem cheio.
     A tela espera a hidratação antes de mostrar as partidas, senão elas
     piscariam por cima de uma conversa que já existe. */
  const hidratado = React.useSyncExternalStore(
    React.useCallback((avisar: () => void) => useEstruturaStore.persist.onFinishHydration(avisar), []),
    () => useEstruturaStore.persist.hasHydrated(),
    () => false,
  );

  /* A sessão corrente é DERIVADA, não guardada em estado: a mais recente
     do store. Criar no `useEffect` custaria uma sessão vazia a cada
     visita — e um `setState` dentro de efeito, que é o que a regra
     `react-hooks/set-state-in-effect` proíbe com razão. A sessão nasce no
     primeiro envio, que é quando ela passa a ter conteúdo. */
  const sessao = sessoes[0] ?? null;
  const sessaoId = sessao?.id ?? null;
  const mensagens = React.useMemo(() => sessao?.mensagens ?? [], [sessao]);
  const estrutura = sessao?.estrutura ?? null;

  /* ── O modo ──
     Com sessão, o modo é o dela (uma conversa livre não vira briefing no
     meio). Sem sessão, é o que o usuário escolheu, ou o da URL. Trocar de
     modo com uma conversa aberta abre uma sessão nova — a mesma coisa que
     o botão "Nova ideia" faz. */
  const [modoEscolhido, setModoEscolhido] = React.useState<ModoEstrutura>(modoDaUrl);
  const modoAtual: ModoEstrutura = sessao ? (sessao.modo ?? "livre") : modoEscolhido;

  const escolherModo = React.useCallback((m: ModoEstrutura) => {
    setModoEscolhido(m);
    const s = useEstruturaStore.getState().sessoes[0];
    if (s && (s.mensagens.length > 0 || (s.modo ?? "livre") !== m)) {
      criarSessao(m === "ugc" ? "Vídeo UGC" : "Nova ideia", m);
    }
  }, [criarSessao]);

  /* Chegando pela URL com `?modo=ugc`, a sessão corrente pode ser uma
     conversa livre: abre uma de briefing uma vez só, depois da hidratação
     (antes dela o store está vazio no cliente e a decisão sairia errada). */
  const urlAplicada = React.useRef(false);
  React.useEffect(() => {
    if (!hidratado || urlAplicada.current || modoDaUrl !== "ugc") return;
    urlAplicada.current = true;
    const s = useEstruturaStore.getState().sessoes[0];
    if (!s || s.mensagens.length > 0 || s.modo !== "ugc") criarSessao("Vídeo UGC", "ugc");
  }, [hidratado, modoDaUrl, criarSessao]);

  React.useEffect(() => {
    fimRef.current?.scrollIntoView({ block: "end" });
  }, [mensagens]);

  /* ── Edições no artefato ─────────────────────────────────── */

  const trocar = React.useCallback((patch: (e: Estrutura) => Estrutura) => {
    if (!sessaoId) return;
    definirEstrutura(sessaoId, patch(estrutura ?? ESTRUTURA_VAZIA));
  }, [sessaoId, estrutura, definirEstrutura]);

  const aoRoteiro = React.useCallback((roteiro: string) => {
    trocar(e => ({ ...e, roteiro }));
  }, [trocar]);

  const aoPrompt = React.useCallback((indice: number, prompt: string) => {
    trocar(e => ({ ...e, cenas: e.cenas.map((c, i) => (i === indice ? { ...c, prompt } : c)) }));
  }, [trocar]);

  /* ── As duas entregas ────────────────────────────────────── */

  const abrirNoCriar = React.useCallback((cena: Cena) => {
    /* Mesma porta que a Inspiração usa: escreve na chave que o composer
       lê ao montar e navega. Nada é importado da frente do composer. */
    const href = remixToComposer({
      prompt: cena.prompt,
      model: cena.modelo,
      aspectRatio: cena.proporcao,
      mediaType: "image",
    });
    if (!href) {
      addToast("Não foi possível levar a cena para o Criar.", "error");
      return;
    }
    router.push(href);
  }, [router, addToast]);

  const montarNoGrafo = React.useCallback(() => {
    if (!estrutura) return;
    const comPrompt = { ...estrutura, cenas: estrutura.cenas.filter(c => c.prompt.trim()) };
    if (comPrompt.cenas.length === 0) return;

    const molde = moldeDoGrafo(comPrompt);
    const loja = useWorkflowStore.getState();
    loja.createSpace(estrutura.titulo || "Ideia estruturada", molde);
    const id = useWorkflowStore.getState().activeSpaceId;
    addToast(
      `Projeto montado com ${comPrompt.cenas.length} ${comPrompt.cenas.length === 1 ? "cena" : "cenas"}. Nada foi gerado.`,
      "success",
    );
    router.push(`/workflow/${id}`);
  }, [estrutura, router, addToast]);

  /* ── O turno ─────────────────────────────────────────────── */

  const enviar = React.useCallback(async (texto: string, extras: ExtrasDoTurno = {}) => {
    const limpo = texto.trim();
    if (!limpo || ocupado) return;

    setRascunho("");
    setOcupado(true);

    /* Sessão nova no primeiro envio; daí em diante, a que já está aberta.
       A primeira frase a batiza, que é o que uma lista de sessões mostraria.
       No briefing UGC o nome é fixo: a primeira frase é "BRIEFING UGC". */
    const ugc = modoAtual === "ugc";
    const titulo = ugc ? "Vídeo UGC" : limpo.slice(0, 60);
    const nova = sessaoId === null;
    const id = sessaoId ?? criarSessao(titulo, modoAtual);
    const anteriores = nova ? [] : mensagens;

    const imagens = extras.imagens?.filter(Boolean) ?? [];
    const daVez: MensagemEstrutura = { id: novoId(), papel: "usuario", texto: limpo, ...(imagens.length ? { imagens } : {}) };
    const respostaId = novoId();
    adicionarMensagem(id, daVez);
    adicionarMensagem(id, { id: respostaId, papel: "assistente", texto: "", escrevendo: true });
    if (!nova && anteriores.length === 0) renomear(id, titulo);

    /* A base da validação: a estrutura corrente (com a aprovação recém
       feita, quando houver) ou, no primeiro turno do briefing, só as
       referências — que nunca vêm do modelo e precisam sobreviver. */
    const atual = extras.estruturaAtual ?? (nova ? null : estrutura);
    const base: Estrutura | null =
      atual ?? (extras.referencias?.length ? { ...ESTRUTURA_VAZIA, referencias: extras.referencias } : null);
    if (!atual && base) definirEstrutura(id, base);

    const contexto = atual
      ? `ESTRUTURA ATUAL (já com as edições do usuário; continue a partir dela):\n\`\`\`estrutura\n${JSON.stringify(
          { ...atual, ajustes: undefined, referencias: undefined }, null, 2,
        )}\n\`\`\``
      : "Ainda não há estrutura. Este é o primeiro turno.";

    const historico = [
      { role: "system" as const, content: ugc ? promptDeSistemaUGC() : promptDeSistema() },
      { role: "system" as const, content: contexto },
      ...anteriores.map(m => ({
        role: m.papel === "usuario" ? ("user" as const) : ("assistant" as const),
        content: m.texto,
        ...(m.papel === "usuario" && m.imagens?.length ? { images: m.imagens } : {}),
      })),
      { role: "user" as const, content: limpo, ...(imagens.length ? { images: imagens } : {}) },
    ];

    try {
      const token = await getToken();
      const res = await fetch("/api/assistant", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ model: modelo, messages: historico, stream: true }),
      });
      if (!res.ok || !res.body) {
        let motivo = "Não foi possível falar com o assistente";
        try { const j = await res.json(); motivo = j.error ?? motivo; }
        catch { motivo = (await res.text().catch(() => motivo)) || motivo; }
        throw new Error(motivo);
      }

      /* O bloco é separado a cada pedaço: o usuário vê a prosa crescer,
         nunca o JSON. */
      const turno = await lerTurno(res.body, parcial => {
        atualizarMensagem(id, respostaId, { texto: separarTexto(parcial).visivel });
      });

      const { visivel, blocos } = separarTexto(turno.texto);
      atualizarMensagem(id, respostaId, {
        texto: visivel || (blocos.length ? "Atualizei a estrutura ao lado." : ""),
        escrevendo: false,
        ...(turno.falha ? { erro: turno.falha } : {}),
      });

      const proposta = lerEstrutura(blocos, base);
      if (proposta) definirEstrutura(id, proposta);
      else if (!turno.falha && !visivel) {
        atualizarMensagem(id, respostaId, {
          texto: "",
          escrevendo: false,
          erro: "O assistente respondeu sem a estrutura. Peça de novo, ou troque o modelo.",
        });
      }
    } catch (err) {
      atualizarMensagem(id, respostaId, {
        texto: "",
        escrevendo: false,
        erro: err instanceof Error ? err.message : "Falha ao falar com o assistente",
      });
    } finally {
      setOcupado(false);
    }
  }, [ocupado, sessaoId, mensagens, estrutura, modelo, modoAtual, criarSessao, adicionarMensagem, atualizarMensagem, definirEstrutura, renomear]);

  /* ── Aprovar o esboço ──
     A aprovação é do usuário, não do modelo: a tela marca `aprovado` e
     manda a estrutura marcada no mesmo turno, sem esperar o React
     repassar o store para o `enviar`. */
  const aprovarEsboco = React.useCallback(() => {
    if (!estrutura?.esboco || ocupado) return;
    const aprovada: Estrutura = { ...estrutura, esboco: { ...estrutura.esboco, aprovado: true } };
    if (sessaoId) definirEstrutura(sessaoId, aprovada);
    void enviar("Esboço aprovado. Gere as cenas com o prompt de produção completo (fase 2).", { estruturaAtual: aprovada });
  }, [estrutura, ocupado, sessaoId, definirEstrutura, enviar]);

  const enviarBriefing = React.useCallback((envio: EnvioBriefing) => {
    void enviar(envio.texto, { imagens: envio.imagens, referencias: envio.referencias });
  }, [enviar]);

  return (
    <div className="est-tela">
      <div className="est-conversa">
        <header className="est-cabecalho">
          <h1>Estruturar a ideia</h1>
          <div className="est-cabecalho__lado">
            <div className="est-modo" role="radiogroup" aria-label="Modo">
              <button type="button" role="radio" aria-checked={modoAtual === "livre"} className={`est-modo__opcao${modoAtual === "livre" ? " is-active" : ""}`} disabled={ocupado} onClick={() => escolherModo("livre")}>Ideia livre</button>
              <button type="button" role="radio" aria-checked={modoAtual === "ugc"} className={`est-modo__opcao${modoAtual === "ugc" ? " is-active" : ""}`} disabled={ocupado} onClick={() => escolherModo("ugc")}>Vídeo UGC</button>
            </div>
            <p className="est-cabecalho__dica">Nada é gerado aqui — o plano sai pronto para o Criar ou para o grafo.</p>
            {/* O seletor existe porque um provedor pode estar fora do ar sem
                aviso: medindo esta tela, o endpoint Claude da Kie devolveu
                `no_available_account` e a conversa morria sem saída. Trocar de
                modelo é a saída, e ela tem que estar na tela. */}
            <select
              className="est-modelo"
              value={modelo}
              onChange={e => definirModelo(e.target.value)}
              aria-label="Modelo da conversa"
              disabled={ocupado}
            >
              {MODEL_GROUPS.map(g => (
                <optgroup key={g.label} label={g.label}>
                  {g.models.map(m => <option key={m.id} value={m.id}>{m.label}</option>)}
                </optgroup>
              ))}
            </select>
            <button
              type="button"
              className="est-botao est-botao--miudo"
              onClick={() => criarSessao(modoAtual === "ugc" ? "Vídeo UGC" : "Nova ideia", modoAtual)}
              disabled={ocupado || mensagens.length === 0}
            >
              {modoAtual === "ugc" ? "Novo briefing" : "Nova ideia"}
            </button>
          </div>
        </header>

        <div className="est-mensagens">
          <div className="est-lista">
            {mensagens.map(m => (
              <div key={m.id} className={`est-msg est-msg--${m.papel}`}>
                {m.escrevendo && !m.texto ? (
                  <span className="est-pensando" aria-label="Pensando">
                    <span /><span /><span />
                  </span>
                ) : (
                  m.texto
                )}
                {m.erro && <p className="est-msg__erro">{m.erro}</p>}
              </div>
            ))}
            <div ref={fimRef} />
          </div>

          {mensagens.length === 0 && hidratado && modoAtual === "ugc" && (
            <BriefingUGC ocupado={ocupado} onEnviar={enviarBriefing} />
          )}

          {mensagens.length === 0 && hidratado && modoAtual === "livre" && (
            <div className="est-partidas">
              {PARTIDAS.map(p => (
                <button key={p} type="button" className="est-partida" onClick={() => void enviar(p)}>
                  {p}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="est-composer">
          <div className="est-composer__caixa">
            <ComposerShell
              beam
              value={rascunho}
              onChange={setRascunho}
              onSubmit={() => void enviar(rascunho)}
              busy={ocupado}
              placeholder={modoAtual === "ugc" ? TEXTO_UGC : TEXTO_PADRAO}
              submitOn="enter"
              submitLabel="Enviar"
              glow={false}
            />
          </div>
        </div>
      </div>

      <PainelEstrutura
        estrutura={estrutura}
        ocupado={ocupado}
        modo={modoAtual}
        onRoteiro={aoRoteiro}
        onPrompt={aoPrompt}
        onAbrirNoCriar={abrirNoCriar}
        onMontarNoGrafo={montarNoGrafo}
        onAprovar={aprovarEsboco}
      />
    </div>
  );
}
