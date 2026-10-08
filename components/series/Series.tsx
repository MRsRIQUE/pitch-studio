"use client";

/* ============================================================
   SÉRIES — a tela do kit turbo 1.000 seguidores

   Três estados, um componente: a LISTA (meta da conta, séries salvas e os
   quatro formatos), a criação de uma NOVA série (nome, formato, lock e
   horário) e a SÉRIE aberta (leitura de resultado, lock travado, episódios
   e o editor do episódio, que é onde o prompt nasce).

   O prompt nunca é guardado: nasce de `montarEpisodio` a cada render, a
   partir dos valores e do lock. Guardar o texto seria guardar uma cópia
   que envelhece calada quando o kit muda.
   ============================================================ */

import * as React from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, ArrowLeft, ArrowUpRight, Check, ChevronRight, Clapperboard, Copy, Flame, GitBranch, Lock, LockOpen, Plus, Send, Trash2, Wand2 } from "lucide-react";
import {
  CADENCIA, CHECKLIST_PUBLICACAO, ESTILOS, ESTILO_IDS, HOOKS, LOCK_CAMPOS, META_SEGUIDORES, REGRA_DO_HOOK,
  descreverEpisodio, duracaoDoEpisodio, montarEpisodio, montarSerieLock, valoresVazios,
  type EpisodioMontado, type EstiloId, type SerieLock,
} from "@/lib/serieKit";
import { lerSerie, seguidoresDaConta, useSeriesStore, type Episodio, type Serie } from "@/lib/seriesStore";
import { duracaoDoClipe, duracaoDoTake, episodioParaComposer, modeloVideoDaSerie, moldeDoEpisodio, planoParaComposer } from "@/lib/serieGeracao";
import { copiarTexto } from "@/lib/copiarTexto";
import { useWorkflowStore } from "@/lib/store";
import "./series.css";

type Tela = { modo: "lista" } | { modo: "nova"; estiloId: EstiloId } | { modo: "serie"; id: string; epId: string | null };

const subscribe = (notify: () => void) => useSeriesStore.persist.onFinishHydration(notify);

export function Series() {
  const series = useSeriesStore((s) => s.series);
  const hidratado = React.useSyncExternalStore(subscribe, () => useSeriesStore.persist.hasHydrated(), () => false);
  const [telaPedida, setTela] = React.useState<Tela>({ modo: "lista" });
  const scrollRef = React.useRef<HTMLDivElement>(null);
  const ir = (t: Tela) => { setTela(t); scrollRef.current?.scrollTo({ top: 0 }); };

  /* Série apagada (ou id que não existe mais) cai na lista — derivado, sem efeito. */
  const encontrada = telaPedida.modo === "serie" ? series.find((s) => s.id === telaPedida.id) : undefined;
  const tela: Tela = telaPedida.modo === "serie" && hidratado && !encontrada ? { modo: "lista" } : telaPedida;
  const serieAberta = tela.modo === "serie" ? encontrada : undefined;

  return <div className="ser-scroll" ref={scrollRef}><div className="ser-page">
    <header className="ser-header">
      <div className="ser-page-title">
        {tela.modo !== "lista" && <button className="ser-btn ser-btn--icon" aria-label="Voltar" onClick={() => ir({ modo: "lista" })}><ArrowLeft size={16} /></button>}
        <span className="ser-title-icon"><Clapperboard size={21} /></span>
        <div><div className="ser-breadcrumb">Turbo 1.000 seguidores <ChevronRight size={12} /> {tela.modo === "lista" ? "Sua conta" : tela.modo === "nova" ? "Nova série" : serieAberta?.nome}</div><h1>{tela.modo === "serie" && serieAberta ? serieAberta.nome : "Séries"}</h1></div>
      </div>
      {tela.modo === "lista" && <button className="ser-btn ser-btn--primary" onClick={() => ir({ modo: "nova", estiloId: "objeto-falante" })}><Plus size={16} /> Nova série</button>}
    </header>

    {tela.modo === "lista" && <Lista series={series} hidratado={hidratado} abrir={(id) => ir({ modo: "serie", id, epId: null })} nova={(estiloId) => ir({ modo: "nova", estiloId })} />}
    {tela.modo === "nova" && <NovaSerie estiloInicial={tela.estiloId} onCriada={(id) => ir({ modo: "serie", id, epId: null })} onCancel={() => ir({ modo: "lista" })} />}
    {tela.modo === "serie" && serieAberta && <SerieAberta serie={serieAberta} epId={tela.epId} selecionar={(epId) => setTela({ modo: "serie", id: serieAberta.id, epId })} onRemovida={() => ir({ modo: "lista" })} />}
  </div></div>;
}

/* ── Lista ───────────────────────────────────────────────── */

function Lista({ series, hidratado, abrir, nova }: { series: Serie[]; hidratado: boolean; abrir: (id: string) => void; nova: (estiloId: EstiloId) => void }) {
  const total = hidratado ? seguidoresDaConta(series) : 0;
  const pct = Math.min(100, Math.round((total / META_SEGUIDORES) * 100));
  return <>
    <section className="ser-meta" aria-labelledby="ser-meta-title">
      <div className="ser-meta-copy">
        <span className="ser-eyebrow"><span /> A META</span>
        <h2 id="ser-meta-title">{META_SEGUIDORES.toLocaleString("pt-BR")} seguidores.<br /><em>Um formato, todo dia.</em></h2>
        <p>O que faz a conta crescer não é o vídeo bonito, é o formato repetível. Quatro estilos, cada um com uma assinatura visual travada que se repete todo post. O espectador reconhece a série no feed antes de ler a legenda — e é o reconhecimento que vira follow.</p>
      </div>
      <div className="ser-meta-progress">
        <div className="ser-meta-number"><strong>{hidratado ? total.toLocaleString("pt-BR") : "—"}</strong><span>de {META_SEGUIDORES.toLocaleString("pt-BR")}</span></div>
        <div className="ser-bar" role="progressbar" aria-valuenow={total} aria-valuemin={0} aria-valuemax={META_SEGUIDORES}><span style={{ width: `${pct}%` }} /></div>
        <span className="ser-meta-note">Soma dos seguidores registrados por post. Destrava a afiliação no TikTok Shop.</span>
      </div>
    </section>

    <section className="ser-section" aria-labelledby="ser-minhas">
      <div className="ser-section-heading"><div><span className="ser-kicker">EM PRODUÇÃO</span><h2 id="ser-minhas">Minhas séries <span className="ser-count">{hidratado ? series.length : "—"}</span></h2></div></div>
      {!hidratado ? <div className="ser-skeleton" role="status">Carregando séries…</div> : series.length === 0 ? <div className="ser-empty"><div><h3>Nenhuma série ainda</h3><p>Escolha um dos quatro formatos abaixo. A regra é uma: um estilo só, por no mínimo 21 dias.</p></div></div> :
      <div className="ser-grid">{series.map((s) => { const l = lerSerie(s); const estilo = ESTILOS[s.estiloId]; return <button key={s.id} className={`ser-card${s.ativo ? "" : " is-archived"}`} onClick={() => abrir(s.id)}>
        <span className="ser-card-top"><span className={`ser-estilo-dot ser-estilo-dot--${s.estiloId}`} /><span className="ser-card-estilo">{estilo.nome}</span>{l.alertaTrocar && <span className="ser-alerta-chip"><AlertTriangle size={11} /> Trocar formato</span>}</span>
        <strong>{s.nome}</strong>
        <span className="ser-card-stats">
          <span><b>{l.publicados}</b> {l.publicados === 1 ? "post" : "posts"}</span>
          <span><b>{l.diasDeSerie}</b>/{l.diasMinimos} dias</span>
          <span><b>{l.retencaoMedia === null ? "—" : `${Math.round(l.retencaoMedia)}%`}</b> retenção</span>
          <span><b>{l.seguidoresPorPost === null ? "—" : l.seguidoresPorPost.toFixed(1)}</b> seg./post</span>
        </span>
        <span className="ser-card-foot">{s.episodios.length - l.publicados > 0 ? `${s.episodios.length - l.publicados} em rascunho` : l.postouHoje ? "Postado hoje" : "Nada postado hoje"}<ArrowUpRight size={14} /></span>
      </button>; })}</div>}
    </section>

    <section className="ser-section" aria-labelledby="ser-formatos">
      <div className="ser-section-heading"><div><span className="ser-kicker">ESCOLHA UM — E FIQUE NELE</span><h2 id="ser-formatos">Os quatro formatos</h2><p>Muda o assunto todo dia. Não muda a assinatura.</p></div></div>
      <div className="ser-formatos">{ESTILO_IDS.map((id) => { const e = ESTILOS[id]; return <article key={id} className={`ser-formato ser-formato--${id}`}>
        <span className="ser-formato-band" aria-hidden="true" />
        <div className="ser-formato-body">
          <span className="ser-formato-meta"><span>{e.duracaoAlvo[0]}–{e.duracaoAlvo[1]}s</span><span>{e.planos.length} planos</span></span>
          <h3>{e.nome}</h3>
          <p className="ser-formato-promessa">{e.promessa}</p>
          <p className="ser-formato-porque">{e.porQueFunciona}</p>
          <span className="ser-formato-hooks">{e.hooks.map((h) => <span key={h}>{HOOKS.find((x) => x.id === h)?.nome}</span>)}</span>
        </div>
        <button className="ser-btn ser-btn--primary" onClick={() => nova(id)}>Começar série <ArrowUpRight size={14} /></button>
      </article>; })}</div>
    </section>

    <section className="ser-section ser-regras" aria-labelledby="ser-cadencia">
      <div className="ser-section-heading"><div><span className="ser-kicker">CADÊNCIA</span><h2 id="ser-cadencia">As regras que não mudam</h2></div></div>
      <div className="ser-regras-grid">
        <Regra titulo="A série" texto={CADENCIA.regraDaSerie} />
        <Regra titulo="O ritmo" texto={CADENCIA.ritmo} />
        <Regra titulo="A leitura" texto={CADENCIA.leituraDeResultado} />
        <Regra titulo="Quando trocar" texto={CADENCIA.quandoTrocar} />
        <Regra titulo="O hook" texto={REGRA_DO_HOOK} />
        <div className="ser-regra"><h3>Padrões de hook</h3><ul>{HOOKS.map((h) => <li key={h.id}><b>{h.nome}.</b> {h.descricao}</li>)}</ul></div>
      </div>
    </section>
    <footer className="ser-footer"><span><Flame size={14} /> Um estilo. Vinte e um dias. Mesmo horário.</span><span>SÉRIES · PITCH STUDIO</span></footer>
  </>;
}

function Regra({ titulo, texto }: { titulo: string; texto: string }) {
  return <div className="ser-regra"><h3>{titulo}</h3><p>{texto}</p></div>;
}

/* ── Nova série ──────────────────────────────────────────── */

function NovaSerie({ estiloInicial, onCriada, onCancel }: { estiloInicial: EstiloId; onCriada: (id: string) => void; onCancel: () => void }) {
  const criar = useSeriesStore((s) => s.criar);
  const [estiloId, setEstiloId] = React.useState<EstiloId>(estiloInicial);
  const [nome, setNome] = React.useState("");
  const [horario, setHorario] = React.useState("19:00");
  const [lock, setLock] = React.useState<SerieLock>({ ...ESTILOS[estiloInicial].lock });
  const estilo = ESTILOS[estiloId];

  function trocarEstilo(id: EstiloId) { setEstiloId(id); setLock({ ...ESTILOS[id].lock }); }

  return <form className="ser-nova" onSubmit={(e) => { e.preventDefault(); onCriada(criar({ nome, estiloId, lock, horarioPost: horario })); }}>
    <div className="ser-nova-main">
      <section className="ser-panel">
        <div className="ser-panel-head"><h3>Formato</h3><p>Escolha um e fique nele por no mínimo 21 dias.</p></div>
        <div className="ser-chips" role="radiogroup" aria-label="Formato">{ESTILO_IDS.map((id) => <button type="button" role="radio" aria-checked={estiloId === id} key={id} className={estiloId === id ? "is-selected" : ""} onClick={() => trocarEstilo(id)}><span className={`ser-estilo-dot ser-estilo-dot--${id}`} />{ESTILOS[id].nome}</button>)}</div>
        <p className="ser-muted">{estilo.promessa} Duração alvo: {estilo.duracaoAlvo[0]}–{estilo.duracaoAlvo[1]}s em {estilo.planos.length} planos.</p>
      </section>

      <section className="ser-panel">
        <div className="ser-panel-head"><h3><Lock size={14} /> Series lock</h3><p>O que NUNCA muda entre episódios. Depois do primeiro episódio ele trava. Em inglês — é o que o modelo lê.</p></div>
        <div className="ser-lock-grid">{LOCK_CAMPOS.map((c) => <label key={c.key} className="ser-field"><span>{c.label}<small>{c.dica}</small></span><textarea rows={2} value={lock[c.key]} onChange={(e) => setLock({ ...lock, [c.key]: e.target.value })} /></label>)}</div>
      </section>
    </div>

    <aside className="ser-nova-side">
      <section className="ser-panel">
        <label className="ser-field"><span>Nome da série</span><input autoFocus placeholder={`ex.: ${estilo.nome} · conta nova`} value={nome} onChange={(e) => setNome(e.target.value)} /></label>
        <label className="ser-field"><span>Horário fixo de postagem<small>O horário fixo importa mais que o ideal.</small></span><input type="time" value={horario} onChange={(e) => setHorario(e.target.value)} /></label>
        <div className="ser-actions"><button type="button" className="ser-btn" onClick={onCancel}>Cancelar</button><button type="submit" className="ser-btn ser-btn--primary"><Check size={15} /> Criar série</button></div>
      </section>
      <section className="ser-panel ser-panel--quiet">
        <h3>O que a série fixa</h3>
        <ul className="ser-lista-simples">
          <li><b>Texto na tela.</b> {estilo.textoNaTela}</li>
          <li><b>Áudio.</b> {estilo.audio}</li>
          <li><b>CTA.</b> {estilo.cta}</li>
        </ul>
      </section>
    </aside>
  </form>;
}

/* ── Série aberta ────────────────────────────────────────── */

function SerieAberta({ serie, epId, selecionar, onRemovida }: { serie: Serie; epId: string | null; selecionar: (epId: string | null) => void; onRemovida: () => void }) {
  const store = useSeriesStore();
  const estilo = ESTILOS[serie.estiloId];
  const leitura = lerSerie(serie);
  const travado = serie.episodios.length > 0;
  const [editandoLock, setEditandoLock] = React.useState(false);
  const [lockRascunho, setLockRascunho] = React.useState<SerieLock>(serie.lock);
  const [copiado, setCopiado] = React.useState(false);
  const episodio = epId ? serie.episodios.find((e) => e.id === epId) : undefined;

  async function copiarLock() { setCopiado(await copiarTexto(montarSerieLock(serie.lock))); setTimeout(() => setCopiado(false), 1600); }

  return <div className="ser-aberta">
    <section className="ser-leitura" aria-label="Leitura de resultado">
      <Tile rotulo="Posts publicados" valor={String(leitura.publicados)} nota={leitura.postouHoje ? "Postado hoje" : "Nada postado hoje"} destaque={!leitura.postouHoje} />
      <Tile rotulo="Dias de série" valor={`${leitura.diasDeSerie}`} nota={`mínimo ${leitura.diasMinimos} no mesmo formato`} />
      <Tile rotulo="Retenção média" valor={leitura.retencaoMedia === null ? "—" : `${Math.round(leitura.retencaoMedia)}%`} nota="o sinal do formato" />
      <Tile rotulo="Seguidores por post" valor={leitura.seguidoresPorPost === null ? "—" : leitura.seguidoresPorPost.toFixed(1)} nota={`${leitura.seguidoresTotal} no total`} />
      <div className="ser-tile ser-tile--serie"><span className={`ser-estilo-dot ser-estilo-dot--${serie.estiloId}`} /><div><b>{estilo.nome}</b><span>{serie.horarioPost ? `todo dia às ${serie.horarioPost}` : "sem horário fixo"}</span></div>
        <div className="ser-tile-actions"><button className="ser-btn ser-btn--icon" title={serie.ativo ? "Pausar série" : "Retomar série"} onClick={() => store.alternarAtivo(serie.id)}>{serie.ativo ? "Pausar" : "Retomar"}</button><button className="ser-btn ser-btn--icon ser-btn--danger" title="Apagar série" onClick={() => { if (window.confirm(`Apagar a série “${serie.nome}” e os ${serie.episodios.length} episódios?`)) { store.remover(serie.id); onRemovida(); } }}><Trash2 size={14} /></button></div>
      </div>
    </section>
    {leitura.alertaTrocar && <p className="ser-alerta" role="alert"><AlertTriangle size={15} /> Dez posts seguidos abaixo de 40% de retenção. O problema é o formato, não o assunto: é hora de trocar de estilo.</p>}

    <section className="ser-panel ser-lock" aria-labelledby="ser-lock-title">
      <div className="ser-panel-head ser-panel-head--row"><div><h3 id="ser-lock-title">{travado ? <Lock size={14} /> : <LockOpen size={14} />} Series lock</h3><p>{travado ? `Travado desde o episódio 1. Mudar aqui é recomeçar o alcance do zero.` : "Ainda pode ajustar — trava no primeiro episódio."}</p></div>
        <div className="ser-actions">
          <button className="ser-btn" onClick={copiarLock}>{copiado ? <Check size={14} /> : <Copy size={14} />} Copiar bloco</button>
          {!editandoLock && <button className="ser-btn" onClick={() => { if (!travado || window.confirm("A série já tem episódios. Mudar a assinatura reinicia o reconhecimento. Continuar mesmo assim?")) { setLockRascunho(serie.lock); setEditandoLock(true); } }}>Editar</button>}
        </div>
      </div>
      {editandoLock ? <>
        <div className="ser-lock-grid">{LOCK_CAMPOS.map((c) => <label key={c.key} className="ser-field"><span>{c.label}</span><textarea rows={2} value={lockRascunho[c.key]} onChange={(e) => setLockRascunho({ ...lockRascunho, [c.key]: e.target.value })} /></label>)}</div>
        <div className="ser-actions"><button className="ser-btn" onClick={() => setEditandoLock(false)}>Cancelar</button><button className="ser-btn ser-btn--primary" onClick={() => { store.definirLock(serie.id, lockRascunho); setEditandoLock(false); }}><Check size={14} /> Salvar lock</button></div>
      </> : <dl className="ser-lock-resumo">{LOCK_CAMPOS.map((c) => <div key={c.key}><dt>{c.label}</dt><dd>{serie.lock[c.key] || "—"}</dd></div>)}</dl>}
    </section>

    <div className="ser-episodios">
      <aside className="ser-ep-lista">
        <div className="ser-panel-head ser-panel-head--row"><h3>Episódios <span className="ser-count">{serie.episodios.length}</span></h3><button className="ser-btn ser-btn--primary" onClick={() => selecionar(null)}><Plus size={14} /> Novo</button></div>
        {serie.episodios.length === 0 && <p className="ser-muted">O primeiro episódio trava o lock. Preencha as variáveis ao lado.</p>}
        <ol>{[...serie.episodios].reverse().map((e) => <li key={e.id}><button className={e.id === epId ? "is-selected" : ""} onClick={() => selecionar(e.id)}>
          <span className="ser-ep-num">EP {String(e.numero).padStart(2, "0")}</span>
          <span className="ser-ep-desc">{descreverEpisodio(estilo, e.valores)}</span>
          <span className={`ser-ep-status${e.publicadoEm ? " is-published" : ""}`}>{e.publicadoEm ? `${new Date(e.publicadoEm).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })}${typeof e.metricas.retencao === "number" ? ` · ${e.metricas.retencao}%` : ""}` : "rascunho"}</span>
        </button></li>)}</ol>
      </aside>
      <EditorEpisodio key={episodio?.id ?? "novo"} serie={serie} episodio={episodio} onSalvo={selecionar} />
    </div>
  </div>;
}

function Tile({ rotulo, valor, nota, destaque }: { rotulo: string; valor: string; nota: string; destaque?: boolean }) {
  return <div className={`ser-tile${destaque ? " is-attention" : ""}`}><span>{rotulo}</span><strong>{valor}</strong><small>{nota}</small></div>;
}

/* ── Editor de episódio ──────────────────────────────────── */

function EditorEpisodio({ serie, episodio, onSalvo }: { serie: Serie; episodio?: Episodio; onSalvo: (epId: string | null) => void }) {
  const router = useRouter();
  const store = useSeriesStore();
  const addToast = useWorkflowStore((s) => s.addToast);
  const estilo = ESTILOS[serie.estiloId];
  const numero = episodio?.numero ?? (serie.episodios[serie.episodios.length - 1]?.numero ?? 0) + 1;
  const [valores, setValores] = React.useState<Record<string, string>>({ ...valoresVazios(estilo), ...(episodio?.valores ?? {}) });
  const [copiadoDe, setCopiadoDe] = React.useState<string | null>(null);
  const modelo = React.useMemo(() => modeloVideoDaSerie(), []);
  const montado: EpisodioMontado = React.useMemo(() => montarEpisodio(estilo, serie.lock, valores, numero), [estilo, serie.lock, valores, numero]);
  const sujo = JSON.stringify(valores) !== JSON.stringify({ ...valoresVazios(estilo), ...(episodio?.valores ?? {}) });
  const incompleto = montado.faltando.length > 0;
  const take = duracaoDoTake(montado, modelo.durations);

  async function copiar(chave: string, texto: string) { if (await copiarTexto(texto)) { setCopiadoDe(chave); setTimeout(() => setCopiadoDe(null), 1600); } else addToast("Não foi possível copiar.", "error"); }

  function salvar(): string {
    if (episodio) { store.atualizarValores(serie.id, episodio.id, valores); return episodio.id; }
    const id = store.adicionarEpisodio(serie.id, valores);
    onSalvo(id);
    return id;
  }

  function levarAoCriar() {
    salvar();
    const href = episodioParaComposer(montado);
    if (!href) { addToast("Não foi possível levar o episódio para o Criar.", "error"); return; }
    router.push(href);
  }

  function regerarPlano(n: number) {
    const plano = montado.planos.find((p) => p.n === n);
    if (!plano) return;
    salvar();
    const href = planoParaComposer(plano);
    if (!href) { addToast("Não foi possível levar o plano para o Criar.", "error"); return; }
    router.push(href);
  }

  function montarNoGrafo() {
    salvar();
    const loja = useWorkflowStore.getState();
    loja.createSpace(`${serie.nome} · EP ${String(numero).padStart(2, "0")}`, moldeDoEpisodio(montado));
    const id = useWorkflowStore.getState().activeSpaceId;
    addToast(`Projeto montado com ${montado.planos.length} planos. Nada foi gerado.`, "success");
    router.push(`/workflow/${id}`);
  }

  return <section className="ser-editor" aria-label={`Episódio ${numero}`}>
    <div className="ser-panel">
      <div className="ser-panel-head ser-panel-head--row"><div><h3>Episódio {String(numero).padStart(2, "0")}{episodio ? "" : " · novo"}</h3><p>Só o assunto muda. Valores em inglês — é o que o modelo lê.</p></div>
        <div className="ser-actions">{episodio && <button className="ser-btn ser-btn--danger" onClick={() => { if (window.confirm(`Apagar o episódio ${numero}?`)) { store.removerEpisodio(serie.id, episodio.id); onSalvo(null); } }}><Trash2 size={14} /></button>}<button className="ser-btn ser-btn--primary" disabled={!sujo && Boolean(episodio)} onClick={salvar}><Check size={14} /> {episodio ? "Salvar" : "Salvar episódio"}</button></div>
      </div>
      <div className="ser-vars">{estilo.variaveis.map((x) => <label key={x.slot} className={`ser-field${montado.faltando.includes(x.slot) ? " is-missing" : ""}`}><span>{x.label}{x.noPrompt ? "" : <em> · legenda</em>}</span><input value={valores[x.slot] ?? ""} placeholder={`ex.: ${x.exemplo}`} onChange={(e) => setValores({ ...valores, [x.slot]: e.target.value })} /></label>)}</div>
      {incompleto && <p className="ser-hint"><AlertTriangle size={13} /> Faltam: {montado.faltando.join(", ")}. Os prompts abaixo ainda mostram os slots vazios.</p>}
    </div>

    <div className="ser-panel">
      <div className="ser-panel-head ser-panel-head--row"><div><h3>Os planos</h3><p>{montado.planos.length} planos, {duracaoDoEpisodio(estilo)}s. Cada um já traz o SERIES LOCK no fim.</p></div>
        <div className="ser-actions"><button className="ser-btn" disabled={incompleto} title="Um par prompt → vídeo por plano, no grafo" onClick={montarNoGrafo}><GitBranch size={14} /> Montar no grafo</button></div>
      </div>
      <ol className="ser-planos">{montado.planos.map((p) => { const clipe = duracaoDoClipe(p, modelo.durations); return <li key={p.n} className="ser-plano">
        <div className="ser-plano-head"><span className="ser-plano-n">{p.n}</span><div><b>{p.tempo}</b><span>{p.funcao}</span></div><span className="ser-plano-clipe" title="Duração do clipe gerado; a edição corta no tempo do plano">{clipe ? `clipe ${clipe}s` : ""}</span></div>
        <pre>{p.cena}</pre>
        <div className="ser-plano-actions"><button className="ser-btn ser-btn--sm" onClick={() => copiar(`p${p.n}`, p.prompt)}>{copiadoDe === `p${p.n}` ? <Check size={12} /> : <Copy size={12} />} Copiar com lock</button><button className="ser-btn ser-btn--sm" disabled={p.faltando.length > 0} onClick={() => regerarPlano(p.n)}><Wand2 size={12} /> Gerar só este</button></div>
      </li>; })}</ol>
    </div>

    <div className="ser-panel">
      <div className="ser-panel-head ser-panel-head--row"><div><h3>Prompt único</h3><p>O episódio inteiro num take de {take ?? montado.duracao}s no {modelo.nome}, 9:16.</p></div>
        <div className="ser-actions"><button className="ser-btn" onClick={() => copiar("unico", montado.promptUnico)}>{copiadoDe === "unico" ? <Check size={14} /> : <Copy size={14} />} Copiar</button><button className="ser-btn ser-btn--primary" disabled={incompleto} onClick={levarAoCriar}><Send size={14} /> Levar ao Criar</button></div>
      </div>
      <pre className="ser-prompt-unico">{montado.promptUnico}</pre>
    </div>

    <div className="ser-panel">
      <div className="ser-panel-head"><h3>Ficha de publicação</h3><p>O que vai na edição e na legenda. Não vai para o modelo.</p></div>
      <dl className="ser-ficha">
        {montado.ficha.legenda && <div><dt>Legenda sugerida</dt><dd><code>{montado.ficha.legenda}</code><button className="ser-btn ser-btn--sm" onClick={() => copiar("legenda", montado.ficha.legenda)}>{copiadoDe === "legenda" ? <Check size={12} /> : <Copy size={12} />}</button></dd></div>}
        <div><dt>Texto na tela</dt><dd>{montado.ficha.textoNaTela}</dd></div>
        <div><dt>Áudio</dt><dd>{montado.ficha.audio}</dd></div>
        <div><dt>CTA</dt><dd>{montado.ficha.cta}</dd></div>
      </dl>
    </div>

    {episodio && <div className="ser-panel">
      <div className="ser-panel-head ser-panel-head--row"><div><h3>Antes de postar</h3><p>Seis perguntas. Se alguma for “não”, o vídeo não está pronto.</p></div>
        <label className="ser-toggle"><input type="checkbox" checked={Boolean(episodio.publicadoEm)} onChange={(e) => store.marcarPublicado(serie.id, episodio.id, e.target.checked)} /><span>{episodio.publicadoEm ? `Publicado em ${new Date(episodio.publicadoEm).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}` : "Marcar como publicado"}</span></label>
      </div>
      <ul className="ser-checklist">{CHECKLIST_PUBLICACAO.map((item, i) => <li key={i}><label><input type="checkbox" checked={Boolean(episodio.checklist[i])} onChange={() => store.alternarChecklist(serie.id, episodio.id, i)} /><span>{item}</span></label></li>)}</ul>
      {episodio.publicadoEm && <div className="ser-metricas">
        <Metrica rotulo="Retenção média (%)" valor={episodio.metricas.retencao} onChange={(v) => store.definirMetricas(serie.id, episodio.id, { retencao: v })} />
        <Metrica rotulo="Seguidores que trouxe" valor={episodio.metricas.seguidores} onChange={(v) => store.definirMetricas(serie.id, episodio.id, { seguidores: v })} />
        <Metrica rotulo="Views (não decide nada)" valor={episodio.metricas.views} onChange={(v) => store.definirMetricas(serie.id, episodio.id, { views: v })} />
      </div>}
    </div>}
  </section>;
}

function Metrica({ rotulo, valor, onChange }: { rotulo: string; valor?: number; onChange: (v: number | undefined) => void }) {
  return <label className="ser-field"><span>{rotulo}</span><input type="number" min={0} step="any" inputMode="decimal" value={valor ?? ""} onChange={(e) => onChange(e.target.value === "" ? undefined : Number(e.target.value))} /></label>;
}
