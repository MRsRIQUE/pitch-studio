export const AVATAR_KIT_VERSION = "1.0";

export type AvatarGroupKey =
  | "genero"
  | "faixa_etaria"
  | "tom_pele"
  | "estilo_cabelo"
  | "cor_cabelo"
  | "formato_rosto"
  | "formato_olhos"
  | "cor_olhos"
  | "nariz"
  | "boca"
  | "queixo"
  | "estrutura_corpo"
  | "traco_unico"
  | "imperfeicoes"
  | "roupa"
  | "enquadramento"
  | "luz";

export type AvatarSelections = Record<AvatarGroupKey, string | string[]>;

export type AvatarOption = {
  value: string;
  label: string;
  fragment: string;
  subtom?: string;
  swatch?: AvatarSwatch;
  thumb?: string;
};

export type AvatarGroup = {
  label: string;
  type: "single" | "multi";
  note?: string;
  options: readonly AvatarOption[];
};

export type AvatarSwatch =
  | { kind: "skin"; light: string; shadow: string }
  | { kind: "hair"; root: string; light: string }
  | { kind: "eye"; iris: string; ring: string };

export const AVATAR_REQUIRED: readonly AvatarGroupKey[] = [
  "genero", "faixa_etaria", "tom_pele", "estilo_cabelo", "cor_cabelo",
  "formato_rosto", "formato_olhos", "cor_olhos", "boca", "estrutura_corpo",
];

export const AVATAR_IDENTITY_KEYS: readonly AvatarGroupKey[] = [
  "genero", "faixa_etaria", "tom_pele", "estilo_cabelo", "cor_cabelo",
  "formato_rosto", "formato_olhos", "cor_olhos", "nariz", "boca", "queixo",
  "estrutura_corpo", "traco_unico", "imperfeicoes",
];

export const AVATAR_GROUPS: Record<AvatarGroupKey, AvatarGroup> = {
  genero: { label: "Gênero", type: "single", options: [
    { value: "feminino", label: "Feminino", fragment: "woman" },
    { value: "masculino", label: "Masculino", fragment: "man" },
  ] },
  faixa_etaria: { label: "Idade", type: "single", options: [
    { value: "18-23", label: "18–23 anos", fragment: "18 to 23 years old, young adult face with fully mature bone structure" },
    { value: "24-29", label: "24–29 anos", fragment: "24 to 29 years old, adult face with settled features" },
    { value: "30-37", label: "30–37 anos", fragment: "30 to 37 years old, first fine lines at the outer corners of the eyes" },
    { value: "38-46", label: "38–46 anos", fragment: "38 to 46 years old, visible nasolabial folds and forehead lines even at rest" },
  ] },
  tom_pele: { label: "Cor da pele", type: "single", options: [
    { value: "clara", label: "Clara", fragment: "fair skin that reddens easily", subtom: "neutral pink" },
    { value: "morena-clara", label: "Morena clara", fragment: "light-medium brown skin", subtom: "warm golden" },
    { value: "morena", label: "Morena", fragment: "medium brown skin", subtom: "olive golden" },
    { value: "parda", label: "Parda", fragment: "medium-deep brown skin", subtom: "warm bronze" },
    { value: "negra", label: "Negra", fragment: "deep brown skin", subtom: "warm reddish" },
    { value: "retinta", label: "Retinta", fragment: "rich dark brown skin", subtom: "cool blue-black" },
  ] },
  estilo_cabelo: { label: "Estilo do cabelo", type: "single", options: [
    { value: "liso-longo", label: "Liso longo", fragment: "long straight hair falling past the shoulders, parted slightly off-center" },
    { value: "ondulado", label: "Ondulado", fragment: "shoulder-length wavy hair with loose S-waves that break irregularly" },
    { value: "cacheado", label: "Cacheado", fragment: "defined springy curls at shoulder length, some frizz at the crown" },
    { value: "crespo", label: "Crespo", fragment: "natural tight coils shaped into a rounded afro, dense and matte" },
    { value: "curto-bob", label: "Curto / bob", fragment: "chin-length blunt bob, tucked behind one ear" },
    { value: "preso-coque", label: "Preso / coque", fragment: "hair pulled back into a low bun with loose strands escaping at the temples" },
    { value: "raspado-lateral", label: "Raspado dos lados", fragment: "short faded sides with more length on top, slightly messy" },
  ] },
  cor_cabelo: { label: "Cor do cabelo", type: "single", options: [
    { value: "preto", label: "Preto", fragment: "black hair with cool blue highlights where the light hits" },
    { value: "castanho-escuro", label: "Castanho escuro", fragment: "dark brown hair, warmer at the ends" },
    { value: "castanho-claro", label: "Castanho claro", fragment: "light brown hair with sun-lifted strands framing the face" },
    { value: "ruivo", label: "Ruivo", fragment: "natural auburn hair that reads copper in direct light" },
    { value: "loiro", label: "Loiro", fragment: "dark blonde hair with grown-out roots" },
    { value: "loiro-claro", label: "Loiro claro", fragment: "light blonde hair, slightly brassy, dry at the ends" },
    { value: "grisalho", label: "Grisalho", fragment: "salt-and-pepper hair, grey concentrated at the temples" },
  ] },
  formato_rosto: { label: "Formato do rosto", type: "single", options: [
    { value: "oval", label: "Oval", fragment: "oval face tapering gently to the chin" },
    { value: "redondo", label: "Redondo", fragment: "round face with full cheeks and a soft jawline" },
    { value: "coracao", label: "Coração", fragment: "heart-shaped face, wide at the temples, narrowing to a pointed chin" },
    { value: "quadrado", label: "Quadrado", fragment: "square face with a broad angular jaw" },
    { value: "alongado", label: "Alongado", fragment: "long narrow face with a high forehead" },
  ] },
  formato_olhos: { label: "Formato dos olhos", type: "single", options: [
    { value: "amendoado", label: "Amendoado", fragment: "almond-shaped eyes" },
    { value: "redondo", label: "Redondo", fragment: "large round eyes with a visible upper lid" },
    { value: "puxado", label: "Puxado", fragment: "upward-tilted eyes with a subtle epicanthic fold" },
    { value: "caido", label: "Caído", fragment: "downturned eyes with a soft hooded lid" },
    { value: "fundo", label: "Fundo", fragment: "deep-set eyes shadowed by a prominent brow bone" },
  ] },
  cor_olhos: { label: "Cor dos olhos", type: "single", options: [
    { value: "castanho-escuro", label: "Castanho escuro", fragment: "very dark brown eyes, iris nearly merging with the pupil" },
    { value: "castanho-mel", label: "Castanho mel", fragment: "honey brown eyes with a lighter ring at the outer iris" },
    { value: "verde", label: "Verde", fragment: "hazel-green eyes flecked with amber" },
    { value: "azul", label: "Azul", fragment: "grey-blue eyes with a darker limbal ring" },
  ] },
  nariz: { label: "Nariz", type: "single", options: [
    { value: "reto", label: "Reto", fragment: "straight nose with a narrow bridge" },
    { value: "arrebitado", label: "Arrebitado", fragment: "slightly upturned nose with a soft tip" },
    { value: "largo", label: "Largo", fragment: "broad nose with a rounded tip and wide nostrils" },
    { value: "aquilino", label: "Aquilino", fragment: "aquiline nose with a pronounced bridge" },
    { value: "botao", label: "Pequeno", fragment: "small button nose, short from bridge to tip" },
  ] },
  boca: { label: "Boca", type: "single", options: [
    { value: "fina", label: "Fina", fragment: "thin lips with a barely defined cupid's bow" },
    { value: "media", label: "Média", fragment: "medium lips, the upper slightly thinner than the lower" },
    { value: "carnuda", label: "Carnuda", fragment: "full lips with natural vertical texture" },
    { value: "arco-marcado", label: "Arco marcado", fragment: "sharply defined cupid's bow with a full centre" },
  ] },
  queixo: { label: "Queixo e mandíbula", type: "single", options: [
    { value: "arredondado", label: "Arredondado", fragment: "rounded chin with a soft jaw" },
    { value: "marcado", label: "Marcado", fragment: "strong squared chin with a defined jawline" },
    { value: "pontudo", label: "Pontudo", fragment: "narrow pointed chin" },
    { value: "recuado", label: "Recuado", fragment: "slightly receding chin" },
  ] },
  estrutura_corpo: { label: "Estrutura do corpo", type: "single", options: [
    { value: "magra", label: "Magra", fragment: "slim build, narrow shoulders, visible collarbones" },
    { value: "media", label: "Média", fragment: "average build with a soft midsection" },
    { value: "atletica", label: "Atlética", fragment: "athletic build with defined shoulders and arms" },
    { value: "curvilinea", label: "Curvilínea", fragment: "curvy build, full hips and bust, defined waist" },
    { value: "plus-size", label: "Plus size", fragment: "plus-size build with full arms and soft rounded shoulders" },
  ] },
  traco_unico: { label: "Traço único do rosto", type: "single", note: "Escolha um só. Ele será o marcador de identidade entre as gerações.", options: [
    { value: "macas-altas", label: "Maçãs do rosto altas", fragment: "high prominent cheekbones that cast a slight shadow" },
    { value: "covinhas", label: "Covinhas", fragment: "deep dimples that appear when smiling" },
    { value: "sobrancelha-grossa", label: "Sobrancelha grossa", fragment: "thick natural eyebrows, untrimmed at the edges" },
    { value: "dentes-tortos", label: "Dentes levemente tortos", fragment: "slightly crowded front teeth with one incisor rotated" },
    { value: "diastema", label: "Falha entre os dentes", fragment: "a small gap between the two front teeth" },
    { value: "sinal-rosto", label: "Sinal no rosto", fragment: "a distinct beauty mark above the lip on one side" },
    { value: "olhos-fundos", label: "Olhar profundo", fragment: "deeply set eyes under a heavy brow, giving an intense resting expression" },
    { value: "sorriso-torto", label: "Sorriso torto", fragment: "an asymmetric smile that lifts higher on one side" },
  ] },
  imperfeicoes: { label: "Imperfeições", type: "multi", note: "Escolha até 3 detalhes para manter o resultado natural.", options: [
    { value: "olheiras", label: "Olheiras", fragment: "natural under-eye circles, slightly darker and a little puffy" },
    { value: "acne-leve", label: "Acne leve", fragment: "a few active blemishes on the chin and forehead" },
    { value: "marcas-acne", label: "Marcas de acne", fragment: "faded acne scarring across the cheeks, shallow and uneven" },
    { value: "sardas", label: "Sardas", fragment: "freckles scattered across the nose bridge and upper cheeks" },
    { value: "pintas", label: "Pintas", fragment: "two or three small moles on the face and neck" },
    { value: "poros-visiveis", label: "Poros visíveis", fragment: "clearly visible pores on the nose and inner cheeks" },
    { value: "pele-oleosa", label: "Pele oleosa", fragment: "natural oil shine on the forehead and nose, not powdered down" },
    { value: "linhas-expressao", label: "Linhas de expressão", fragment: "fine expression lines at the outer corners of the eyes" },
    { value: "sobrancelha-falha", label: "Falha na sobrancelha", fragment: "a small gap in one eyebrow where the hair grows thinner" },
    { value: "labios-ressecados", label: "Lábios ressecados", fragment: "slightly dry lips with visible texture, no gloss" },
  ] },
  roupa: { label: "Roupa", type: "single", options: [
    { value: "camiseta-basica", label: "Camiseta básica", fragment: "a plain cotton t-shirt, softened by washing" },
    { value: "cropped", label: "Cropped", fragment: "a fitted cropped top in a solid colour" },
    { value: "vestido-leve", label: "Vestido leve", fragment: "a light summer dress in a small print" },
    { value: "camisa-social", label: "Camisa social", fragment: "a button-down shirt with the top button open and sleeves rolled" },
    { value: "moletom", label: "Moletom", fragment: "an oversized hoodie, slightly pilled at the cuffs" },
    { value: "look-academia", label: "Look academia", fragment: "a matching activewear set, fabric slightly compressed at the waist" },
    { value: "conjunto-praia", label: "Saída de praia", fragment: "a beach cover-up over swimwear, fabric moving loosely" },
  ] },
  enquadramento: { label: "Enquadramento", type: "single", options: [
    { value: "retrato-closeup", label: "Close no rosto", fragment: "tight head-and-shoulders portrait, top of the head near the frame edge" },
    { value: "meio-corpo", label: "Meio corpo", fragment: "waist-up framing with the subject slightly off-centre" },
    { value: "meio-corpo-34", label: "Meio corpo 3/4", fragment: "three-quarter turn, waist-up, eyes back to the lens" },
    { value: "corpo-inteiro-espelho", label: "Corpo inteiro no espelho", fragment: "full-body mirror selfie, phone visible in hand, reflection slightly off-square" },
    { value: "corpo-inteiro", label: "Corpo inteiro", fragment: "full-body shot from a step back, feet inside the frame" },
  ] },
  luz: { label: "Luz", type: "single", options: [
    { value: "janela-nublado", label: "Janela em dia nublado", fragment: "flat diffused daylight from a large window on an overcast day" },
    { value: "sol-tarde", label: "Sol de fim de tarde", fragment: "low golden afternoon sun raking across one side of the face" },
    { value: "teto-quente", label: "Luz de teto à noite", fragment: "warm ceiling light at night, falling from above and leaving the eyes shadowed" },
    { value: "banheiro-frio", label: "Banheiro, luz fria", fragment: "cool white bathroom light bouncing off tile, unflattering and even" },
    { value: "varanda-sombra", label: "Sombra na varanda", fragment: "open shade on a balcony, soft light with a cool blue cast from the sky" },
    { value: "luz-tela", label: "Luz da tela", fragment: "the face lit mainly by a phone screen from below, faint colour cast" },
  ] },
};

export const AVATAR_SWATCHES: Partial<Record<AvatarGroupKey, Record<string, AvatarSwatch>>> = {
  tom_pele: {
    clara: { kind: "skin", light: "#F3DCCB", shadow: "#DCB097" },
    "morena-clara": { kind: "skin", light: "#E6C09B", shadow: "#C79366" },
    morena: { kind: "skin", light: "#CB9366", shadow: "#A96E44" },
    parda: { kind: "skin", light: "#AD6F45", shadow: "#875030" },
    negra: { kind: "skin", light: "#7D4E2E", shadow: "#57321C" },
    retinta: { kind: "skin", light: "#4E2E1C", shadow: "#30180D" },
  },
  cor_cabelo: {
    "castanho-escuro": { kind: "hair", root: "#241309", light: "#4B2E1C" },
    "castanho-claro": { kind: "hair", root: "#4B3018", light: "#8A5C36" },
    preto: { kind: "hair", root: "#0E0D0D", light: "#2E3440" },
    ruivo: { kind: "hair", root: "#6B2A14", light: "#B55A2C" },
    loiro: { kind: "hair", root: "#5E4526", light: "#B08B49" },
    "loiro-claro": { kind: "hair", root: "#A98B52", light: "#E3CA92" },
    grisalho: { kind: "hair", root: "#5E5B59", light: "#D8D5D2" },
  },
  cor_olhos: {
    "castanho-escuro": { kind: "eye", iris: "#3A2317", ring: "#20130B" },
    "castanho-mel": { kind: "eye", iris: "#9A6428", ring: "#5E3A17" },
    verde: { kind: "eye", iris: "#6E7C46", ring: "#3E4728" },
    azul: { kind: "eye", iris: "#7A8C9E", ring: "#465563" },
  },
};

export const AVATAR_THUMB_GROUPS: readonly AvatarGroupKey[] = [
  "estilo_cabelo", "formato_rosto", "formato_olhos", "nariz", "boca", "queixo", "traco_unico",
];

export function avatarOptionVisual(groupKey: AvatarGroupKey, value: string): { swatch?: AvatarSwatch; thumb?: string } {
  const swatch = AVATAR_SWATCHES[groupKey]?.[value];
  if (swatch) return { swatch };
  if (AVATAR_THUMB_GROUPS.includes(groupKey)) return { thumb: `/avatar-thumbs/${groupKey}__${value}.webp` };
  return {};
}

// Apply the visual patch by group + option value so all consumers see the
// enriched option directly, while the prompt fragments remain unchanged.
for (const groupKey of Object.keys(AVATAR_GROUPS) as AvatarGroupKey[]) {
  for (const option of AVATAR_GROUPS[groupKey].options) {
    Object.assign(option, avatarOptionVisual(groupKey, option.value));
  }
}

export const AVATAR_FIELD_SECTIONS: ReadonlyArray<{ title: string; description: string; keys: readonly AvatarGroupKey[] }> = [
  { title: "Base", description: "Características gerais da pessoa.", keys: ["genero", "faixa_etaria", "tom_pele", "estrutura_corpo"] },
  { title: "Rosto", description: "Traços que formam a identidade visual.", keys: ["formato_rosto", "formato_olhos", "cor_olhos", "nariz", "boca", "queixo", "traco_unico"] },
  { title: "Cabelo e pele", description: "Textura, cor e detalhes naturais.", keys: ["estilo_cabelo", "cor_cabelo", "imperfeicoes"] },
  { title: "Retrato", description: "Itens que podem mudar nas próximas cenas.", keys: ["roupa", "enquadramento", "luz"] },
];

export const AVATAR_QUALITY_CHECKLIST = [
  "Se o rosto sair simétrico demais, reforce a assimetria antes de mudar outros detalhes.",
  "Se o resultado parecer um render 3D, revise primeiro a câmera.",
  "Para manter o rosto, reutilize o IDENTITY LOCK literal com a imagem de referência.",
  "Use no máximo três imperfeições para evitar exageros.",
  "Escolha somente um traço único para preservar a consistência.",
] as const;

export function createEmptyAvatarSelections(): AvatarSelections {
  return Object.fromEntries(
    (Object.keys(AVATAR_GROUPS) as AvatarGroupKey[]).map((key) => [key, AVATAR_GROUPS[key].type === "multi" ? [] : ""]),
  ) as AvatarSelections;
}

function selectedOption(selections: AvatarSelections, key: AvatarGroupKey): AvatarOption | undefined {
  const value = selections[key];
  if (Array.isArray(value)) return undefined;
  return AVATAR_GROUPS[key].options.find((option) => option.value === value);
}

function fragment(selections: AvatarSelections, key: AvatarGroupKey): string {
  return selectedOption(selections, key)?.fragment ?? "";
}

export function missingAvatarFields(selections: AvatarSelections): AvatarGroupKey[] {
  return AVATAR_REQUIRED.filter((key) => !fragment(selections, key));
}

export function buildIdentityLock(selections: AvatarSelections): string {
  const lines = [
    "## IDENTITY LOCK",
    `- Face shape: ${fragment(selections, "formato_rosto")}.`,
    `- Eyes: ${fragment(selections, "formato_olhos")}, ${fragment(selections, "cor_olhos")}.`,
    `- Nose: ${fragment(selections, "nariz")}.`,
    `- Mouth: ${fragment(selections, "boca")}.`,
    `- Chin and jaw: ${fragment(selections, "queixo")}.`,
    `- Signature trait: ${fragment(selections, "traco_unico")} - this trait must be visible in every render of this character.`,
    `- Build: ${fragment(selections, "estrutura_corpo")}.`,
  ];
  const optionalByPrefix = new Map([
    ["- Nose:", "nariz"], ["- Chin and jaw:", "queixo"], ["- Signature trait:", "traco_unico"],
  ] as const);
  return lines.filter((line) => {
    const match = [...optionalByPrefix].find(([prefix]) => line.startsWith(prefix));
    return !match || Boolean(fragment(selections, match[1]));
  }).join("\n");
}

export function buildAvatarPrompt(selections: AvatarSelections): { prompt: string; identityLock: string; missing: AvatarGroupKey[] } {
  const skin = selectedOption(selections, "tom_pele");
  const imperfections = Array.isArray(selections.imperfeicoes)
    ? selections.imperfeicoes.slice(0, 3).map((value) => AVATAR_GROUPS.imperfeicoes.options.find((option) => option.value === value)?.fragment).filter(Boolean).map((value) => `- ${value}`).join("\n")
    : "";
  const identityLock = buildIdentityLock(selections);
  const optionalLine = (prefix: string, value: string, suffix = ".") => value ? `${prefix}${value}${suffix}` : "";
  const prompt = [
    `Ultra-realistic amateur photograph of a ${fragment(selections, "genero")} Brazilian person, ${fragment(selections, "faixa_etaria")}.`,
    "Everyday Brazilian features - NOT an international fashion model, NOT a stock photo face.",
    "",
    identityLock,
    "",
    "## SKIN",
    skin ? `- Tone: ${skin.fragment}, ${skin.subtom} undertone.` : "",
    "- Real texture: visible pores on the nose and cheeks, fine vellus hair along the jawline, uneven tone, slight redness around the nostrils and chin.",
    imperfections,
    "- Clear facial asymmetry: one eye marginally higher than the other, eyebrows that do not match.",
    "",
    "## HAIR",
    fragment(selections, "estilo_cabelo") && fragment(selections, "cor_cabelo") ? `- ${fragment(selections, "estilo_cabelo")}, ${fragment(selections, "cor_cabelo")}.` : "",
    "- Individual strands separate, a few flyaways catching the light, natural hairline with baby hairs, roots slightly darker than the lengths.",
    "",
    "## WARDROBE",
    optionalLine("- ", fragment(selections, "roupa"), " - worn, not styled. Fabric shows real drape and minor creasing."),
    "",
    "## CAMERA",
    "- Shot on a modern smartphone front camera, 26mm equivalent, f/1.8.",
    "- Eye-level, subject at arm's length. Slight barrel distortion near the frame edge.",
    "- Focus on the eyes; shallow but imperfect depth of field.",
    optionalLine("- Framing: ", fragment(selections, "enquadramento")),
    "",
    "## LIGHTING",
    optionalLine("- ", fragment(selections, "luz"), " - mixed color temperature, one dominant source plus spill."),
    "- Visible catchlight in both eyes. Soft shadow under the nose and jaw.",
    "- Mild sensor noise in the shadows. No studio lighting, no ring light halo.",
    "",
    "## NEGATIVE",
    "No beauty filter, no skin smoothing, no airbrushing, no plastic skin, no waxy highlights.",
    "No symmetrical face, no perfect teeth, no CGI look, no 3D render, no illustration.",
    "No watermark, no text, no extra fingers, no distorted hands.",
  ].filter((line, index, all) => line !== "" || (index > 0 && all[index - 1] !== "")).join("\n").trim();
  return { prompt, identityLock, missing: missingAvatarFields(selections) };
}

export function describeAvatar(selections: AvatarSelections): string {
  const keys: AvatarGroupKey[] = ["genero", "faixa_etaria", "tom_pele", "estilo_cabelo", "cor_cabelo", "traco_unico"];
  return keys.map((key) => selectedOption(selections, key)?.label).filter(Boolean).join(", ");
}
