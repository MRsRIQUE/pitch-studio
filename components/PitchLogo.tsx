/**
 * Logotipo do Pitch Studio, seguindo o "Pitch AI Brand Kit".
 *
 * Símbolo: tile arredondado com o gradiente 135° #868CFF → #4318FF e o "P" em
 * DM Sans bold branco. O kit especifica raio = 27% do lado — por isso o
 * borderRadius é calculado a partir do tamanho, e não fixo.
 *
 * Lockup horizontal: espaço entre símbolo e texto = 27% da altura do tile.
 * Wordmark em caixa-alta com entrelinhamento largo (0.16em).
 *
 * O kit proíbe o símbolo em contorno ou chapado em uma cor só, exceto nas
 * versões monocromáticas — daí a prop `mono`.
 */

const RADIUS_RATIO = 0.27;
const GAP_RATIO = 0.27;

export function PitchMark({ size = 26, mono }: { size?: number; mono?: "light" | "dark" }) {
  const background =
    mono === "light" ? "#FFFFFF" : mono === "dark" ? "#1B2559" : "linear-gradient(135deg, #868CFF, #4318FF)";
  const color = mono === "light" ? "#4318FF" : "#FFFFFF";

  return (
    <div
      aria-hidden="true"
      style={{
        width: size,
        height: size,
        borderRadius: size * RADIUS_RATIO,
        background,
        color,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: size * 0.5,
        fontWeight: 700,
        lineHeight: 1,
        letterSpacing: "-0.02em",
        flexShrink: 0,
        userSelect: "none",
      }}
    >
      P
    </div>
  );
}

export function PitchLogo({ size = 26, showWordmark = true }: { size?: number; showWordmark?: boolean }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: size * GAP_RATIO }}>
      <PitchMark size={size} />
      {showWordmark && (
        <span
          style={{
            fontSize: size * 0.5,
            fontWeight: 700,
            letterSpacing: "0.16em",
            color: "#FFFFFF",
            lineHeight: 1,
            whiteSpace: "nowrap",
            userSelect: "none",
          }}
        >
          PITCH STUDIO
        </span>
      )}
    </div>
  );
}
