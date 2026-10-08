/**
 * Marca do Pitch AI.
 *
 * O símbolo deixou de ser desenhado em CSS (o "P" em DM Sans sobre um ladrilho
 * de gradiente) e passou a ser o arquivo real da marca: o ladrilho escuro com o
 * traço branco e o play vazado, sobre o brilho violeta.
 *
 * ── De onde vem o bitmap ────────────────────────────────────────────────────
 * `public/pitch/pitchai-logo.svg` é um SVG só por fora: dentro dele há um PNG
 * de 64×64 embutido em base64. E esse PNG de 64 **não tem canto transparente**
 * — medido pixel a pixel, o alfa mínimo da imagem inteira é 220 e os quatro
 * cantos são pretos, não vazios. Colado numa barra clara, ele viraria um
 * quadrado preto em volta do ladrilho.
 *
 * O mesmo desenho existe em 256×256 dentro de `public/pitch/pitchai-favicon.ico`
 * (o .ico traz 16, 32, 48, 64, 128 e 256), e esse **tem** o alfa certo: 387
 * pixels totalmente transparentes e o perfil de canto de um squircle. Extraí a
 * imagem de 256 do próprio .ico para `public/pitch/pitchai-mark.png` e é ela
 * que entra aqui. Nada foi redesenhado: são os bytes que vieram, só que na
 * exportação boa e com resolução para as telas de 2×.
 *
 * ── A API não mudou ─────────────────────────────────────────────────────────
 * `size` e `mono` continuam iguais — meia dúzia de telas dependem delas
 * (`AppSidebar`, `Toaster`, `HeroCriar`, `InspiracaoCard`, `PainelCabecalho`,
 * `PainelStatus`, `app/chat`, `app/gallery`), com tamanhos de 20 a 88.
 */

/** Espaço entre símbolo e texto no lockup: 27% da altura do ladrilho. */
const GAP_RATIO = 0.27;

const ARQUIVO_DA_MARCA = "/pitch/pitchai-mark.png";

/**
 * `mono` era possível quando o símbolo era CSS: bastava trocar o fundo e a cor
 * da letra. Com o bitmap não dá para repintar traço e ladrilho em separado sem
 * redesenhar a marca — e redesenhar está proibido. O que dá, sem tocar no
 * desenho, é achatar a cor: `grayscale` tira o violeta e mantém a silhueta e o
 * traço; o `invert` da versão clara troca ladrilho escuro por claro. Não é o
 * mono do brand kit; é a aproximação honesta até chegar um vetor de verdade.
 * Nenhuma tela do app passa `mono` hoje.
 */
const FILTRO_MONO = {
  light: "grayscale(1) invert(1)",
  dark: "grayscale(1)",
} as const;

export function PitchMark({ size = 26, mono }: { size?: number; mono?: "light" | "dark" }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={ARQUIVO_DA_MARCA}
      alt=""
      aria-hidden="true"
      draggable={false}
      width={size}
      height={size}
      style={{
        width: size,
        height: size,
        flexShrink: 0,
        display: "block",
        userSelect: "none",
        /* O canto arredondado já vem no alfa do arquivo — não há
           `border-radius` aqui de propósito, senão o corte do CSS brigaria
           com o do desenho e comeria a borda do squircle. */
        filter: mono ? FILTRO_MONO[mono] : undefined,
      }}
    />
  );
}

export function PitchLogo({
  size = 26,
  showWordmark = true,
  color = "var(--app-v2-text-primary, #202020)",
}: {
  size?: number;
  showWordmark?: boolean;
  color?: string;
}) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: size * GAP_RATIO }}>
      <PitchMark size={size} />
      {/* O lockup do Miora é um bloco de 63×32 com o nome sobre o autor, não uma
          palavra em caixa alta esticada: em 32px, "PITCH STUDIO" com 0.16em de
          tracking passava de 180px e ia encostar no botão de colapsar (x 202). */}
      {showWordmark && (
        <span
          style={{
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            gap: size * 0.03,
            height: size,
            color,
            whiteSpace: "nowrap",
            userSelect: "none",
          }}
        >
          <span style={{ fontSize: size * 0.47, fontWeight: 650, letterSpacing: "-0.01em", lineHeight: 1 }}>
            Pitch
          </span>
          <span style={{ fontSize: size * 0.28, fontWeight: 500, lineHeight: 1, opacity: .55 }}>
            Studio
          </span>
        </span>
      )}
    </div>
  );
}
