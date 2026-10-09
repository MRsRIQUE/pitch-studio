/* ============================================================
   SÉRIE KIT — turbo 1.000 seguidores

   O irmão do `avatarPromptKit.ts`. Lá o que se trava é a PESSOA (IDENTITY
   LOCK); aqui o que se trava é a SÉRIE (SERIES LOCK): a grade de cor, a
   proporção, o texto na tela, a abertura, o encerramento e a família
   sonora que NUNCA mudam entre episódios. O assunto muda todo dia; a
   assinatura, não. Série que troca de cara a cada post recomeça do zero
   em alcance.

   Este arquivo é só dado e montagem de texto. Não faz rede, não guarda
   nada — quem persiste é `lib/seriesStore.ts`, e quem leva o prompt para
   o composer ou para o grafo é `lib/serieGeracao.ts`.

   Idioma: a interface fala português; o PROMPT sai em inglês, porque é o
   que o modelo de vídeo lê. Por isso os valores das variáveis também
   entram em inglês — a tela avisa.
   ============================================================ */

export const SERIE_KIT_VERSION = "1.0";

export const META_SEGUIDORES = 1000;
export const DIAS_MINIMOS_NA_SERIE = 21;
export const RETENCAO_MINIMA = 40;
export const POSTS_PARA_AVALIAR_TROCA = 10;

export type EstiloId =
  | "realista-nostalgico"
  | "objeto-falante"
  | "mini-novela-3d"
  | "processo-satisfatorio";

export type CampoLock =
  | "grade_de_cor"
  | "proporcao"
  | "estilo_de_texto_na_tela"
  | "assinatura_de_abertura"
  | "assinatura_de_encerramento"
  | "trilha_ou_familia_sonora";

export type SerieLock = Record<CampoLock, string>;

export const LOCK_CAMPOS: ReadonlyArray<{ key: CampoLock; label: string; dica: string; rotuloPrompt: string; visual: boolean }> = [
  { key: "grade_de_cor", label: "Grade de cor", dica: "A cara da imagem. Entra literal em todo prompt.", rotuloPrompt: "Colour grade", visual: true },
  { key: "proporcao", label: "Proporção", dica: "9:16 para o feed vertical.", rotuloPrompt: "Aspect ratio", visual: true },
  { key: "assinatura_de_abertura", label: "Assinatura de abertura", dica: "O que o primeiro plano sempre faz.", rotuloPrompt: "Opening signature", visual: true },
  { key: "assinatura_de_encerramento", label: "Assinatura de encerramento", dica: "Como o vídeo sempre termina.", rotuloPrompt: "Closing signature", visual: true },
  { key: "estilo_de_texto_na_tela", label: "Texto na tela", dica: "Fonte, posição e quantidade. Vai na edição, não no modelo.", rotuloPrompt: "On-screen text", visual: false },
  { key: "trilha_ou_familia_sonora", label: "Trilha ou família sonora", dica: "O som que o espectador reconhece antes de ler a legenda.", rotuloPrompt: "Sound family", visual: false },
];

export interface Plano {
  n: number;
  /** Segundos, para calcular a duração do clipe. */
  inicio: number;
  fim: number;
  /** O texto "0.0 – 1.5s", para a tela. */
  tempo: string;
  /** O papel do plano na retenção, em português. */
  funcao: string;
  /** O molde do prompt em inglês, com `{slots}`. */
  prompt: string;
}

export interface VariavelSerie {
  slot: string;
  label: string;
  exemplo: string;
  /** `false` quando o slot só entra na legenda ou na ficha, não no prompt. */
  noPrompt: boolean;
}

export type HookId =
  | "detalhe-sem-contexto"
  | "ja-em-movimento"
  | "estado-desconfortavel"
  | "quebra-de-categoria"
  | "promessa-de-revelacao";

export interface Estilo {
  id: EstiloId;
  nome: string;
  promessa: string;
  porQueFunciona: string;
  /** Segundos: [mínimo, máximo]. */
  duracaoAlvo: [number, number];
  lock: SerieLock;
  variaveis: VariavelSerie[];
  planos: Plano[];
  textoNaTela: string;
  audio: string;
  cta: string;
  hooks: HookId[];
  /** Gera a legenda sugerida a partir dos valores preenchidos. */
  legenda: (valores: Record<string, string>) => string;
}

const v = (slot: string, label: string, exemplo: string, noPrompt = true): VariavelSerie => ({ slot, label, exemplo, noPrompt });

export const ESTILOS: Record<EstiloId, Estilo> = {
  "realista-nostalgico": {
    id: "realista-nostalgico",
    nome: "Realista Nostálgico",
    promessa: "Cenas hiper-reais de lifestyle que prendem o olhar e disparam memória afetiva.",
    porQueFunciona: "Nostalgia é o gatilho com maior taxa de salvamento e compartilhamento. O espectador não comenta “que legal”, ele marca alguém. Marcação vale mais que like para alcance.",
    duracaoAlvo: [10, 14],
    lock: {
      grade_de_cor: "warm faded film, lifted blacks, slight halation on highlights, fine 35mm grain",
      proporcao: "9:16",
      estilo_de_texto_na_tela: "one line, serif, bottom-left corner, always in the same spot",
      assinatura_de_abertura: "first shot is always an extreme close-up detail, never a wide shot",
      assinatura_de_encerramento: "hard cut mid-movement, no fade",
      trilha_ou_familia_sonora: "piano or acoustic guitar instrumental with tape hiss, no voice-over, low constant volume",
    },
    variaveis: [
      v("objeto", "Objeto", "a rotary phone dial"),
      v("ambiente", "Ambiente", "a small Brazilian living room"),
      v("decada", "Década", "the 1990s"),
      v("acao_com_objeto", "Ação com o objeto", "rewinding a cassette tape with a pencil"),
      v("detalhe_epoca", "Detalhe de época", "a crochet doily under a CRT television"),
      v("memoria", "Memória (para a legenda)", "Sunday afternoons at grandma's", false),
    ],
    planos: [
      { n: 1, inicio: 0, fim: 1.5, tempo: "0.0 – 1.5s", funcao: "Hook. Detalhe extremo, sem contexto. A pergunta “o que é isso?” segura o dedo.", prompt: "Extreme close-up macro of {objeto}, shallow focus, dust motes floating in a single shaft of warm afternoon light. Slow push-in, handheld micro-drift. Shot on 35mm film, warm faded grade, lifted blacks, fine grain, slight halation. No people. 9:16." },
      { n: 2, inicio: 1.5, fim: 4.5, tempo: "1.5 – 4.5s", funcao: "Revelação do contexto. Entrega a recompensa do hook.", prompt: "Slow wide reveal of {ambiente} in {decada}, lived-in and slightly untidy, late afternoon light through a window. Camera drifts back on a gentle dolly. Same warm faded 35mm grade, lifted blacks, grain. No faces visible. 9:16." },
      { n: 3, inicio: 4.5, fim: 8, tempo: "4.5 – 8.0s", funcao: "Presença humana sem rosto. É o que cria identificação sem quebrar o faceless.", prompt: "Hands only, from behind, {acao_com_objeto}. Unhurried, unperformed movement. Forearms and sleeves in frame, head never enters the shot. Warm window light from camera left. Same 35mm grade and grain. 9:16." },
      { n: 4, inicio: 8, fim: 11, tempo: "8.0 – 11.0s", funcao: "Âncora de memória. O detalhe específico que faz o espectador marcar alguém.", prompt: "Static close-up of {detalhe_epoca}, worn by use, imperfect, sitting exactly where someone left it. Dust visible on the surface. Warm faded film grade, grain, no camera movement. 9:16." },
      { n: 5, inicio: 11, fim: 13, tempo: "11.0 – 13.0s", funcao: "Saída. Corta no meio do movimento — vídeo que termina redondo não é reassistido.", prompt: "Camera drifts slowly toward the window, light blowing out to white. Movement continues as the frame ends. Same grade and grain. 9:16." },
    ],
    textoNaTela: "Uma frase só, no plano 2. Formato: uma afirmação incompleta que o comentário completa.",
    audio: "Instrumental de piano ou violão com ruído de fita. Sem locução. Volume baixo e constante — o silêncio relativo é parte do formato.",
    cta: "Nenhum CTA falado. O CTA é a frase incompleta no plano 2.",
    hooks: ["detalhe-sem-contexto", "promessa-de-revelacao"],
    legenda: (val) => `if you remember ${val.memoria?.trim() || "this"}, you ___`,
  },

  "objeto-falante": {
    id: "objeto-falante",
    nome: "Objeto Falante",
    promessa: "Comida e objetos do dia a dia com rosto e voz — humor absurdo que viraliza rápido.",
    porQueFunciona: "Humor absurdo tem o menor tempo até a primeira reação. É o estilo que mais rápido acumula seguidor novo, e o mais fácil de produzir em série porque o personagem é o mesmo sempre.",
    duracaoAlvo: [8, 12],
    lock: {
      grade_de_cor: "bright saturated, hard key light, tiny sharp shadows, glossy surfaces",
      proporcao: "9:16",
      estilo_de_texto_na_tela: "large centered caption, heavy font, black outline, word by word in sync with the voice",
      assinatura_de_abertura: "the character is already talking on frame 1, no introduction",
      assinatura_de_encerramento: "freeze on the object's face at the punchline",
      trilha_ou_familia_sonora: "generated voice with a mismatched timbre (deep voice for a small object), exaggerated sound effects on every action",
    },
    variaveis: [
      v("objeto", "Objeto (o personagem)", "sad avocado"),
      v("situacao", "Situação que piora", "being put back on the shelf for the third time"),
      v("evento_fisico", "Evento físico da virada", "a hand grabs it and squeezes hard"),
      v("punchline", "Punchline (última fala, uma pergunta)", "so… are we still doing brunch?", false),
    ],
    planos: [
      { n: 1, inicio: 0, fim: 2, tempo: "0.0 – 2.0s", funcao: "Hook. Já entra falando. Nunca apresente o personagem — a estranheza é o hook.", prompt: "A {objeto} with expressive cartoon eyes and a mouth integrated into its surface, talking directly to camera, mid-sentence. Photoreal object, stylised face. Bright hard key light, saturated colours, glossy surface, tiny sharp shadows. Centered, static camera. 9:16." },
      { n: 2, inicio: 2, fim: 5, tempo: "2.0 – 5.0s", funcao: "Escalada. O problema piora.", prompt: "The same {objeto} reacting to {situacao}, face contorting in exaggerated alarm, leaning back slightly. Other objects visible behind, blurred, not reacting. Same bright hard lighting and saturation. Static camera. 9:16." },
      { n: 3, inicio: 5, fim: 8, tempo: "5.0 – 8.0s", funcao: "Virada. Alguma coisa acontece com ele.", prompt: "Wider shot: {evento_fisico} happens to the {objeto}. Movement is fast and physical, comedic timing. Same lighting and grade. Slight camera shake on impact. 9:16." },
      { n: 4, inicio: 8, fim: 10, tempo: "8.0 – 10.0s", funcao: "Punchline. Congela.", prompt: "Tight close-up on the {objeto}'s face, deadpan expression, holding still, looking directly at camera. Frame freezes. Same lighting. 9:16." },
    ],
    textoNaTela: "A fala do objeto, legendada palavra a palavra em sincronia. Legenda é obrigatória — a maioria assiste sem som.",
    audio: "Voz gerada com timbre deslocado do objeto (voz grave para objeto pequeno funciona melhor que o contrário). Efeitos sonoros exagerados nas ações.",
    cta: "O objeto pergunta algo absurdo na última fala. Pergunta gera comentário, comentário gera alcance.",
    hooks: ["ja-em-movimento", "quebra-de-categoria"],
    legenda: (val) => val.punchline?.trim() || "…wait, what would YOU do?",
  },

  "mini-novela-3d": {
    id: "mini-novela-3d",
    nome: "Mini-novela 3D",
    promessa: "Histórias animadas curtas com gancho para o episódio seguinte.",
    porQueFunciona: "É o único dos quatro que gera follow por obrigação narrativa: o espectador segue para não perder o final. Custa mais para produzir, mas converte seguidor melhor que os outros três juntos.",
    duracaoAlvo: [15, 25],
    lock: {
      grade_de_cor: "stylised 3D animation, soft global illumination, warm rim light, slightly oversaturated",
      proporcao: "9:16",
      estilo_de_texto_na_tela: "'EPISODE {n}' title card in the first 0.5s, always identical",
      assinatura_de_abertura: "same main character, same opening pose",
      assinatura_de_encerramento: "cut at the moment of the reveal, 'to be continued' card",
      trilha_ou_familia_sonora: "light orchestral score, same family in every episode, no voice-over; character murmurs instead of words",
    },
    variaveis: [
      v("personagem", "Personagem principal", "a small round robot with a dented antenna"),
      v("cenario", "Cenário", "a cluttered kitchen at night"),
      v("conflito", "Conflito", "the toaster starts launching bread at the ceiling"),
    ],
    planos: [
      { n: 1, inicio: 0, fim: 3, tempo: "0.0 – 3.0s", funcao: "Setup. Estabelece quem e onde, rápido.", prompt: "Stylised 3D animated character, {personagem}, in {cenario}, established in a single wide shot. Soft global illumination, warm rim light, slightly oversaturated palette, rounded shapes, expressive oversized eyes. Gentle camera push. 9:16." },
      { n: 2, inicio: 3, fim: 8, tempo: "3.0 – 8.0s", funcao: "Conflito. O problema aparece e é imediatamente compreensível sem áudio.", prompt: "{conflito} unfolds. The character's posture collapses in reaction, readable from silhouette alone. Camera holds at medium. Same 3D style, lighting and palette. 9:16." },
      { n: 3, inicio: 8, fim: 15, tempo: "8.0 – 15.0s", funcao: "Tentativa. Ele age e piora.", prompt: "The character attempts to fix it and makes it worse. Physical comedy beat, fast movement, exaggerated squash and stretch. Camera follows the action. Same style and lighting. 9:16." },
      { n: 4, inicio: 15, fim: 20, tempo: "15.0 – 20.0s", funcao: "Revelação parcial. Mostra o suficiente para gerar a pergunta.", prompt: "A slow push-in on the character's face as they realise something off-screen. Eyes widen. Light shifts cooler. Do not reveal what they are looking at. Same 3D style. 9:16." },
      { n: 5, inicio: 20, fim: 22, tempo: "20.0 – 22.0s", funcao: "Corte. Cartela de continuação.", prompt: "Hard cut to black. Same-style title card reading 'TO BE CONTINUED — EPISODE {proximo}'. Hold 1.5 seconds. 9:16." },
    ],
    textoNaTela: "Cartela de episódio na abertura e cartela de continuação no fim. Nada no meio — a animação tem que se explicar sozinha.",
    audio: "Trilha orquestral leve, mesma família em todos os episódios. Sem locução; sons de personagem (murmúrios, não palavras) evitam legendagem e atravessam idioma.",
    cta: "A cartela de continuação é o CTA. Não peça follow em voz — a curiosidade já faz o trabalho.",
    hooks: ["ja-em-movimento", "promessa-de-revelacao"],
    legenda: (val) => `episode ${val.episodio || "?"} — what did ${val.personagem?.trim() || "they"} just see?`,
  },

  "processo-satisfatorio": {
    id: "processo-satisfatorio",
    nome: "Processo Satisfatório",
    promessa: "Transformação de algo sujo, quebrado ou bagunçado em algo perfeito, em close.",
    porQueFunciona: "Maior taxa de retenção até o fim dos quatro, porque o espectador fica pela resolução. Retenção completa é o sinal mais forte para o algoritmo.",
    duracaoAlvo: [12, 18],
    lock: {
      grade_de_cor: "clean neutral white balance, high micro-contrast, no colour cast",
      proporcao: "9:16",
      estilo_de_texto_na_tela: "none — the format is silent by nature",
      assinatura_de_abertura: "always the 'before' state in a static close-up, one full second",
      assinatura_de_encerramento: "pull-back revealing the whole result",
      trilha_ou_familia_sonora: "amplified direct sound of the process (scraping, liquid, cloth), no music",
    },
    variaveis: [
      v("objeto", "Objeto", "a cast-iron skillet"),
      v("estado_inicial", "Estado inicial (o “antes”)", "covered in thick rust and burnt grease"),
      v("processo", "Processo", "scrubbing with steel wool and vinegar"),
    ],
    planos: [
      { n: 1, inicio: 0, fim: 1.5, tempo: "0.0 – 1.5s", funcao: "O “antes”. Estático e feio. Desconforto é o hook.", prompt: "Static macro close-up of {objeto} in {estado_inicial}, unpleasant texture in sharp detail. Clean neutral lighting, high micro-contrast, no colour cast. Absolutely still camera. 9:16." },
      { n: 2, inicio: 1.5, fim: 6, tempo: "1.5 – 6.0s", funcao: "Primeira passada. A linha limpa aparece — é o momento que trava o espectador.", prompt: "Hands only, gloved, performing the first pass of {processo} across {objeto}. One clean stripe appears against the untouched surface. Macro, shallow depth, liquid and texture clearly visible. Same neutral lighting. 9:16." },
      { n: 3, inicio: 6, fim: 11, tempo: "6.0 – 11.0s", funcao: "Progresso acelerado. Mostra que está funcionando.", prompt: "Time-lapse of {processo} continuing across the whole surface of {objeto}, transformation clearly advancing. Hands enter and leave frame. Macro, same lighting and grade. 9:16." },
      { n: 4, inicio: 11, fim: 15, tempo: "11.0 – 15.0s", funcao: "Resultado. Pull-back para o objeto inteiro.", prompt: "Slow pull-back from macro to full object, now fully restored, reflective and clean. Single soft highlight travels across the surface as the camera moves. Same neutral grade. 9:16." },
    ],
    textoNaTela: "Nenhum. Se precisar explicar, o vídeo falhou.",
    audio: "Som direto amplificado do processo — raspagem, líquido, tecido. Sem música. É o áudio que faz o formato ser ASMR e não só um time-lapse.",
    cta: "Nenhum. Poste o próximo.",
    hooks: ["detalhe-sem-contexto", "estado-desconfortavel"],
    legenda: () => "",
  },
};

export const ESTILO_IDS: readonly EstiloId[] = ["realista-nostalgico", "objeto-falante", "mini-novela-3d", "processo-satisfatorio"];

export const HOOKS: ReadonlyArray<{ id: HookId; nome: string; descricao: string }> = [
  { id: "detalhe-sem-contexto", nome: "Detalhe sem contexto", descricao: "Macro extremo de algo irreconhecível. A pergunta segura o dedo." },
  { id: "ja-em-movimento", nome: "Já em movimento", descricao: "A ação começa no frame 1, sem introdução. O espectador entra atrasado e fica para entender." },
  { id: "estado-desconfortavel", nome: "Estado desconfortável", descricao: "Mostrar o feio, sujo ou errado primeiro. Desconforto retém tanto quanto beleza." },
  { id: "quebra-de-categoria", nome: "Quebra de categoria", descricao: "Algo que não deveria ter rosto, tem. Absurdo imediato." },
  { id: "promessa-de-revelacao", nome: "Promessa de revelação", descricao: "Enquadrar deliberadamente cortando o que importa." },
];

export const REGRA_DO_HOOK = "O hook mora nos primeiros 1,5 segundos e é visual, nunca falado. Locução no início derruba retenção porque exige decodificação.";

export const CADENCIA = {
  meta: "1.000 seguidores para destravar a afiliação no TikTok Shop.",
  regraDaSerie: "Escolha UM estilo e fique nele por no mínimo 21 dias. Trocar de estilo reinicia o reconhecimento e é o erro mais comum.",
  ritmo: "1 a 2 posts por dia, mesmo horário. O horário fixo importa mais que o horário ideal.",
  leituraDeResultado: "Avalie por retenção média e por seguidores-por-post, nunca por views. Um vídeo de 3 mil views que traz 40 seguidores vale mais que um de 90 mil que traz 5.",
  quandoTrocar: "Só troque de estilo se 10 posts seguidos ficarem abaixo de 40% de retenção média. Abaixo disso o problema é o formato; acima disso é o assunto.",
} as const;

export const CHECKLIST_PUBLICACAO = [
  "O primeiro frame faz sentido como capa estática? É ele que aparece no perfil.",
  "O vídeo é compreensível com som desligado?",
  "A assinatura da série (cor, texto, abertura) está idêntica à do post anterior?",
  "O corte final interrompe um movimento em vez de terminar redondo?",
  "A legenda faz uma pergunta ou deixa uma frase incompleta?",
  "Sem marca d'água de outra plataforma — o TikTok reduz alcance de vídeo com marca de concorrente.",
] as const;

/* ── Montagem ─────────────────────────────────────────────── */

const RE_SLOT = /\{([a-z_]+)\}/g;

export function slotsDoTexto(texto: string): string[] {
  const vistos = new Set<string>();
  for (const m of texto.matchAll(RE_SLOT)) vistos.add(m[1]);
  return [...vistos];
}

/** Troca `{slot}` por valor. Slots sem valor ficam como estão e são listados. */
export function preencher(molde: string, valores: Record<string, string>): { texto: string; faltando: string[] } {
  const faltando = new Set<string>();
  const texto = molde.replace(RE_SLOT, (tudo, slot: string) => {
    const valor = valores[slot]?.trim();
    if (!valor) { faltando.add(slot); return tudo; }
    return valor;
  });
  return { texto, faltando: [...faltando] };
}

export function duracaoDoEpisodio(estilo: Estilo): number {
  return estilo.planos[estilo.planos.length - 1]?.fim ?? 0;
}

/** O bloco literal que se reinjeta em toda geração. Só os campos que o
 *  modelo de vídeo consegue obedecer; texto e som ficam para a edição. */
export function montarSerieLock(lock: SerieLock, opcoes: { visualApenas?: boolean } = {}): string {
  const linhas = LOCK_CAMPOS
    .filter((c) => (opcoes.visualApenas ? c.visual : true))
    .map((c) => lock[c.key]?.trim() ? `- ${c.rotuloPrompt}: ${lock[c.key].trim()}.` : "")
    .filter(Boolean);
  return ["## SERIES LOCK (identical in every episode)", ...linhas].join("\n");
}

export interface PlanoMontado {
  n: number;
  tempo: string;
  inicio: number;
  fim: number;
  funcao: string;
  /** O prompt do plano já preenchido, com o SERIES LOCK ao final. */
  prompt: string;
  /** Só o plano preenchido, sem o lock — para o prompt único. */
  cena: string;
  faltando: string[];
}

export interface EpisodioMontado {
  numero: number;
  duracao: number;
  planos: PlanoMontado[];
  /** Um prompt só, com os planos em sequência — para gerar o episódio num take. */
  promptUnico: string;
  /** Slots que ainda não têm valor, na ordem em que aparecem. */
  faltando: string[];
  ficha: { legenda: string; textoNaTela: string; audio: string; cta: string };
}

/** Preenche os planos de um estilo com os valores do episódio e reinjeta o lock. */
export function montarEpisodio(estilo: Estilo, lock: SerieLock, valores: Record<string, string>, numero: number): EpisodioMontado {
  const completos: Record<string, string> = { ...valores, episodio: String(numero), proximo: String(numero + 1) };
  const lockVisual = montarSerieLock(lock, { visualApenas: true });
  const faltando = new Set<string>();

  const planos: PlanoMontado[] = estilo.planos.map((p) => {
    const { texto, faltando: f } = preencher(p.prompt, completos);
    f.forEach((s) => faltando.add(s));
    return { n: p.n, tempo: p.tempo, inicio: p.inicio, fim: p.fim, funcao: p.funcao, cena: texto, faltando: f, prompt: `${texto}\n\n${lockVisual}` };
  });

  const duracao = duracaoDoEpisodio(estilo);
  const promptUnico = [
    `Vertical short-form video, ${lock.proporcao || "9:16"}, ${duracao} seconds total, ${planos.length} shots cut hard in sequence. No on-screen text, no watermark, no logos.`,
    "",
    ...planos.map((p) => `Shot ${p.n} (${p.tempo}): ${p.cena}`),
    "",
    lockVisual,
  ].join("\n");

  return {
    numero,
    duracao,
    planos,
    promptUnico,
    faltando: [...faltando],
    ficha: {
      legenda: estilo.legenda(completos),
      textoNaTela: estilo.textoNaTela,
      audio: estilo.audio,
      cta: estilo.cta,
    },
  };
}

export function valoresVazios(estilo: Estilo): Record<string, string> {
  return Object.fromEntries(estilo.variaveis.map((x) => [x.slot, ""]));
}

/** Uma linha que descreve o episódio na lista, a partir dos valores. */
export function descreverEpisodio(estilo: Estilo, valores: Record<string, string>): string {
  const partes = estilo.variaveis.filter((x) => x.noPrompt).map((x) => valores[x.slot]?.trim()).filter(Boolean);
  return partes.slice(0, 2).join(" · ") || "Sem assunto ainda";
}
