/* ============================================================
   GYRO — a geometria da nota do loop de carregamento

   A nota (`.migracao/notas-rn/gyro.tsx.txt`) é um estúdio inteiro de "orbes de
   pensamento": 40 e tantos estilos, cada um uma função que cospe pontos 3D, e
   um projetor comum que os achata e ordena por profundidade. Ela roda dentro
   de um `Skia.PictureRecorder` do react-native-skia.

   Aqui está portado **só o estilo 21**, que é o `gyro` — `LOOP_INDEX = 21` na
   nota, e `DRAWS[21]` resolve para `specs10[13]`. Nada foi reinterpretado: as
   funções abaixo são as mesmas contas, com os mesmos números.

   A matemática é JavaScript puro nos dois lados; o único trecho que era do
   Skia é o desenho do círculo, que no navegador é `arc()` de canvas 2D. Por
   isso **nenhum número precisou ser ajustado neste arquivo** — a lista está
   conferida no relatório.
   ============================================================ */

const TAU = Math.PI * 2;

/** Os valores literais do cabeçalho da nota. */
export const NOTA = {
  /** `PERIOD` — a volta completa do loop, em segundos. */
  periodo: 6.2,
  /** `LABEL` — o rótulo que a nota mostra ao lado da bola. */
  rotulo: "Aligning...",
  /** `SPEED` · `REVERSE` · `START_AT` */
  velocidade: 1.0,
  inverso: false,
  inicioEm: 0.0,
  /** `BALL` — o lado da caixa quadrada onde a bola é desenhada. */
  bola: 46.0,
  /** `DOT_SCALE` */
  escalaDoPonto: 1.0,
  /** `GAP` e os quatro `PAD_*` da pílula. */
  vao: 9.0,
  padTopo: 7.0,
  padDireita: 22.0,
  padBaixo: 7.0,
  padEsquerda: 8.0,
  /** `FONT_SIZE` e `LABEL_OPACITY` */
  fonte: 14.0,
  opacidadeDoRotulo: 0.74,
  /**
   * `ACCENT_COLOR` da nota. **Não é mais a cor que se pinta**: o usuário trocou
   * a laranja pelo violeta da marca. Este valor fica como marcador de QUAIS
   * pontos são do acento (o anel do meio) — quem escolhe a tinta é o
   * renderizador, por `acentoDaMarca()`. Desenho e tempos, inalterados.
   */
  acento: "#E8853C",
  ponto: "#25242A",
  pilula: "#ECECEF",
  rotuloCor: "#25242A",
  /** Quantos pontos o estilo desenha: 3 anéis de 40 mais 38 do núcleo. */
  pontos: 158,
} as const;

/** `KNOBS` da nota — todos neutros; ficam explícitos porque as contas os usam. */
export interface Knobs {
  n: number; sp: number; pv: number; dz: number; df: number;
  yw: number; pc: number; sn: number; op: number;
}

export const KNOBS_NEUTROS: Knobs = { n: 1, sp: 1, pv: 1, dz: 1, df: 1, yw: 0, pc: 0, sn: 0, op: 1 };

/** Um ponto no espaço da nota: [x, y, z, escala, alfa, cor?]. */
type Ponto = [number, number, number, number, number, string?];

/** Um ponto já projetado na tela. */
export interface PontoNaTela {
  x: number;
  y: number;
  r: number;
  a: number;
  acento: boolean;
}

const cl = (u: number) => (u < 0 ? 0 : u > 1 ? 1 : u);
const NC = (c: number, n: number) => {
  const v = Math.round(c * n);
  return v < 1 ? 1 : v;
};

/** Gira em torno de Y (`ay`) e depois em torno de X (`ax`). */
function rot(p: Ponto, ay: number, ax: number): Ponto {
  const ca = Math.cos(ay), sa = Math.sin(ay);
  const X = p[0] * ca - p[2] * sa;
  let Z = p[0] * sa + p[2] * ca;
  const cb = Math.cos(ax), sb = Math.sin(ax);
  const Y = p[1] * cb - Z * sb;
  Z = p[1] * sb + Z * cb;
  return [X, Y, Z, p[3], p[4], p[5]];
}

/** A câmera da nota. Com os knobs neutros ela é a identidade; fica porque é. */
function view(p: Ponto, k: Knobs, t: number): Ponto {
  const ay = k.yw + TAU * k.sn * t;
  const ca = Math.cos(ay), sa = Math.sin(ay);
  const X = p[0] * ca - p[2] * sa;
  let Z = p[0] * sa + p[2] * ca;
  const cb = Math.cos(k.pc), sb = Math.sin(k.pc);
  const Y = p[1] * cb - Z * sb;
  Z = p[1] * sb + Z * cb;
  return [X, Y, Z, p[3], p[4], p[5]];
}

/** Espiral de Fibonacci na esfera — o núcleo do gyro usa 38 pontos dela. */
function fib(i: number, N: number): Ponto {
  const y = 1 - (i / (N - 1)) * 2;
  const r = Math.sqrt(Math.max(0, 1 - y * y));
  const th = i * 2.399963;
  return [Math.cos(th) * r, y, Math.sin(th) * r, 1, 1];
}

/**
 * O projetor do `specs10`: perspectiva `f = 3.5`, profundidade normalizada por
 * `(z + 1.1) / 2.2`, raio do ponto em `0.4 + 1.6·d` e alfa em
 * `0.07 + 0.93·d^1.55`. Ordena por z para o mais distante ser pintado antes.
 */
function projetar(
  pts: Ponto[],
  S: number,
  k: Knobs,
  t: number,
  RF: number,
  ds: number,
  emitir: (x: number, y: number, r: number, a: number, cor: string) => void,
): void {
  const cx = S / 2, cy = S / 2;
  const R = S * (RF || 0.3) * k.sp;
  const f = 3.5 * k.pv;
  const saida: [number, number, number, number, string, number][] = [];

  for (const p0 of pts) {
    const p = view(p0, k, t);
    const z = p[2];
    const per = f / (f - z);
    const d = cl((z + 1.1) / 2.2);
    saida.push([
      cx + p[0] * R * per,
      cy + p[1] * R * per,
      ds * (0.4 + 1.6 * k.dz * d) * per * (p[3] === undefined ? 1 : p[3]),
      (0.07 + 0.93 * Math.pow(d, 1.55 * k.df)) * (p[4] === undefined ? 1 : p[4]),
      p[5] || NOTA.ponto,
      z,
    ]);
  }
  saida.sort((a, b) => a[5] - b[5]);
  for (const o of saida) emitir(o[0], o[1], o[2], o[3], o[4]);
}

/** `sizeDotScale` da nota. Para a bola de 46 o primeiro degrau já responde: 0.4. */
export function escalaPorTamanho(S: number): number {
  if (S <= 46) return 0.4;
  if (S <= 190) return 0.4 + ((S - 46) / 144) * 0.6;
  if (S <= 340) return 1 + ((S - 190) / 150) * 0.55;
  return 1.55;
}

/**
 * `DRAWS[21]` = `specs10[13]`, o gyro.
 *
 * Três anéis de 40 pontos, de raios 1.0, 0.78 e 0.56, cada um tombando em
 * torno do próprio diâmetro a `(k+1)` voltas por loop e assentado num plano
 * girado de `k · 1.05`; o do meio é o do acento. No centro, uma bolinha de 38
 * pontos em espiral de Fibonacci, encolhida a 0.3 e girando ao contrário, a
 * duas voltas por loop. Quatro rotações independentes que fecham juntas.
 */
function desenharGyro(t: number, S: number, k: Knobs, ds: number,
                      emitir: (x: number, y: number, r: number, a: number, cor: string) => void): void {
  const pts: Ponto[] = [];

  const raios = [1.0, 0.78, 0.56];
  for (let anel = 0; anel < 3; anel++) {
    const rad = raios[anel];
    const n = NC(40, k.n);
    for (let i = 0; i < n; i++) {
      const th = (i / n) * TAU;
      const base: Ponto = [
        Math.cos(th) * rad, Math.sin(th) * rad, 0,
        0.8, 0.9,
        anel === 1 ? NOTA.acento : NOTA.ponto,
      ];
      pts.push(rot(rot(base, 0, (anel + 1) * TAU * t), anel * 1.05, 0.3));
    }
  }

  const nNucleo = NC(38, k.n);
  for (let i = 0; i < nNucleo; i++) {
    const p = rot(fib(i, nNucleo), -2 * TAU * t, 0.4);
    pts.push([p[0] * 0.3, p[1] * 0.3, p[2] * 0.3, 0.85, 0.9, NOTA.ponto]);
  }

  projetar(pts, S, k, t, 0.29, ds, emitir);
}

/* ── O ajuste de enquadramento ────────────────────────────────
   `fitFactor` roda o desenho em 20 instantes do loop, mede o quanto ele se
   afasta do centro e devolve o fator que o encaixa em 41,5% da caixa. É por
   isso que o gyro não vaza fora da bola nos quadros em que os anéis estão de
   perfil. O resultado é constante para um dado tamanho, então fica em cache. */
const CACHE_ENQUADRAMENTO = new Map<string, number>();

export function fatorDeEnquadramento(S: number, k: Knobs = KNOBS_NEUTROS): number {
  const chave = `${S}@${k.n}/${k.sp}/${k.pv}/${k.dz}/${k.df}/${k.yw}/${k.pc}/${k.sn}`;
  const guardado = CACHE_ENQUADRAMENTO.get(chave);
  if (guardado !== undefined) return guardado;

  const h = S / 2;
  let ext = 0;
  for (let q = 0; q < 20; q++) {
    /* A sonda usa `ds = 1`, como na nota: o fator mede a FORMA, não o
       tamanho do ponto, senão o enquadramento mudaria junto com a escala. */
    desenharGyro(q / 20, S, k, 1, (x, y, r, a) => {
      if (a <= 0.05 || r <= 0.15) return;
      ext = Math.max(ext, Math.abs(x - h) + r * 0.5, Math.abs(y - h) + r * 0.5);
    });
  }
  const f = ext > 1 ? Math.max(0.55, Math.min(1.7, (S * 0.415) / ext)) : 1;
  CACHE_ENQUADRAMENTO.set(chave, f);
  return f;
}

/** A fase do loop, em [0,1). É o `orbPhase` da nota. */
export function fase(segundos: number, periodo = NOTA.periodo,
                     velocidade = NOTA.velocidade, inverso = NOTA.inverso,
                     inicioEm = NOTA.inicioEm): number {
  const s = segundos < 0 ? 0 : segundos;
  const vao = periodo / Math.max(0.0001, velocidade);
  let t = (s % vao) / vao;
  if (t < 0) t += 1;
  if (inverso) t = 1 - t;
  t = (t + inicioEm) % 1;
  if (t < 0) t += 1;
  return t;
}

/** Os pontos do gyro prontos para pintar, no instante `t` do loop. */
export function pontosDoGyro(t: number, S = NOTA.bola, k: Knobs = KNOBS_NEUTROS): PontoNaTela[] {
  const f = fatorDeEnquadramento(S, k);
  const h = S / 2;
  const fora: PontoNaTela[] = [];
  desenharGyro(t, S, k, escalaPorTamanho(S) * NOTA.escalaDoPonto, (x, y, r, a, cor) => {
    const fx = h + (x - h) * f;
    const fy = h + (y - h) * f;
    const fr = r * (0.55 + 0.45 * f);
    const fa = a * k.op;
    if (fr <= 0.05 || fa <= 0.004) return;
    fora.push({ x: fx, y: fy, r: fr, a: Math.min(1, fa), acento: cor === NOTA.acento });
  });
  return fora;
}

/* ── O acento, agora na marca ─────────────────────────────────
   O canvas 2D não resolve `var(--brand-violet)`: `fillStyle` quer uma cor de
   verdade. Então o token é lido do documento uma vez e memorizado. O reserva
   existe para o caminho de renderização no servidor e para o caso de a folha
   de tokens ainda não ter chegado. */
let acentoMemorizado: string | null = null;

export function acentoDaMarca(): string {
  if (acentoMemorizado) return acentoMemorizado;
  if (typeof window === "undefined") return "#4318FF";
  const lido = getComputedStyle(document.documentElement)
    .getPropertyValue("--brand-violet")
    .trim();
  acentoMemorizado = lido || "#4318FF";
  return acentoMemorizado;
}
