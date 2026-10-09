/* ============================================================
   A CAMADA DE ÍCONES

   Um arquivo só, com dois trabalhos.

   1. TROCAR A FAMÍLIA. O app inteiro desenhava com o `lucide-react`:
      traço de 1,5px, cantos arredondados, geometria contínua. A família
      agora é pixel — `pixelarticons` (MIT, 1036 desenhos), que é o
      equivalente livre do set pixel do Nucleo: grade de 24×24, tudo em
      `fill="currentColor"`, sem traço nenhum. O nome de cada export aqui
      é o nome que o lucide usava, então a troca em cada tela é uma linha
      de import — e o `git diff` de cada frente continua legível.

   2. NORMALIZAR A API. O lucide aceita `size` e `strokeWidth`; o
      pixelarticons espalha as props direto no `<svg>`. Sem este
      adaptador, `size` viraria um atributo inválido no DOM e
      `strokeWidth` não pintaria nada — desenho preenchido não tem traço.
      Aqui `size` vira `width`/`height` e `strokeWidth` é engolido de
      propósito, para que as ~200 chamadas espalhadas pelo app continuem
      compilando sem edição.

   Onde não havia equivalente exato, a substituição está anotada na
   própria linha. Nenhum desenho foi redesenhado.
   ============================================================ */

import * as React from "react";
import {
  ArrowRight as PxArrowRight,
  Check as PxCheck,
  ChevronDown as PxChevronDown,
  ChevronLeft as PxChevronLeft,
  ChevronRight as PxChevronRight,
  ChevronUp as PxChevronUp,
  CircleQuestion as PxCircleQuestion,
  Clapperboard as PxClapperboard,
  Copy as PxCopy,
  Cpu as PxCpu,
  Fire as PxFire,
  Download as PxDownload,
  Expand as PxExpand,
  Folder as PxFolder,
  FolderPlus as PxFolderPlus,
  GitBranch as PxGitBranch,
  Grid3x3 as PxGrid,
  Image as PxImage,
  Image2Plus as PxImagePlus,
  Images as PxImages,
  Layout as PxLayout,
  Lightbulb as PxLightbulb,
  Message as PxMessage,
  Minus as PxMinus,
  Pencil as PxPencil,
  Plus as PxPlus,
  Power as PxPower,
  Search as PxSearch,
  Shield as PxShield,
  Sparkle as PxSparkle,
  Sparkles as PxSparkles,
  Human as PxHuman,
  Trash as PxTrash,
  Upload as PxUpload,
  Video as PxVideo,
  Wand as PxWand,
  Close as PxClose,
  Pointer as PxPointer,
  Hand as PxHand,
  Box as PxBox,
  Music as PxMusic,
  Keyboard as PxKeyboard,
  Map as PxMap,
  Scissors as PxScissors,
  Frame as PxFrame,
  Undo as PxUndo,
  Redo as PxRedo,
  SettingsCog as PxSettings,
  SlidersHorizontal as PxSliders,
} from "pixelarticons/react";

/** A assinatura que o app já usa, herdada do lucide. */
export interface PropsIcone extends Omit<React.SVGProps<SVGSVGElement>, "ref"> {
  /** Lado do quadrado, em px. O lucide chamava assim; mantido. */
  size?: number | string;
  /** Ignorado: desenho de pixel é preenchido, não tem traço. */
  strokeWidth?: number | string;
}

type Desenho = (props: React.SVGProps<SVGSVGElement>) => React.ReactElement;

function adaptar(Desenho: Desenho, nome: string) {
  /* `strokeWidth` é desestruturado só para NÃO chegar ao `<svg>`: desenho de
     pixel é preenchido, e o atributo ali seria ruído no DOM. */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const Icone = ({ size = 16, strokeWidth, ...resto }: PropsIcone) => (
    <Desenho width={size} height={size} aria-hidden focusable="false" {...resto} />
  );
  Icone.displayName = nome;
  return Icone;
}

/* Os nomes à esquerda são os do lucide, para a troca ser um import. */
export const ArrowRight   = adaptar(PxArrowRight,    "ArrowRight");
export const Check        = adaptar(PxCheck,         "Check");
export const CheckIcon    = Check;
export const ChevronDown  = adaptar(PxChevronDown,   "ChevronDown");
export const ChevronLeft  = adaptar(PxChevronLeft,   "ChevronLeft");
export const ChevronRight = adaptar(PxChevronRight,  "ChevronRight");
export const ChevronRightIcon = ChevronRight;
export const ChevronUp    = adaptar(PxChevronUp,     "ChevronUp");
export const Clapperboard = adaptar(PxClapperboard,  "Clapperboard");
export const Copy         = adaptar(PxCopy,          "Copy");
export const Download     = adaptar(PxDownload,      "Download");
export const Film         = adaptar(PxVideo,         "Film");
export const Folder       = adaptar(PxFolder,        "Folder");
export const FolderPlus   = adaptar(PxFolderPlus,    "FolderPlus");
export const ImageIcon    = adaptar(PxImage,         "ImageIcon");
export const ImagePlus    = adaptar(PxImagePlus,     "ImagePlus");
export const Images       = adaptar(PxImages,        "Images");
export const LayoutGrid   = adaptar(PxGrid,          "LayoutGrid");
export const Lightbulb    = adaptar(PxLightbulb,     "Lightbulb");
export const MessageSquare = adaptar(PxMessage,      "MessageSquare");
export const Minus        = adaptar(PxMinus,         "Minus");
export const Pencil       = adaptar(PxPencil,        "Pencil");
export const Plus         = adaptar(PxPlus,          "Plus");
export const Power        = adaptar(PxPower,         "Power");
export const Search       = adaptar(PxSearch,        "Search");
export const Flame        = adaptar(PxFire,          "Flame");
export const Sparkles     = adaptar(PxSparkles,      "Sparkles");
/* Pessoa de corpo inteiro: é o mais perto de "personagem" que o set pixel tem. */
export const UserRound    = adaptar(PxHuman,         "UserRound");
export const Trash2       = adaptar(PxTrash,         "Trash2");
export const Upload       = adaptar(PxUpload,        "Upload");
export const X            = adaptar(PxClose,         "X");
export const XIcon        = X;

/* Substituições declaradas — não há equivalente de mesmo nome no set. */
/** `Brain` → `cpu`: o set pixel não tem cérebro; a CPU é o desenho que ele usa para "o que pensa". */
export const Brain = adaptar(PxCpu, "Brain");
/** `CircleQuestionMark` → `circle-question`, o mesmo desenho com outro nome. */
export const CircleQuestionMark = adaptar(PxCircleQuestion, "CircleQuestionMark");
/** `Network` → `git-branch`: a leitura de "coisas ligadas" mais próxima no set. */
export const Network = adaptar(PxGitBranch, "Network");
/** `Workflow` → `layout`, o mesmo desenho de blocos encadeados. */
export const Workflow = adaptar(PxLayout, "Workflow");
/** `FolderKanban` → `layout`, pela mesma razão. */
export const FolderKanban = adaptar(PxLayout, "FolderKanban");
/** `Maximize` / `Maximize2` → `expand`; `Minimize2` → o mesmo, girado 180° pelo CSS de quem usa. */
export const Maximize = adaptar(PxExpand, "Maximize");
export const Maximize2 = Maximize;
export const Minimize2 = Maximize;
/** `PanelLeftIcon` → `layout`: é o botão de colapsar a barra. */
export const PanelLeftIcon = adaptar(PxLayout, "PanelLeftIcon");
/** `ShieldAlert` / `ShieldBan` → `shield`; o set não tem as variantes. */
export const ShieldAlert = adaptar(PxShield, "ShieldAlert");
export const ShieldBan = adaptar(PxShield, "ShieldBan");
/** `Wand2` → `wand`. */
export const Wand2 = adaptar(PxWand, "Wand2");
/** `Sparkle` no singular, para quem precisa de um brilho só. */
export const Sparkle = adaptar(PxSparkle, "Sparkle");
/** `Palette` (Estilos) → `image`: o set não tem paleta. */
export const Palette = adaptar(PxImage, "Palette");
/** `Package` (Acervo) → `images`, que é o que o acervo guarda. */
export const Package = adaptar(PxImages, "Package");
/** `MoreHorizontal` → `minus`, o traço horizontal do set. */
export const MoreHorizontal = adaptar(PxMinus, "MoreHorizontal");
/** `Bot` → `cpu`, o mesmo desenho de `Brain`. */
export const Bot = adaptar(PxCpu, "Bot");
/** `FolderOpen` → `folder`; o set não tem a variante aberta. */
export const FolderOpen = adaptar(PxFolder, "FolderOpen");

/* ── Pedidos da frente do canvas (bloco 09) ────────────────────────────────
   O `FRENTES.md` manda pedir em vez de importar `pixelarticons` direto; estes
   seis vieram assim. */
/** `MousePointer2` → `pointer`, a seta de seleção do set. */
export const MousePointer2 = adaptar(PxPointer, "MousePointer2");
/** `Hand` → `hand`, a ferramenta de arrastar o plano. */
export const Hand = adaptar(PxHand, "Hand");
/** `Box` → `box`. */
export const Box = adaptar(PxBox, "Box");
/** `Music` → `music`. */
export const Music = adaptar(PxMusic, "Music");
/** `Keyboard` → `keyboard`, os atalhos do canvas. */
export const Keyboard = adaptar(PxKeyboard, "Keyboard");
/** `Map` → `map`, o minimapa. */
export const Map = adaptar(PxMap, "Map");
/** `Square` → `box`: o set não tem quadrado vazado, e a caixa é o mesmo desenho
    de contorno retangular que a barra usa para "moldura". */
export const Square = adaptar(PxBox, "Square");

/* ── Pedidos da troca de ícones (barra do canvas de workflow) ──────────────── */
/** `Scissors` → `scissors`, a tesoura que corta a aresta. */
export const Scissors = adaptar(PxScissors, "Scissors");
/** `LayoutTemplate` → `frame`, a moldura de agrupar. */
export const LayoutTemplate = adaptar(PxFrame, "LayoutTemplate");
/** `Undo2` / `Redo2` → `undo` / `redo`. */
export const Undo2 = adaptar(PxUndo, "Undo2");
export const Redo2 = adaptar(PxRedo, "Redo2");

/** `Settings` → `settings-cog`, os ajustes do canvas. */
export const Settings = adaptar(PxSettings, "Settings");
/** `SlidersHorizontal` → o mesmo desenho, para as pílulas de parâmetro. */
export const SlidersHorizontal = adaptar(PxSliders, "SlidersHorizontal");
