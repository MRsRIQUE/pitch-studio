/**
 * Marca do SaySell no Studio.
 *
 * O símbolo é o mesmo arquivo do site (`public/logo-nav.png` do saysell-web,
 * copiado para `public/saysell/logo-nav.png`) e é montado do mesmo jeito que o
 * cabeçalho do site: ladrilho marinho `--ss-navy` com canto de 30% e o PNG por
 * cima, levemente ampliado para o brilho encostar na borda. O wordmark é
 * "SaySell" em Sora extrabold, como no site, com "Studio" abaixo.
 *
 * `size` e `mono` mantêm a API do antigo `PitchMark`/`PitchLogo` — as telas
 * passam tamanhos de 20 a 88.
 */

/** Espaço entre símbolo e texto no lockup: 27% da altura do ladrilho. */
const GAP_RATIO = 0.27;

const ARQUIVO_DA_MARCA = "/saysell/logo-nav.png";

/** Marinho institucional do kit (`--ss-navy`). */
const NAVY = "#07142E";

/**
 * Sem vetor da marca não dá para repintar traço e ladrilho em separado; o que
 * dá é achatar a cor. Nenhuma tela passa `mono` hoje.
 */
const FILTRO_MONO = {
  light: "grayscale(1) invert(1)",
  dark: "grayscale(1)",
} as const;

export function SaySellMark({ size = 26, mono }: { size?: number; mono?: "light" | "dark" }) {
  return (
    <span
      aria-hidden="true"
      style={{
        width: size,
        height: size,
        flexShrink: 0,
        display: "inline-flex",
        overflow: "hidden",
        borderRadius: "30%",
        background: NAVY,
        filter: mono ? FILTRO_MONO[mono] : undefined,
      }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={ARQUIVO_DA_MARCA}
        alt=""
        draggable={false}
        width={size}
        height={size}
        style={{
          width: "100%",
          height: "100%",
          objectFit: "cover",
          transform: "scale(1.04)",
          userSelect: "none",
        }}
      />
    </span>
  );
}

export function SaySellLogo({
  size = 26,
  showWordmark = true,
  color = "var(--app-v2-text-primary, #14213D)",
}: {
  size?: number;
  showWordmark?: boolean;
  color?: string;
}) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: size * GAP_RATIO }}>
      <SaySellMark size={size} />
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
          <span
            style={{
              fontFamily: "var(--font-brand)",
              fontSize: size * 0.5,
              fontWeight: 800,
              letterSpacing: "-0.02em",
              lineHeight: 1,
            }}
          >
            SaySell
          </span>
          <span style={{ fontSize: size * 0.28, fontWeight: 500, lineHeight: 1, opacity: 0.55 }}>
            Studio
          </span>
        </span>
      )}
    </div>
  );
}
