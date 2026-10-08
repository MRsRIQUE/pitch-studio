"use client";

/* ============================================================
   BLOCO 04, PARTE 1 — A LINHA DE ESPECIALISTAS

   A faixa cinza de 996×44 com quatro pílulas e o `Mais →`. A referência
   chama isso de "skills recomendadas"; do nosso lado são os estilos —
   fragmentos de prompt que fixam a direção de arte.

   O mecanismo é copiado inteiro do bundle da referência (`jn`/`Br`/`Rr`/`Ar`):

   - a lista vem de UMA fonte carregada uma vez, e a aba de categoria só
     filtra em memória. Trocar de aba não faz requisição nenhuma;
   - a linha corta em quatro (`Re = 4`), sempre;
   - a escada de entrada é 100% CSS: os atrasos de 0/40/80/120/160ms moram
     no `nth-child`, e o gatilho é a `key` da lista — trocar de aba remonta
     os cinco filhos e a animação roda de novo;
   - o cartão de hover de 280×196 é um portal em `document.body` com um
     positioner `fixed` que só carrega o `translate3d`.

   O que muda em relação à referência é só o dado: onde ela mostra a skill
   dela, mostramos o nosso estilo real, com a miniatura da última geração que
   o usou de verdade.
   ============================================================ */

import * as React from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { ArrowRight, Sparkles } from "@/components/icones";

import { useEstilosStore } from "@/lib/estilosStore";
import { applyFragmentToComposer } from "@/lib/remixHandoff";
import { thumbSrc, type GalleryItem } from "@/lib/galleryUtils";
import { assinarCategoria, lerCategoria } from "@/lib/categoriaComposer";

import "./destaque.css";

/* ------------------------------------------------------------
   As constantes do bundle, com a letra original ao lado.
   ------------------------------------------------------------ */
const MAX_PILULAS = 4;   /* Re — a linha NUNCA passa de quatro */
const ABRIR_MS    = 120; /* Tr — atraso da primeira abertura do cartão */
const FECHAR_MS   = 120; /* Lr — espera antes de desmontar, depois do fade */
const CARTAO_W    = 280; /* Dr */
const CARTAO_H    = 196; /* Mr */
const FOLGA       = 8;   /* Or — vão entre a pílula e o cartão */
const BORDA       = 8;   /* le — margem mínima até a borda da janela */

/* ------------------------------------------------------------
   A CATEGORIA VINDA DAS ABAS DO COMPOSER

   As abas são do bloco 03 (outra frente). O canal é `lib/categoriaComposer.ts`,
   que existe em `lib/` justamente para ter dois leitores em frentes
   diferentes — as abas escrevem, esta linha lê — sem que um arquivo importe
   o outro. Antes desta montagem cada lado tinha inventado o seu nome de
   evento (`pitch:home-categoria` aqui, `pitch-categoria-composer` lá) e um
   formato de `detail` diferente: as duas metades nunca se falariam.

   `null` é o estado inicial da referência (nenhuma aba ativa); a linha
   mostra a lista de marca nesse caso, porque ela sempre mostra alguma coisa.
   ------------------------------------------------------------ */
export type CategoriaHome = "marca" | "video" | "produto" | "social" | "web";

function categoriaGuardada(): CategoriaHome {
  return lerCategoria() ?? "marca";
}

/* ------------------------------------------------------------
   OS ESTILOS RECOMENDADOS, POR CATEGORIA

   A referência carrega isto de `GET /api/ai/skills/personal/all` e filtra por
   `recommendation.category`. Do nosso lado a lista é local — os estilos moram
   no navegador, não em servidor nenhum —, então o "carregamento" é a
   hidratação do store e o filtro é o mesmo `filter` em memória.

   Seis destes ids são os mesmos de `components/estilos/sugestoes.ts`, de
   propósito: `addFromSuggestion` deduplica por `suggestionId`, e um estilo
   adicionado pela Home tem que ser reconhecido como o mesmo lá. O texto está
   repetido em vez de importado porque aquele arquivo é de outra frente e o
   aviso de aterrissagem ainda não veio — unificar os dois é tarefa de depois.
   ------------------------------------------------------------ */
interface EstiloRecomendado {
  id: string;
  nome: string;
  fragmento: string;
  categorias: readonly CategoriaHome[];
}

const RECOMENDADOS: readonly EstiloRecomendado[] = [
  {
    id: "minimalismo",
    nome: "Minimalismo de marca",
    categorias: ["marca"],
    fragmento:
      "Composição minimalista de marca, muito espaço negativo, um único elemento em foco, paleta monocromática, iluminação plana e uniforme, acabamento fosco, sem adornos.",
  },
  {
    id: "editorial",
    nome: "Fotografia editorial",
    categorias: ["marca", "produto"],
    fragmento:
      "Fotografia editorial, luz natural difusa vinda da lateral, sombras suaves e longas, paleta neutra e quente, grão fino de filme, profundidade de campo rasa, composição limpa com bastante espaço negativo.",
  },
  {
    id: "render",
    nome: "3D suave",
    categorias: ["marca", "produto", "web"],
    fragmento:
      "Render 3D com materiais foscos, iluminação global suave, sombras difusas e longas, paleta pastel, cantos arredondados, fundo em cor sólida, sem reflexos especulares fortes.",
  },
  {
    id: "ilustracao",
    nome: "Ilustração editorial",
    categorias: ["marca", "social"],
    fragmento:
      "Ilustração editorial em vetor, formas geométricas simplificadas, paleta de três cores, textura granulada leve, sem contorno preto, composição centrada e simétrica.",
  },
  {
    id: "cinema",
    nome: "Cinematográfico noturno",
    categorias: ["video", "social"],
    fragmento:
      "Enquadramento cinematográfico noturno, hora azul, luzes práticas quentes ao fundo, contraste alto, halação sutil nas fontes de luz, textura de filme 35mm, proporção anamórfica.",
  },
  {
    id: "produto",
    nome: "Produto em estúdio",
    categorias: ["produto"],
    fragmento:
      "Still de produto em estúdio, fundo infinito claro, luz principal difusa a 45°, preenchimento suave do lado oposto, reflexos controlados, nitidez em toda a peça, sombra de contato bem definida.",
  },
  {
    id: "documental",
    nome: "Documental em movimento",
    categorias: ["video"],
    fragmento:
      "Registro documental, câmera na mão com deriva leve, luz disponível sem rebatedor, cor neutra e levemente dessaturada, foco seguindo o assunto, enquadramento aberto com respiro nas bordas.",
  },
  {
    id: "stopmotion",
    nome: "Stop motion",
    categorias: ["video"],
    fragmento:
      "Animação em stop motion, materiais táteis de feltro e massa, marcas de manipulação visíveis, iluminação de mesa com sombra dura, cadência de doze quadros por segundo, fundo em cartão liso.",
  },
  {
    id: "retrato",
    nome: "Retrato de estúdio",
    categorias: ["video", "social"],
    fragmento:
      "Retrato em estúdio, luz principal suave em janela grande a 45°, recorte discreto atrás do ombro, fundo em degradê escuro, pele com textura preservada, teleobjetiva com fundo desfocado.",
  },
  {
    id: "packshot",
    nome: "Packshot em fundo infinito",
    categorias: ["produto"],
    fragmento:
      "Packshot em fundo infinito branco, produto centralizado, iluminação em caixa de luz sem sombras duras, arestas nítidas, sem elementos de cena, espaço uniforme em todas as margens.",
  },
  {
    id: "lifestyle",
    nome: "Lifestyle de produto",
    categorias: ["produto", "social"],
    fragmento:
      "Produto em cena de uso cotidiano, luz de fim de tarde entrando pela janela, superfícies naturais de madeira e linho, mãos em enquadramento parcial, profundidade rasa, clima acolhedor.",
  },
  {
    id: "vertical",
    nome: "Vertical para feed",
    categorias: ["social"],
    fragmento:
      "Enquadramento vertical 9:16, assunto no terço superior, muito contraste de cor, fundo simples que não disputa atenção, espaço livre embaixo para legenda, leitura imediata em tela pequena.",
  },
  {
    id: "interface",
    nome: "Interface limpa",
    categorias: ["web"],
    fragmento:
      "Interface de produto limpa, grade de oito pontos, tipografia sem serifa em duas escalas, superfícies claras com sombra sutil, um único tom de destaque, sem gradiente decorativo.",
  },
  {
    id: "painel",
    nome: "Painel de dados",
    categorias: ["web"],
    fragmento:
      "Painel de dados, cartões alinhados em grade, gráficos de linha e barra em paleta contida, rótulos pequenos e legíveis, fundo neutro claro, hierarquia clara entre número e legenda.",
  },
  {
    id: "heroi",
    nome: "Herói de landing",
    categorias: ["web"],
    fragmento:
      "Cena de abertura de landing page, produto em perspectiva leve sobre fundo em degradê suave, luz vinda de cima à esquerda, reflexo discreto no piso, muito espaço para o título à esquerda.",
  },
];

/* ------------------------------------------------------------
   O item já montado para a linha — o equivalente do `Cn(skill, lang)`.
   ------------------------------------------------------------ */
interface ItemLinha {
  id: string;
  nome: string;
  fragmento: string;
  /** Miniatura da última geração cujo prompt contém o fragmento. */
  decoracao: string | null;
  /** O estilo já está na biblioteca do usuário. */
  naBiblioteca: boolean;
}

/* A pílula da categoria "video" leva o fragmento para a aba de vídeo do
   composer; todo o resto vai para a de imagem. */
function abaDoComposer(categoria: CategoriaHome): "images" | "videos" {
  return categoria === "video" ? "videos" : "images";
}

/** Normaliza para comparar prompt com fragmento sem tropeçar em espaço. */
function normalizar(texto: string): string {
  return texto.toLowerCase().replace(/\s+/g, " ").trim();
}

export function EstilosSugeridos() {
  const router = useRouter();
  const estilos = useEstilosStore(estado => estado.estilos);
  const markApplied = useEstilosStore(estado => estado.markApplied);

  /* O store é `persist`: no servidor nasce vazio e no cliente vem cheio.
     Enquanto a hidratação não termina, a linha mostra o esqueleto — o mesmo
     estado de carregamento que a referência desenha. */
  const hidratado = React.useSyncExternalStore(
    React.useCallback((avisar: () => void) => useEstilosStore.persist.onFinishHydration(avisar), []),
    () => useEstilosStore.persist.hasHydrated(),
    () => false,
  );

  /* Ler a chave já no inicializador é seguro porque o primeiro render do
     cliente ainda é o esqueleto: `hidratado` só vira true depois dele. */
  const [categoria, setCategoria] = React.useState<CategoriaHome>(categoriaGuardada);
  const [selecionado, setSelecionado] = React.useState<string | null>(null);
  const [galeria, setGaleria] = React.useState<GalleryItem[]>([]);

  /* As abas do composer avisam por evento; a chave cobre o caso de a Home
     montar depois de a aba já ter sido escolhida. */
  React.useEffect(() => {
    return assinarCategoria(() => {
      setCategoria(lerCategoria() ?? "marca");
      setSelecionado(null);
    });
  }, []);

  /* Uma requisição só, no mount — como o `getRecommended("home_list")` da
     referência. Serve para achar a miniatura de cada estilo. */
  React.useEffect(() => {
    let vivo = true;
    fetch("/api/gallery?type=image&page=0")
      .then(resposta => (resposta.ok ? resposta.json() : { items: [] }))
      .then((dados: { items?: GalleryItem[] }) => {
        if (vivo) setGaleria(dados.items ?? []);
      })
      .catch(() => { /* sem galeria a linha continua: a pílula cai no ícone mono */ });
    return () => { vivo = false };
  }, []);

  const itens = React.useMemo<ItemLinha[]>(() => {
    const porSugestao = new Map(
      estilos.filter(estilo => estilo.suggestionId).map(estilo => [estilo.suggestionId as string, estilo]),
    );

    return RECOMENDADOS
      .filter(recomendado => recomendado.categorias.includes(categoria))
      .slice(0, MAX_PILULAS)
      .map(recomendado => {
        /* Se o usuário já adicionou este estilo e editou o texto, é o texto
           DELE que aparece — o nosso é só o ponto de partida. */
        const meu = porSugestao.get(recomendado.id);
        const nome = meu?.name ?? recomendado.nome;
        const fragmento = meu?.fragment ?? recomendado.fragmento;

        const alvo = normalizar(fragmento);
        const usada = galeria.find(item => item.prompt && normalizar(item.prompt).includes(alvo));

        return {
          id: recomendado.id,
          nome,
          fragmento,
          decoracao: usada ? thumbSrc(usada.url, 59) : null,
          naBiblioteca: Boolean(meu),
        };
      });
  }, [categoria, estilos, galeria]);

  const aplicar = React.useCallback(
    (item: ItemLinha) => {
      setSelecionado(atual => (atual === item.id ? null : item.id));
      const destino = applyFragmentToComposer(item.fragmento, abaDoComposer(categoria));
      if (!destino) return;
      if (item.naBiblioteca) markApplied(item.id);
      router.push(destino);
    },
    [categoria, markApplied, router],
  );

  const cartao = useCartaoDeHover();

  if (!hidratado) {
    return (
      <section className="pe-row" aria-hidden="true">
        <div className="pe-row__list">
          {Array.from({ length: MAX_PILULAS }).map((_, indice) => (
            <div key={indice} className="pe-pill-skeleton" />
          ))}
          <div className="pe-more-skeleton" />
        </div>
      </section>
    );
  }

  /* Sem estilos, a linha SOME — não vira faixa cinza vazia. */
  if (itens.length === 0) return null;

  return (
    <section className="pe-row" aria-label="Estilos sugeridos">
      {/* Esta `key` é o gatilho da escada: trocar de aba troca a lista de
          nomes, o React remonta os cinco filhos e o `nth-child` do CSS roda
          a animação de novo. */}
      <div
        key={itens.map(item => item.id).join("|")}
        className="pe-row__list"
        onMouseLeave={cartao.fechar}
      >
        {itens.map(item => (
          <button
            key={item.id}
            type="button"
            className={`pe-pill${selecionado === item.id ? " is-selected" : ""}`}
            onClick={() => aplicar(item)}
            onMouseEnter={evento => cartao.abrir(item, evento.currentTarget, false)}
            onMouseLeave={cartao.saidaPendente}
            onFocus={evento => cartao.abrir(item, evento.currentTarget, true)}
            onBlur={cartao.fechar}
            onKeyDown={evento => {
              if (evento.key === "Escape") {
                evento.preventDefault();
                cartao.fechar();
              }
            }}
          >
            <span className="pe-pill__icon" aria-hidden="true">
              {item.decoracao ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img alt="" className="pe-pill__decoration" src={item.decoracao} />
              ) : (
                <Sparkles className="pe-pill__mono" size={16} strokeWidth={1.3} />
              )}
            </span>
            <span className="pe-pill__label">{item.nome}</span>
          </button>
        ))}

        <button
          type="button"
          className="pe-more"
          onClick={() => router.push("/estilos")}
          /* Passar o mouse no "Mais" fecha o cartão — é assim na referência. */
          onMouseEnter={cartao.fechar}
          onFocus={cartao.fechar}
        >
          <span className="pe-more__label">Mais</span>
          <ArrowRight className="pe-more__icon" aria-hidden="true" />
        </button>
      </div>

      {cartao.portal}
    </section>
  );
}

/* ============================================================
   O CARTÃO DE HOVER

   Máquina de três fases, igual à do bundle:

   - primeira abertura espera 120ms, monta invisível e só vira visível um
     `requestAnimationFrame` depois — é esse frame que dá ao navegador a
     chance de animar opacidade e transform;
   - com o cartão já aberto, pular para outra pílula é imediato: ele não
     pisca, só desliza, porque quem anima aí é o `transition: transform` do
     positioner;
   - sair de UMA pílula não fecha nada, só cancela a abertura pendente. Quem
     fecha é o `mouseleave` da lista inteira, o hover no "Mais" ou o Escape;
   - fechar tira o `is-visible` (roda o fade de saída) e só desmonta 120ms
     depois.
   ============================================================ */

interface EstadoCartao {
  item: ItemLinha;
  x: number;
  y: number;
}

function posicionar(ancora: HTMLElement): { x: number; y: number } {
  const caixa = ancora.getBoundingClientRect();
  const maxX = Math.max(BORDA, window.innerWidth - CARTAO_W - BORDA);
  return {
    x: Math.min(Math.max(caixa.left, BORDA), maxX),   /* grudado à esquerda da pílula */
    y: Math.max(BORDA, caixa.top - FOLGA - CARTAO_H), /* 8px acima dela */
  };
}

function useCartaoDeHover() {
  /* Não há guarda de montagem: `estado` só deixa de ser nulo dentro de um
     `mouseenter`/`focus`, então o portal nunca é avaliado no servidor. */
  const [estado, setEstado] = React.useState<EstadoCartao | null>(null);
  const [visivel, setVisivel] = React.useState(false);

  const timerAbrir = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const timerFechar = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const ficha = React.useRef(0);
  const visivelRef = React.useRef(false);

  React.useEffect(() => { visivelRef.current = visivel }, [visivel]);

  const limpar = React.useCallback(() => {
    if (timerAbrir.current) clearTimeout(timerAbrir.current);
    if (timerFechar.current) clearTimeout(timerFechar.current);
    timerAbrir.current = null;
    timerFechar.current = null;
  }, []);

  const fechar = React.useCallback(() => {
    ficha.current += 1;
    limpar();
    if (!visivelRef.current && !estado) return;
    setVisivel(false);
    timerFechar.current = setTimeout(() => setEstado(null), FECHAR_MS);
  }, [estado, limpar]);

  const abrir = React.useCallback(
    (item: ItemLinha, ancora: HTMLElement, imediato: boolean) => {
      const minha = ++ficha.current;
      limpar();

      const mostrar = (jaVisivel: boolean) => {
        if (minha !== ficha.current) return;
        setEstado({ item, ...posicionar(ancora) });
        if (jaVisivel) return;
        setVisivel(false);
        requestAnimationFrame(() => {
          if (minha === ficha.current) setVisivel(true);
        });
      };

      if (visivelRef.current) { mostrar(true); return }
      if (imediato) { mostrar(false); return }
      timerAbrir.current = setTimeout(() => mostrar(false), ABRIR_MS);
    },
    [limpar],
  );

  /* Sair de uma pílula só cancela a abertura pendente. */
  const saidaPendente = React.useCallback(() => {
    if (!visivelRef.current) {
      ficha.current += 1;
      limpar();
    }
  }, [limpar]);

  React.useEffect(() => {
    const aoRolar = () => fechar();
    window.addEventListener("scroll", aoRolar, true);
    return () => window.removeEventListener("scroll", aoRolar, true);
  }, [fechar]);

  React.useEffect(() => limpar, [limpar]);

  const portal =
    estado
      ? createPortal(
          <div
            className="pe-hover-positioner"
            style={{ transform: `translate3d(${estado.x}px, ${estado.y}px, 0)` }}
          >
            <div className={`pe-hover-card${visivel ? " is-visible" : ""}`} role="tooltip">
              <div className="pe-hover-card__media">
                <Vitral />
                {estado.item.decoracao ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    className="pe-hover-card__media-asset"
                    alt=""
                    aria-hidden="true"
                    src={estado.item.decoracao}
                  />
                ) : null}
              </div>
              <div className="pe-hover-card__info">
                <p className="pe-hover-card__title">{estado.item.nome}</p>
                <p className="pe-hover-card__desc">{estado.item.fragmento}</p>
              </div>
            </div>
          </div>,
          document.body,
        )
      : null;

  return { abrir, fechar, saidaPendente, portal };
}

/* As seis elipses borradas que a referência entrega como data-URI no
   `background` do `__media`. Vieram para cá como elemento porque data-URI não
   aceita `var()` — e sem `var()` a elipse laranja da referência entraria
   cravada no nosso CSS. As cores estão em `destaque.css`. */
function Vitral() {
  return (
    <svg
      className="pe-hover-card__vitral"
      viewBox="0 0 194 174"
      fill="none"
      preserveAspectRatio="xMidYMid slice"
      aria-hidden="true"
    >
      <g opacity="0.3" filter="url(#pe-vitral-blur)">
        <ellipse cx="46.7193" cy="70.9952" rx="32.7193" ry="37.9544" fill="var(--pe-vitral-1)" />
        <ellipse cx="87.1236" cy="20.6834" rx="32.7193" ry="37.9544" fill="var(--pe-vitral-2)" />
        <ellipse cx="111.588" cy="95.4001" rx="40.0622" ry="38.2634" fill="var(--pe-vitral-3)" />
        <ellipse cx="134.872" cy="42.7058" rx="40.0622" ry="38.2634" fill="var(--pe-vitral-4)" />
        <ellipse cx="86.9537" cy="23.2811" rx="32.7193" ry="37.9544" fill="var(--pe-vitral-5)" />
        <ellipse cx="102.456" cy="3.49014" rx="21.1118" ry="24.4897" fill="var(--pe-vitral-6)" />
      </g>
      <defs>
        <filter
          id="pe-vitral-blur"
          x="-26"
          y="-60.9995"
          width="240.934"
          height="234.663"
          filterUnits="userSpaceOnUse"
          colorInterpolationFilters="sRGB"
        >
          <feFlood floodOpacity="0" result="BackgroundImageFix" />
          <feBlend mode="normal" in="SourceGraphic" in2="BackgroundImageFix" result="shape" />
          <feGaussianBlur stdDeviation="20" result="effect1_foregroundBlur" />
        </filter>
      </defs>
    </svg>
  );
}
