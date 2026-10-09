"use client";

/* Images here are user uploads and locally stored generation results. */
/* eslint-disable @next/next/no-img-element */
import * as React from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, ArrowUpRight, Camera, Check, ChevronRight, Fingerprint, Images, Loader2, LockKeyhole, Plus, ScanSearch, Search, Settings, Sparkles, Trash2, Upload, User, Video, WandSparkles, X } from "lucide-react";
import { usePersonagensStore, MAX_FOTOS, type Personagem } from "@/lib/personagensStore";
import { decomporReferencia, iniciarRetrato, MODELO_LEITURA_PADRAO, subirReferencia } from "@/lib/personagensGeracao";
import { MODEL_GROUPS } from "@/lib/models";
import { AVATAR_FIELD_SECTIONS, AVATAR_GROUPS, AVATAR_IDENTITY_KEYS, AVATAR_KIT_VERSION, AVATAR_QUALITY_CHECKLIST, AVATAR_REQUIRED, avatarOptionVisual, buildAvatarPrompt, createEmptyAvatarSelections, describeAvatar, type AvatarGroupKey, type AvatarSelections, type AvatarSwatch } from "@/lib/avatarPromptKit";
import { MODEL_PRESETS, PERSONA_SPRITE, type ModelPreset } from "@/lib/modelPresets";
import { remixToComposer } from "@/lib/remixHandoff";
import { useWorkflowStore } from "@/lib/store";
import "./personagens.css";
import { GeracaoRetrato } from "./GeracaoRetrato";

const AMBIENTES = ["Em casa, roupa casual, luz da janela", "Skincare, banheiro iluminado, roupa neutra", "Fitness, roupa esportiva, ambiente de treino", "Lifestyle, café ao ar livre, roupa casual"];
const subscribe = (notify: () => void) => usePersonagensStore.persist.onFinishHydration(notify);
const presets = MODEL_PRESETS.filter((p) => p.category === "people" && p.id !== "child-lifestyle");

import { GeracaoPendente } from "./GeracaoPendente";

type ModoEditor = "cgi" | "livre" | "referencia";

/**
 * `modoInicial` vem da URL (`/personagens?modo=referencia`): é a porta que a
 * receita UGC usa para cair direto no editor, já no modo "a partir de foto".
 */
export function Personagens({ modoInicial }: { modoInicial?: ModoEditor } = {}) {
  const router = useRouter();
  const personagens = usePersonagensStore((s) => s.personagens);
  const hidratado = React.useSyncExternalStore(subscribe, () => usePersonagensStore.persist.hasHydrated(), () => false);
  const [editor, setEditor] = React.useState<null | { id?: string; preset?: ModelPreset; modo?: ModoEditor }>(
    () => (modoInicial ? { modo: modoInicial } : null),
  );
  const [query, setQuery] = React.useState("");
  const [filtro, setFiltro] = React.useState("todos");
  const [erro, setErro] = React.useState("");
  const scrollRef = React.useRef<HTMLDivElement>(null);
  const abrirEditor = (value: typeof editor) => {
    setEditor(value);
    scrollRef.current?.scrollTo({ top: 0 });
  };
  const selecionado = personagens.find((p) => p.id === editor?.id);
  const filtrados = personagens.filter((p) => (filtro === "todos" || (filtro === "ativos" ? p.ativo : !p.ativo)) && `${p.nome} ${p.descricao}`.toLocaleLowerCase().includes(query.toLocaleLowerCase().trim()));

  function usarNoVideo(p: Personagem, foto: string, roteiro: string) {
    const href = remixToComposer({
      mediaType: "video", model: "seedance-2-5", aspectRatio: "9:16", referenceImageUrls: [foto],
      prompt: `Vídeo UGC vertical com a pessoa da imagem de referência. ${p.descricao}\nPreserve o rosto e a aparência. A pessoa olha para a câmera, com gestos naturais e movimentos sutis, em um take contínuo de celular. Sem texto sobreposto.\n${roteiro.trim() ? `Fala em português brasileiro: ${roteiro.trim()}` : "A pessoa se apresenta de forma espontânea. Edite aqui a fala ou a demonstração desejada."}`,
    });
    if (!href) { setErro("Não foi possível preparar o vídeo. Verifique o armazenamento do navegador."); return; }
    router.push(href);
  }

  return <div className="pers-scroll" ref={scrollRef}><div className={`pers-page${editor ? " pers-page--editing" : ""}`}>
    {hidratado && personagens.filter((p) => p.geracao).map((p) => <GeracaoPendente key={p.id} personagem={p} />)}
    <header className="pers-header"><div className="pers-page-title"><span className="pers-title-icon"><Fingerprint size={21} /></span><div><div className="pers-breadcrumb">Estúdio UGC <ChevronRight size={12} /> Seu elenco</div><h1>Personagens</h1></div></div>
      {!editor && <button className="pers-btn pers-btn--primary" onClick={() => abrirEditor({})}><Plus size={16} /> Criar personagem</button>}
    </header>
    {erro && <p className="pers-error" role="alert">{erro}</p>}
    {editor ? <EditorPersonagem key={editor.id || editor.preset?.id || editor.modo || "novo"} personagem={selecionado} preset={editor.preset} modoInicial={editor.modo} onClose={() => abrirEditor(null)} onSaved={(id) => setEditor({ id })} onVideo={usarNoVideo} /> : <>
      <section className="pers-hero" aria-labelledby="pers-hero-title">
        <div className="pers-hero-copy"><span className="pers-eyebrow"><span /> IDENTIDADES QUE CRIAM CONEXÃO</span><h2 id="pers-hero-title">Um personagem.<br /><em>Infinitas histórias.</em></h2><p>Crie quem vai dar voz à sua marca.<br />Do primeiro retrato ao próximo vídeo UGC.</p><button className="pers-hero-cta" onClick={() => abrirEditor({})}>Dar vida a uma ideia <ArrowUpRight size={17} /></button><span className="pers-hero-footnote"><Fingerprint size={13} /> Sua identidade, em cada nova criação.</span></div>
        <div className="pers-hero-art" aria-hidden="true"><div className="pers-art-orbit" />{[presets[1], presets[0], presets[2]].map((p, i) => <div className={`pers-art-card pers-art-card--${i}`} key={p.id}><span style={{ backgroundImage: `url(${PERSONA_SPRITE})`, backgroundPosition: p.spritePosition }} /><div><span>PERSONAGEM {String(i + 1).padStart(2, "0")}</span><Fingerprint size={16} /></div></div>)}<span className="pers-art-label"><span /> PRONTO PARA A SUA HISTÓRIA</span></div>
      </section>
      <section className="pers-library" aria-labelledby="pers-library"><div className="pers-section-heading"><div><span className="pers-section-kicker">SUA BIBLIOTECA</span><h2 id="pers-library">Meus personagens <span className="pers-count">{hidratado ? personagens.length : "—"}</span></h2></div><span className="pers-library-note"><Images size={14} /> Identidades salvas para reutilizar</span></div>
        <div className="pers-library-toolbar"><div className="pers-filters">{[["todos", "Todos"], ["ativos", "Ativos"], ["arquivados", "Arquivados"]].map(([id, label]) => <button key={id} aria-pressed={filtro === id} className={filtro === id ? "is-selected" : ""} onClick={() => setFiltro(id)}>{label}{id === "todos" && hidratado && <span>{personagens.length}</span>}</button>)}</div><label className="pers-search"><Search size={15} /><input aria-label="Buscar personagens" placeholder="Buscar no seu elenco…" value={query} onChange={(e) => setQuery(e.target.value)} />{query && <button aria-label="Limpar busca" onClick={() => setQuery("")}><X size={14} /></button>}</label></div>
        {!hidratado ? <div className="pers-skeleton" role="status">Carregando personagens…</div> : filtrados.length === 0 ? <div className="pers-empty"><div className="pers-empty-illustration" aria-hidden="true"><span /><span><Fingerprint size={30} /></span><span /></div><div className="pers-empty-copy"><h3>{personagens.length ? "Nenhum personagem encontrado" : "O próximo rosto da sua marca começa aqui"}</h3><p>{personagens.length ? "Experimente outra busca ou filtro para encontrar seu personagem." : "Crie com IA ou traga suas próprias referências. Seu elenco fica guardado para as próximas histórias."}</p></div><button className="pers-btn" onClick={() => abrirEditor({})}><Plus size={15} /> {personagens.length ? "Novo personagem" : "Começar meu elenco"}</button></div> :
        <div className="pers-grid">{filtrados.map((p) => <button key={p.id} className="pers-card" onClick={() => abrirEditor({ id: p.id })}>
          <span className="pers-card-photo">{p.fotos[0] ? <img src={p.fotos[p.fotos.length - 1]} alt={`Retrato de ${p.nome}`} /> : <Fingerprint size={44} />}<span className={`pers-card-status${!p.ativo ? " is-archived" : ""}`}><span />{p.ativo ? "Ativo" : "Arquivado"}</span>{p.geracao && <span className="pers-generating"><Loader2 size={16} className="pers-spin" /> Gerando retrato</span>}<span className="pers-card-open">Abrir personagem <ArrowUpRight size={16} /></span></span>
          <span className="pers-card-info"><strong>{p.nome}</strong><span>{p.erroGeracao ? "Geração precisa de atenção" : `${p.fotos.length} ${p.fotos.length === 1 ? "referência" : "referências"}`}</span></span><ArrowUpRight className="pers-card-arrow" size={17} />
        </button>)}<button className="pers-add-card" onClick={() => abrirEditor({})}><span><Plus size={24} /></span><strong>Expandir seu elenco</strong><span>Criar um novo personagem</span></button></div>}
      </section>
      <section className="pers-discover" aria-labelledby="pers-inspiracao"><div className="pers-section-heading"><div><span className="pers-section-kicker">UM PONTO DE PARTIDA</span><h2 id="pers-inspiracao">Inspire seu próximo personagem</h2><p>Uma presença para cada ideia. Escolha uma e faça do seu jeito.</p></div><span className="pers-badge"><Sparkles size={13} /> Seleção criativa</span></div>
        <div className="pers-presets">{presets.map((p, i) => <button className="pers-preset" key={p.id} onClick={() => abrirEditor({ preset: p })}>
          <span className="pers-preset-photo"><span style={{ backgroundImage: `url(${PERSONA_SPRITE})`, backgroundPosition: p.spritePosition }} /></span><span className="pers-preset-number">0{i + 1}</span><span className="pers-preset-arrow"><ArrowUpRight size={17} /></span>
          <span className="pers-preset-caption"><span>{["EDITORIAL", "CLÁSSICO", "URBANO", "LIFESTYLE", "AUTÊNTICO"][i]}</span><strong>{p.name}</strong><span className="pers-preset-description">{p.description}</span><span className="pers-preset-action">Personalizar personagem <ArrowRight size={13} /></span></span>
        </button>)}</div><p className="pers-hint pers-discover-note"><Fingerprint size={13} /> Estes retratos inspiram o estilo. A sua geração cria uma identidade original.</p>
      </section>
      <footer className="pers-footer"><span><Fingerprint size={15} /> Feito para criar. Guardado para continuar.</span><span>PERSONAGENS · PITCH STUDIO</span></footer>
    </>}
  </div></div>;
}

function AvatarSelector({ groupKey, value, disabled, onChange }: {
  groupKey: AvatarGroupKey;
  value: string | string[];
  disabled: boolean;
  onChange: (value: string | string[]) => void;
}) {
  const group = AVATAR_GROUPS[groupKey];
  const required = AVATAR_REQUIRED.includes(groupKey);
  const singleValue = typeof value === "string" ? value : "";
  if (group.type === "multi") {
    const selected = Array.isArray(value) ? value : [];
    return <div className="pers-avatar-multi" role="group" aria-label={group.label}>
      <div className="pers-avatar-label"><span>{group.label}</span><small>{selected.length}/3</small></div>
      <div className="pers-avatar-chips">{group.options.map((option) => {
        const active = selected.includes(option.value);
        const unavailable = disabled || (!active && selected.length >= 3);
        return <button type="button" key={option.value} aria-pressed={active} disabled={unavailable} className={active ? "is-selected" : ""} onClick={() => onChange(active ? selected.filter((item) => item !== option.value) : [...selected, option.value])}>{active && <Check size={12} />}{option.label}</button>;
      })}</div>
      {group.note && <p className="pers-avatar-note">{group.note}</p>}
    </div>;
  }
  const hasVisuals = group.options.some((option) => {
    const visual = avatarOptionVisual(groupKey, option.value);
    return Boolean(visual.swatch || visual.thumb);
  });
  if (hasVisuals) {
    const swatchStyle = (swatch: AvatarSwatch): React.CSSProperties => {
      if (swatch.kind === "skin") return { background: `linear-gradient(135deg, ${swatch.light}, ${swatch.shadow})` };
      if (swatch.kind === "hair") return { background: `linear-gradient(160deg, ${swatch.root} 35%, ${swatch.light})` };
      return { background: `radial-gradient(circle at 50% 50%, #111 0 21%, ${swatch.iris} 23% 69%, ${swatch.ring} 71% 100%)` };
    };
    return <div className="pers-avatar-visual" role="radiogroup" aria-label={group.label}>
      <div className="pers-avatar-label"><span>{group.label}{required && <em aria-label="obrigatório">*</em>}</span></div>
      <div className="pers-visual-grid">
        {!required && <button type="button" role="radio" aria-checked={!singleValue} disabled={disabled} className={!singleValue ? "is-selected" : ""} onClick={() => onChange("")}><span className="pers-visual-option-media pers-visual-option-empty" aria-hidden="true">—</span><span className="pers-visual-option-label">Não definido</span>{!singleValue && <span className="pers-visual-check"><Check size={11} /></span>}</button>}
        {group.options.map((option) => {
          const visual = avatarOptionVisual(groupKey, option.value);
          const active = singleValue === option.value;
          return <button type="button" role="radio" aria-checked={active} disabled={disabled} className={active ? "is-selected" : ""} key={option.value} onClick={() => onChange(option.value)}>
            <span className={`pers-visual-option-media${visual.swatch?.kind === "eye" ? " is-eye" : ""}`} aria-hidden="true">{visual.thumb ? <img src={visual.thumb} alt="" width={240} height={240} loading="lazy" /> : visual.swatch ? <span className="pers-swatch" style={swatchStyle(visual.swatch)} /> : null}</span>
            <span className="pers-visual-option-label">{option.label}</span>
            {active && <span className="pers-visual-check"><Check size={11} /></span>}
          </button>;
        })}
      </div>
      {group.note && <p className="pers-avatar-note">{group.note}</p>}
    </div>;
  }
  return <label className="pers-avatar-select">
    <span>{group.label}{required && <em aria-label="obrigatório">*</em>}</span>
    <select value={singleValue} disabled={disabled} required={required} onChange={(event) => onChange(event.target.value)}>
      <option value="">{required ? "Selecione" : "Não definido"}</option>
      {group.options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
    </select>
    {group.note && <small className="pers-avatar-note">{group.note}</small>}
  </label>;
}

/* Um personagem que nasceu de uma foto de referência tem `avatarPrompt` (o
   prompt decomposto) mas não tem `avatarSelections`: é assim que o editor o
   reconhece ao reabrir. */
function modoDoPersonagem(personagem?: Personagem, preset?: ModelPreset, modoInicial?: ModoEditor): ModoEditor {
  if (personagem?.avatarSelections) return "cgi";
  if (personagem?.avatarPrompt) return "referencia";
  if (modoInicial) return modoInicial;
  return personagem || preset ? "livre" : "cgi";
}

function EditorPersonagem({ personagem, preset, modoInicial, onClose, onSaved, onVideo }: {
  personagem?: Personagem; preset?: ModelPreset; modoInicial?: ModoEditor; onClose: () => void; onSaved: (id: string) => void;
  onVideo: (p: Personagem, foto: string, roteiro: string) => void;
}) {
  const [nome, setNome] = React.useState(personagem?.nome || "");
  const [descricao, setDescricao] = React.useState(personagem?.descricao || preset?.prompt || "");
  const [modo, setModo] = React.useState<ModoEditor>(() => modoDoPersonagem(personagem, preset, modoInicial));
  /* ── A partir de uma foto ──
     A foto de referência NÃO é identidade: fica só neste estado, nunca em
     `personagem.fotos`. O que sobrevive é o prompt lido dela. */
  const [fotoReferencia, setFotoReferencia] = React.useState<string | null>(null);
  const [promptReferencia, setPromptReferencia] = React.useState(personagem?.avatarPrompt && !personagem.avatarSelections ? personagem.avatarPrompt : "");
  const [modeloLeitura, setModeloLeitura] = React.useState(MODELO_LEITURA_PADRAO);
  const [lendo, setLendo] = React.useState(false);
  const refInput = React.useRef<HTMLInputElement>(null);
  const [avatarSelections, setAvatarSelections] = React.useState<AvatarSelections>(() => personagem?.avatarSelections || createEmptyAvatarSelections());
  const [fotos, setFotos] = React.useState(personagem?.fotos || []);
  const [ambiente, setAmbiente] = React.useState(AMBIENTES[0]);
  const [roteiro, setRoteiro] = React.useState("");
  const [fotoSelecionada, setFotoSelecionada] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [erro, setErro] = React.useState("");
  const [excluir, setExcluir] = React.useState(false);
  const [arrastando, setArrastando] = React.useState(false);
  const upload = React.useRef<HTMLInputElement>(null);
  const lock = React.useRef(false);
  const pendente = !!personagem?.geracao;
  // Saved references can grow while a generation completes in the background.
  const referencias = personagem ? personagem.fotos : fotos;
  const preview = fotoSelecionada && referencias.includes(fotoSelecionada) ? fotoSelecionada : referencias[referencias.length - 1];
  const avatarBuild = React.useMemo(() => buildAvatarPrompt(avatarSelections), [avatarSelections]);
  const avatarSummary = React.useMemo(() => describeAvatar(avatarSelections), [avatarSelections]);
  const identidadeTravada = modo === "cgi" && Boolean(personagem?.identityLock && referencias.length);
  const podeGerar = Boolean(nome.trim()) && (modo === "cgi" ? avatarBuild.missing.length === 0 : modo === "referencia" ? Boolean(promptReferencia.trim()) : Boolean(descricao.trim()));
  const store = usePersonagensStore.getState;
  function salvar() {
    if (!nome.trim()) throw new Error("Dê um nome ao personagem.");
    if (modo === "cgi" && avatarBuild.missing.length) {
      const labels = avatarBuild.missing.map((key) => AVATAR_GROUPS[key].label.toLocaleLowerCase());
      throw new Error(`Complete os campos obrigatórios: ${labels.join(", ")}.`);
    }
    if (modo === "referencia" && !promptReferencia.trim()) throw new Error("Leia uma foto de referência primeiro, ou escreva o prompt.");
    const dadosAvatar = modo === "cgi" ? {
      descricao: avatarSummary,
      avatarSelections,
      avatarPrompt: avatarBuild.prompt,
      identityLock: avatarBuild.identityLock,
      avatarKitVersion: AVATAR_KIT_VERSION,
    } : modo === "referencia" ? {
      descricao,
      avatarSelections: undefined,
      avatarPrompt: promptReferencia.trim(),
      identityLock: undefined,
      avatarKitVersion: undefined,
    } : {
      descricao,
      avatarSelections: undefined,
      avatarPrompt: undefined,
      identityLock: undefined,
      avatarKitVersion: undefined,
    };
    if (personagem) {
      store().renomear(personagem.id, nome);
      store().definirAvatar(personagem.id, dadosAvatar);
      return personagem.id;
    }
    return store().criar(nome, { ...dadosAvatar, fotos });
  }
  async function adicionar(files: FileList | null) {
    if (!files?.length || lock.current) return;
    lock.current = true; setBusy(true); setErro("");
    try {
      const remaining = MAX_FOTOS - referencias.length;
      if (files.length > remaining) throw new Error(`Você pode adicionar mais ${remaining} referência(s).`);
      for (const file of Array.from(files)) {
        const url = await subirReferencia(file);
        if (personagem) store().adicionarFoto(personagem.id, url);
        else setFotos((previous) => [...previous, url]);
      }
    } catch (e) { setErro(e instanceof Error ? e.message : "Falha no upload."); }
    finally { lock.current = false; setBusy(false); if (upload.current) upload.current.value = ""; }
  }
  /* A foto de referência sobe para o disco por um motivo só: a rota do
     assistente lê `/generated/...` para mandar a imagem ao modelo de visão. */
  async function escolherReferencia(files: FileList | null) {
    if (!files?.length || lock.current) return;
    lock.current = true; setBusy(true); setErro("");
    try { setFotoReferencia(await subirReferencia(files[0])); }
    catch (e) { setErro(e instanceof Error ? e.message : "Falha no upload."); }
    finally { lock.current = false; setBusy(false); if (refInput.current) refInput.current.value = ""; }
  }
  async function lerReferencia() {
    if (!fotoReferencia || lendo) return;
    setLendo(true); setErro("");
    try {
      const leitura = await decomporReferencia(fotoReferencia, modeloLeitura);
      setPromptReferencia(leitura.prompt);
      if (leitura.descricao && !descricao.trim()) setDescricao(leitura.descricao);
    } catch (e) { setErro(e instanceof Error ? e.message : "Não foi possível ler a foto."); }
    finally { setLendo(false); }
  }
  async function gerar() {
    if (lock.current) return;
    if (!nome.trim()) { setErro("Dê um nome ao personagem."); return; }
    if (modo === "cgi" && avatarBuild.missing.length) { setErro(`Complete os campos obrigatórios: ${avatarBuild.missing.map((key) => AVATAR_GROUPS[key].label.toLocaleLowerCase()).join(", ")}.`); return; }
    if (modo === "livre" && !descricao.trim()) { setErro("Descreva a aparência para gerar o personagem."); return; }
    if (modo === "referencia" && !promptReferencia.trim()) { setErro("Leia a foto de referência antes de gerar."); return; }
    lock.current = true; setBusy(true); setErro("");
    let id: string | undefined;
    try {
      id = salvar();
      const p = store().personagens.find((p) => p.id === id)!;
      const taskId = await iniciarRetrato(p, ambiente, modo === "referencia" ? { promptDireto: promptReferencia } : {});
      store().atualizarGeracao(id, { taskId, iniciadaEm: Date.now() });
      onSaved(id);
    } catch (e) {
      const message = e instanceof Error ? e.message : "Falha ao gerar personagem.";
      if (id) { store().atualizarGeracao(id, undefined, message); onSaved(id); }
      else setErro(message);
    } finally { lock.current = false; setBusy(false); }
  }
  return <section className="pers-editor">
    <div className="pers-editor-topbar"><button className="pers-back" disabled={busy} onClick={onClose}><ArrowLeft size={16} /> Meus personagens</button><span className="pers-editor-status"><span />{personagem ? "Na sua biblioteca" : "Novo personagem"}</span></div>
    <div className="pers-editor-grid"><div className="pers-form">
      <div className="pers-form-heading"><span className="pers-section-kicker">DIREÇÃO DE PERSONAGEM</span><h2>{personagem ? "Identidade do personagem" : "Quem vamos criar?"}</h2><p className="pers-muted">Os detalhes dão personalidade. Comece pelo que torna essa pessoa única.</p></div>
      <fieldset className="pers-fieldset"><legend><span>01</span> Identidade</legend>
      <label>Nome<input maxLength={80} placeholder="Ex.: Marina, criadora de lifestyle" value={nome} onChange={(e) => setNome(e.target.value)} disabled={busy} /></label>
      <div className="pers-mode-switch pers-mode-switch--3" role="group" aria-label="Modo de criação"><button type="button" aria-pressed={modo === "cgi"} className={modo === "cgi" ? "is-selected" : ""} disabled={busy} onClick={() => setModo("cgi")}><WandSparkles size={14} /> Construtor CGI</button><button type="button" aria-pressed={modo === "livre"} className={modo === "livre" ? "is-selected" : ""} disabled={busy || identidadeTravada} onClick={() => setModo("livre")}>Descrição livre</button><button type="button" aria-pressed={modo === "referencia"} className={modo === "referencia" ? "is-selected" : ""} disabled={busy || identidadeTravada} onClick={() => setModo("referencia")}><ScanSearch size={14} /> A partir de foto</button></div>
      {modo === "livre" ? <><label>Aparência e personalidade<textarea rows={4} maxLength={2500} placeholder="Mulher de 28 anos, cabelo castanho ondulado, sardas, sorriso acolhedor e estilo casual…" value={descricao} onChange={(e) => setDescricao(e.target.value)} disabled={busy} /></label><div className="pers-field-note"><span>Idade, cabelo, traços e estilo pessoal.</span><span>{descricao.length}/2500</span></div></> : modo === "cgi" ? <div className="pers-cgi-intro"><span><Fingerprint size={17} /></span><div><strong>Avatar consistente por construção</strong><p>Escolha os traços em português. O prompt final é montado em inglês e o rosto fica salvo para as próximas cenas.</p></div></div> : <div className="pers-cgi-intro"><span><ScanSearch size={17} /></span><div><strong>Enquadramento, pose e luz de uma foto real</strong><p>Uma foto casual (Pinterest, um feed) vira um prompt detalhado — e a pessoa é trocada por uma nova. A foto é referência de cena, não de identidade.</p></div></div>}
      </fieldset>
      {modo === "referencia" && <fieldset className="pers-fieldset"><legend><span>02</span> A foto de referência</legend>
        <div className="pers-ref-leitura">
          {fotoReferencia ? <button type="button" className="pers-ref-leitura__foto" disabled={busy || lendo} onClick={() => refInput.current?.click()} aria-label="Trocar a foto de referência"><img src={fotoReferencia} alt="Foto de referência" /></button> : <button type="button" className="pers-dropzone pers-dropzone--curta" disabled={busy || pendente} onClick={() => refInput.current?.click()} aria-label="Escolher a foto de referência" onDragOver={(e) => { e.preventDefault(); if (!busy) setArrastando(true); }} onDragLeave={() => setArrastando(false)} onDrop={(e) => { e.preventDefault(); setArrastando(false); if (!busy) void escolherReferencia(e.dataTransfer.files); }}><span className="pers-dropzone-icon">{busy ? <Loader2 className="pers-spin" size={21} /> : <Upload size={21} />}</span><strong>{arrastando ? "Solte a foto" : "Arraste a foto de referência"}</strong><span>ou <em>escolha o arquivo</em></span><small>JPG, PNG ou WebP · Até 10 MB</small></button>}
          <div className="pers-ref-leitura__controles">
            <label>Modelo que lê a foto<select value={modeloLeitura} disabled={lendo || busy} onChange={(e) => setModeloLeitura(e.target.value)}>{MODEL_GROUPS.map((g) => <optgroup key={g.label} label={g.label}>{g.models.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}</optgroup>)}</select></label>
            <button type="button" className="pers-btn" disabled={!fotoReferencia || lendo || busy} onClick={() => void lerReferencia()}>{lendo ? <Loader2 size={15} className="pers-spin" /> : <ScanSearch size={15} />} {lendo ? "Lendo a foto…" : promptReferencia ? "Ler de novo" : "Ler a foto"}</button>
          </div>
        </div>
        <input ref={refInput} type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={(e) => void escolherReferencia(e.target.files)} />
        <label>Prompt da imagem (em inglês, editável)<textarea rows={8} maxLength={4000} placeholder="Leia a foto, ou escreva aqui: pessoa, roupa, pose e enquadramento, câmera, lugar, luz, acabamento." value={promptReferencia} onChange={(e) => setPromptReferencia(e.target.value)} disabled={busy || lendo} /></label>
        <div className="pers-field-note"><span>Troque a pessoa, a roupa ou o lugar antes de gerar.</span><span>{promptReferencia.length}/4000</span></div>
        <label>Como descrever a pessoa (entra nos prompts de vídeo)<input maxLength={300} placeholder="Ex.: mulher de uns 30 anos, cabelo preto liso, estilo casual" value={descricao} onChange={(e) => setDescricao(e.target.value)} disabled={busy} /></label>
      </fieldset>}
      {modo === "cgi" && <fieldset className="pers-fieldset pers-avatar-builder"><legend><span>02</span> Construtor do avatar <small>{avatarBuild.missing.length ? `${avatarBuild.missing.length} obrigatórios pendentes` : "Pronto para gerar"}</small></legend>
        {identidadeTravada && <div className="pers-identity-lock-note"><LockKeyhole size={15} /><div><strong>Identidade protegida</strong><span>O rosto já tem uma referência. Você ainda pode trocar roupa, enquadramento, luz e cenário.</span></div></div>}
        {AVATAR_FIELD_SECTIONS.map((section, index) => <details className="pers-avatar-section" key={section.title} open={index === 0 || (identidadeTravada && index === AVATAR_FIELD_SECTIONS.length - 1)}><summary><span><strong>{section.title}</strong><small>{section.description}</small></span><ChevronRight size={15} /></summary><div className="pers-avatar-fields">{section.keys.map((key) => <AvatarSelector key={key} groupKey={key} value={avatarSelections[key]} disabled={busy || pendente || (identidadeTravada && AVATAR_IDENTITY_KEYS.includes(key))} onChange={(value) => setAvatarSelections((current) => ({ ...current, [key]: value }))} />)}</div></details>)}
        <details className="pers-prompt-preview"><summary><span>Ver prompt técnico em inglês</span><ChevronRight size={14} /></summary><pre>{avatarBuild.prompt}</pre></details>
        <details className="pers-quality-checklist"><summary><span>Checklist para avaliar o resultado</span><ChevronRight size={14} /></summary><ul>{AVATAR_QUALITY_CHECKLIST.map((item) => <li key={item}><Check size={11} />{item}</li>)}</ul></details>
      </fieldset>}
      <fieldset className="pers-fieldset"><legend><span>{modo === "cgi" || modo === "referencia" ? "03" : "02"}</span> Referências visuais <small>{referencias.length}/{MAX_FOTOS}</small></legend><p className="pers-muted pers-field-intro">{modo === "referencia" ? "O primeiro retrato gerado vira a identidade. Fotos aqui são da MESMA pessoa — não a foto de referência." : "Já tem um rosto em mente? Adicione fotos da mesma pessoa."}</p>
      <div>
        <div className="pers-refs">{referencias.map((url, i) => <div className="pers-ref" key={url}><button className={url === preview ? "is-selected" : ""} aria-label={`Ver referência ${i + 1}`} onClick={() => setFotoSelecionada(url)}><img src={url} alt={`Referência ${i + 1}`} /></button><button className="pers-ref-remove" disabled={busy || pendente} aria-label={`Remover referência ${i + 1}`} onClick={() => personagem ? store().removerFoto(personagem.id, url) : setFotos((f) => f.filter((v) => v !== url))}><X size={12} /></button></div>)}
          {referencias.length > 0 && referencias.length < MAX_FOTOS && <button className="pers-upload" disabled={busy || pendente} onClick={() => upload.current?.click()} aria-label="Adicionar fotos de referência"><Plus size={20} /><span>Adicionar</span></button>}</div>
        {referencias.length === 0 && <button className={`pers-dropzone${arrastando ? " is-dragging" : ""}`} disabled={busy || pendente} onClick={() => upload.current?.click()} aria-label="Adicionar fotos de referência" onDragOver={(e) => { e.preventDefault(); if (!busy && !pendente) setArrastando(true); }} onDragLeave={() => setArrastando(false)} onDrop={(e) => { e.preventDefault(); setArrastando(false); if (!busy && !pendente) void adicionar(e.dataTransfer.files); }}><span className="pers-dropzone-icon">{busy ? <Loader2 className="pers-spin" size={21} /> : <Upload size={21} />}</span><strong>Arraste suas fotos até aqui</strong><span>ou <em>escolha os arquivos</em></span><small>JPG, PNG ou WebP · Até 10 MB por foto</small></button>}
        <input ref={upload} type="file" accept="image/jpeg,image/png,image/webp" multiple hidden onChange={(e) => void adicionar(e.target.files)} />
        <p className="pers-hint"><Camera size={13} /> Fotos nítidas e diferentes ângulos ajudam a preservar a identidade.</p>
      </div>
      </fieldset>{modo !== "referencia" && <fieldset className="pers-fieldset"><legend><span>{modo === "cgi" ? "04" : "03"}</span> Coloque em cena</legend>
      <label>Cenário do retrato<select value={ambiente} disabled={busy || pendente} onChange={(e) => setAmbiente(e.target.value)}>{AMBIENTES.map((a) => <option key={a}>{a}</option>)}</select></label>
      </fieldset>}
      {(erro || personagem?.erroGeracao) && <div className="pers-error" role="alert">{erro || personagem?.erroGeracao}<button className="pers-back" onClick={() => useWorkflowStore.getState().setSettingsOpen(true)}><Settings size={14} /> Configurações</button></div>}
      <div className="pers-generation-controls"><div className="pers-generation-meta"><span><Sparkles size={14} /> Nano Banana Pro</span><span>9:16 <i /> Retrato</span></div>
      <div className="pers-form-actions"><button className="pers-btn" disabled={busy || !nome.trim()} onClick={() => { try { onSaved(salvar()); useWorkflowStore.getState().addToast("Personagem salvo", "success"); } catch (e) { setErro(e instanceof Error ? e.message : String(e)); } }}><Check size={16} /> Salvar</button><button className="pers-btn pers-btn--primary" disabled={busy || pendente || referencias.length >= MAX_FOTOS || !podeGerar} onClick={() => void gerar()}>{busy || pendente ? <Loader2 size={16} className="pers-spin" /> : <Sparkles size={16} />}{pendente ? "Gerando retrato…" : referencias.length ? "Gerar nova referência" : modo === "cgi" ? "Criar avatar CGI" : modo === "referencia" ? "Gerar a partir da foto" : "Gerar personagem"}</button></div>
      <p className="pers-hint">Usa créditos da sua conta Kie.ai. {referencias.length >= MAX_FOTOS ? "Remova uma referência para gerar outra." : modo === "cgi" ? "O IDENTITY LOCK será salvo com o personagem para manter o rosto." : "Você pode reutilizar este personagem depois."}</p></div>
      {personagem && <div className="pers-manage"><button className="pers-back" disabled={busy || pendente} onClick={() => store().alternarAtivo(personagem.id)}>{personagem.ativo ? "Arquivar personagem" : "Reativar personagem"}</button><button className="pers-back" disabled={busy || pendente} onClick={() => setExcluir(!excluir)}><Trash2 size={14} /> Excluir</button>{excluir && <div className="pers-error">Excluir este personagem da biblioteca? As imagens continuam no Acervo.<div className="pers-form-actions"><button className="pers-btn" onClick={() => setExcluir(false)}>Cancelar</button><button className="pers-btn" onClick={() => { store().remover(personagem.id); onClose(); }}>Excluir personagem</button></div></div>}</div>}
    </div><aside className="pers-preview-panel"><div className="pers-preview-header"><span><span className="pers-live-dot" /> PRÉVIA DO PERSONAGEM</span><span><Camera size={13} /> RETRATO</span></div><div className="pers-preview-stage"><div className={`pers-preview${preview ? " has-image" : ""}`}>{preview ? <img key={preview} className="pers-result-image" src={preview} alt={`Retrato de ${nome || "personagem"}`} onLoad={(e) => { e.currentTarget.dataset.loaded = "true"; }} /> : <div className="pers-preview-empty"><div className="pers-identity-illustration"><span /><span /><div><User size={58} strokeWidth={.8} /><Fingerprint size={24} /></div></div><span className="pers-eyebrow">TUDO COMEÇA COM UMA IDENTIDADE</span><h3>Prazer, seu próximo<br />personagem.</h3><p>Um rosto, uma personalidade.<br />Preencha os detalhes e veja sua ideia ganhar vida.</p></div>}{personagem?.geracao && <GeracaoRetrato key={personagem.geracao.taskId} iniciadaEm={personagem.geracao.iniciadaEm} />}<span className="pers-preview-label"><span>{preview ? nome || "Seu personagem" : "AGUARDANDO PRIMEIRO RETRATO"}</span><span>9:16</span></span></div></div>
      <div className="pers-video"><div className="pers-video-heading"><span><Video size={19} /></span><div><h3>Agora, dê voz à sua criação.</h3><p>Transforme esse retrato em uma história.</p></div><span className="pers-step-label">PRÓXIMO PASSO</span></div><label>O que o personagem vai falar?<textarea value={roteiro} maxLength={2000} rows={3} placeholder="“Eu testei esse produto por uma semana e olha o resultado…”" onChange={(e) => setRoteiro(e.target.value)} /></label><button className="pers-btn pers-btn--video" disabled={!preview || !nome.trim() || busy || pendente || personagem?.ativo === false} onClick={() => { try { const id = salvar(); onVideo(store().personagens.find((p) => p.id === id)!, preview, roteiro); } catch (e) { setErro(String(e)); } }}>Usar em vídeo UGC <ArrowRight size={16} /></button><p className="pers-hint">Sua foto e fala vão para o criador. Você revisa tudo antes de gerar.</p></div>
    </aside></div>
  </section>;
}

