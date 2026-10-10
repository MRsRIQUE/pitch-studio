"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { SaySellLogo, SaySellMark } from "@/components/SaySellLogo";
import { URL_COMPRAR_CREDITOS } from "@/hooks/useCreditos";
import { useWorkflowStore } from "@/lib/store";
import {
  ImageIcon,
  Package,
  MoreHorizontal,
  Plus,
  ArrowRight,
  Sparkles,
  Lightbulb,
  Palette,
  Network,
  Clapperboard,
} from "@/components/icones";
import { Moon, Sun, User } from "lucide-react";
import { useTema } from "@/lib/tema";

import { cn } from "@/lib/utils";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Avatar,
  AvatarFallback,
} from "@/components/ui/avatar";

// ── Deterministic pixel-art avatar ───────────────────────────────────────────
function fnv1a(str: string): number {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h;
}

function lcg(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 0xffffffff;
  };
}

function PixelAvatar({ seed, size = 36 }: { seed: string; size?: number }) {
  const rand = lcg(fnv1a(seed || "guest"));
  const hue1 = Math.floor(rand() * 360);
  const hue2 = (hue1 + 100 + Math.floor(rand() * 120)) % 360;

  const palette = [
    `hsl(${hue1}, 22%, 10%)`,  // 0 = bg
    `hsl(${hue1}, 68%, 58%)`,  // 1 = primary
    `hsl(${hue2}, 62%, 48%)`,  // 2 = secondary
    `hsl(${hue1}, 18%, 5%)`,   // 3 = dark
  ];

  const ROWS = 8, COLS = 8, HALF = 4;
  const cells: number[][] = Array.from({ length: ROWS }, () => {
    const row = new Array(COLS).fill(0);
    for (let c = 0; c < HALF; c++) {
      const v = Math.floor(rand() * 4);
      row[c] = v;
      row[COLS - 1 - c] = v;
    }
    return row;
  });

  const px = size / COLS;

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}
      style={{ display: "block", imageRendering: "pixelated" }}>
      <rect width={size} height={size} fill={palette[0]} />
      {cells.flatMap((row, r) =>
        row.map((v, c) =>
          v === 0 ? null : (
            <rect key={`${r}-${c}`} x={c * px} y={r * px} width={px} height={px} fill={palette[v]} />
          )
        )
      )}
    </svg>
  );
}

// ── Static icons ──────────────────────────────────────────────────────────────
function LogoIcon() {
  return <SaySellMark size={26} />;
}

function CreditIcon({ size = 12 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
      <circle cx="12" cy="12" r="9" />
      <circle cx="12" cy="12" r="3.5" />
    </svg>
  );
}

// ── Sidebar component ─────────────────────────────────────────────────────────
export function AppSidebar() {
  const { setOpenMobile } = useSidebar();
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const tab = searchParams.get("tab") ?? "images";

  const [balance, setBalance] = React.useState<number | null>(null);

  const setSettingsOpen   = useWorkflowStore((s) => s.setSettingsOpen);
  const setKieKeySet      = useWorkflowStore((s) => s.setKieKeySet);
  const setAzureKeySet    = useWorkflowStore((s) => s.setAzureKeySet);

  // No Studio hospedado as chaves dos provedores ficam no servidor: a kie.ai
  // está sempre conectada e o Azure não existe. O que limita a geração é o
  // saldo de créditos do plano, não uma chave do usuário.
  React.useEffect(() => {
    setKieKeySet(true);
    setAzureKeySet(false);
  }, [setKieKeySet, setAzureKeySet]);

  React.useEffect(() => {
    const fetchBalance = async () => {
      try {
        const res = await fetch("/api/credit");
        if (!res.ok) return;
        const data = await res.json();
        const val = typeof data?.data === "number"
          ? data.data
          : (data?.data?.balance ?? data?.balance ?? null);
        setBalance(val);
      } catch { /* ignore */ }
    };
    fetchBalance();
    const id = setInterval(fetchBalance, 60_000);
    window.addEventListener("credits-refresh", fetchBalance);
    return () => { clearInterval(id); window.removeEventListener("credits-refresh", fetchBalance); };
  }, []);

  /* No Miora, a seção `Projects` lista os projetos salvos. O nosso projeto é o
     espaço de workflow: mesma coisa — um canvas com nome, criado pelo `+` e
     aberto no clique. */
  const spaces        = useWorkflowStore((s) => s.spaces);
  const activeSpaceId = useWorkflowStore((s) => s.activeSpaceId);
  const createSpace   = useWorkflowStore((s) => s.createSpace);
  const switchSpace   = useWorkflowStore((s) => s.switchSpace);

  /* A referência mostra no máximo 4 projetos antes do `View more`; o resto vive
     na página. A escada de entrada (40ms por linha) é do próprio bloco 01. */
  const projetos = React.useMemo(
    () => [...spaces].sort((a, b) => (b.updatedAt ?? b.createdAt) - (a.updatedAt ?? a.createdAt)).slice(0, 4),
    [spaces],
  );

  function novoProjeto() {
    createSpace("Novo projeto");
    setOpenMobile(false);
    router.push("/workflow");
  }

  function abrirProjeto(id: string) {
    switchSpace(id);
    setOpenMobile(false);
    router.push("/workflow");
  }

  const displayName = "Workspace pessoal";
  const { tema, alternar: alternarTema } = useTema();
  const rotuloTema = tema === "escuro" ? "Mudar para o tema claro" : "Mudar para o tema escuro";
  const avatarSeed = "guest";

  const isCreationView = searchParams.get("view") === "create";

  /* A barra do Miora tem sete itens em dois grupos, e um único rótulo de grupo
     (`Customize`) entre eles. A ordem, os nomes e o que cada um abre estão em
     `.migracao/MAPA-AFORDANCIAS.md`, bloco 01.

     Os Produtos Quentes (Firestore do PitchAI) saíram do Studio hospedado;
     voltam quando houver a versão com os quentes do próprio SaySell. */
  const navTopo = [
    { label: "Criar",      href: `/gallery?tab=${tab}&view=create`, icon: ImageIcon, active: pathname === "/gallery" && isCreationView },
    { label: "Inspiração", href: "/inspiracao",                     icon: Sparkles,  active: pathname.startsWith("/inspiracao") },
    /* A aba de estruturar a ideia (leva 8). Ela ocupa o terceiro lugar do grupo
       de cima — o mesmo que a Arena tinha antes de sair —, então a barra volta à
       contagem da referência: 3 itens, rótulo de grupo, 3 itens. */
    { label: "Estruturar", href: "/estruturar",                     icon: Lightbulb, active: pathname.startsWith("/estruturar") },
    /* O kit turbo 1.000 seguidores: um formato travado, um episódio por
       dia. É fluxo de criação, irmão do Estruturar — por isso fica no
       grupo de cima e não em "Personalizar". */
    { label: "Séries",     href: "/series",                         icon: Clapperboard, active: pathname.startsWith("/series") },
  ];
  const navPersonalizar = [
    { label: "Personagens", href: "/personagens", icon: User, active: pathname.startsWith("/personagens") },
    { label: "Estilos", href: "/estilos",         icon: Palette, active: pathname.startsWith("/estilos") },
    /* `is-assets-brand`: no Miora, Assets é o único item cujo estado ativo usa a
       cor da marca em vez do cinza. Lá é laranja; aqui, violeta. */
    { label: "Acervo",  href: `/gallery?tab=${tab}`, icon: Package, active: pathname === "/gallery" && !isCreationView, marca: true },
    { label: "Memória", href: "/memoria",         icon: Network, active: pathname.startsWith("/memoria") },
  ];

  const renderNav = (items: typeof navTopo | typeof navPersonalizar) => items.map((item) => (
    <Link
      key={item.label}
      aria-current={item.active ? "page" : undefined}
      href={item.href}
      onClick={() => setOpenMobile(false)}
      className={itemCls(item.active, "marca" in item && item.marca)}
      title={item.label}
    >
      {React.createElement(item.icon, { size: 16, strokeWidth: 1.5, className: "shrink-0" })}
      <span className="text-ms-md font-medium group-data-[collapsible=icon]:hidden leading-none">
        {item.label}
      </span>
    </Link>
  ));

  const itemCls = (active: boolean, marca?: boolean) => cn(
    "miora-nav-item flex items-center gap-3 px-3 h-9 w-full rounded-xl transition-colors duration-150 text-left",
    "group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:w-9 group-data-[collapsible=icon]:h-9 group-data-[collapsible=icon]:px-0 group-data-[collapsible=icon]:mx-auto group-data-[collapsible=icon]:rounded-full",
    marca && "is-marca",
    active ? "is-active" : "",
  );

  return (
    <Sidebar collapsible="icon" className="border-r-0">

      {/* ── Header ── */}
      <SidebarHeader className="flex-row items-center justify-between h-[84px] pl-5 pr-2 py-[22px] gap-0">
        {/* `logo-btn` de 40px de altura em x 20: mascote 32 + gap 8 + lockup 63. */}
        <div className="flex h-10 items-center group-data-[collapsible=icon]:hidden">
          <SaySellLogo size={32} />
        </div>
        {/* Collapsed: logo fades to trigger on hover */}
        <div className="hidden group-data-[collapsible=icon]:flex group-data-[collapsible=icon]:w-full group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:py-1">
          <div className="relative group/logo-area w-10 h-10 flex items-center justify-center">
            <div className="pointer-events-none transition-opacity duration-200 group-hover/logo-area:opacity-0">
              <LogoIcon />
            </div>
            <SidebarTrigger className="absolute inset-0 opacity-0 group-hover/logo-area:opacity-100 transition-opacity duration-200 w-full h-full rounded-xl p-0 [&_svg]:size-4" />
          </div>
        </div>
        {/* `40×40`, `border-radius:12px`, encostado em x 202–242 pelo `pr-2` do
            cabeçalho. Estava em 28×28, o que o descolava 16px da borda. */}
        <div className="flex items-center group-data-[collapsible=icon]:hidden">
          <button
            type="button"
            onClick={alternarTema}
            title={rotuloTema}
            aria-label={rotuloTema}
            className="flex size-10 items-center justify-center rounded-xl text-ms-icon-secondary transition-colors hover:bg-ms-bg-hover hover:text-ms-text [&_svg]:size-4"
          >
            {tema === "escuro" ? <Sun /> : <Moon />}
          </button>
          <SidebarTrigger className="transition-colors size-10 p-0 rounded-xl [&_svg]:size-4" />
        </div>
      </SidebarHeader>

      {/* ── Menu ──
          `.app-v2-navi-menu`: padding 0 12px, gap 12 entre grupos e 4 entre itens
          (item de 36 → passo de 40). Colapsada, o padding vai a 14px e o rótulo
          de grupo some, o que sobe o segundo grupo de 246 para 212. */}
      <SidebarContent className="overflow-y-auto flex flex-col gap-3 px-3 group-data-[collapsible=icon]:px-[14px]">

        <div className="flex flex-col gap-1 shrink-0">
          {renderNav(navTopo)}
        </div>

        <div className="flex flex-col gap-1 shrink-0">
          <span className="miora-group-title flex items-center group-data-[collapsible=icon]:hidden">Personalizar</span>
          {renderNav(navPersonalizar)}
        </div>

        {/* ── Projetos ──
            No rail, a seção inteira vira uma entrada só, com o traço de 24×1px
            que o `::before` do `.app-v2-navi-rail-entry` desenha 5px acima. */}
        <div className="flex flex-col gap-1 shrink-0 group-data-[collapsible=icon]:mt-1">
          <div className="miora-group-title is-projetos flex items-center justify-between gap-0.5 group-data-[collapsible=icon]:hidden">
            <span>Projetos</span>
            <span className="flex items-center gap-0.5">
              <button
                type="button"
                onClick={novoProjeto}
                aria-label="Novo projeto"
                title="Novo projeto"
                className="size-6 rounded-lg flex items-center justify-center text-ms-icon-tertiary hover:text-ms-text-secondary hover:bg-ms-bg-hover transition-colors"
              >
                <Plus size={14} strokeWidth={1.8} />
              </button>
              <Link
                href="/workflow"
                aria-label="Ver mais"
                title="Ver mais"
                className="size-6 rounded-lg flex items-center justify-center text-ms-icon-tertiary hover:text-ms-text-secondary hover:bg-ms-bg-hover transition-colors"
              >
                <ArrowRight size={14} strokeWidth={1.8} />
              </Link>
            </span>
          </div>

          <Link
            href="/workflow"
            title="Projetos"
            className={cn(
              "miora-rail-entry hidden group-data-[collapsible=icon]:flex items-center justify-center size-9 mx-auto rounded-full",
              "miora-nav-item transition-colors duration-150",
              pathname.startsWith("/workflow") && "is-active",
            )}
          >
            <Package size={16} strokeWidth={1.5} />
          </Link>

          <div className="group-data-[collapsible=icon]:hidden flex flex-col gap-1">
            {projetos.length === 0 ? (
              <p className="px-3 py-2 text-ms-sm text-ms-text-placeholder leading-none">Nenhum projeto ainda</p>
            ) : projetos.map((sp, i) => (
              <button
                key={sp.id}
                type="button"
                onClick={() => abrirProjeto(sp.id)}
                title={sp.name}
                style={{ animationDelay: `${i * 40}ms` }}
                className={cn(
                  "miora-nav-item miora-projeto flex items-center gap-3 px-3 h-9 w-full rounded-xl transition-colors duration-150 text-left",
                  pathname.startsWith("/workflow") && sp.id === activeSpaceId && "is-active",
                )}
              >
                <span className="truncate text-ms-md font-medium leading-none">{sp.name}</span>
              </button>
            ))}
          </div>
        </div>

      </SidebarContent>

      {/* ── Footer ── */}
      <SidebarFooter className="px-3 pb-3 gap-3">
        <div className="miora-credit-card group-data-[collapsible=icon]:m-0">
          <div className="miora-credit-copy group-data-[collapsible=icon]:hidden">
            <span>Créditos</span>
            <strong className="metric">{balance !== null ? balance.toLocaleString() : "0"}</strong>
          </div>
          <button type="button" className="miora-upgrade group-data-[collapsible=icon]:hidden" onClick={() => window.open(URL_COMPRAR_CREDITOS, "_blank")}>Adicionar créditos</button>
          <div className="miora-credit-rail hidden group-data-[collapsible=icon]:flex">
            <CreditIcon size={13} />
            <strong className="metric">{balance !== null ? balance.toLocaleString() : "0"}</strong>
          </div>
        </div>
        <DropdownMenu>

          {/* Trigger: pixel avatar + name + credits */}
          <DropdownMenuTrigger
            render={
              <button
                title={displayName}
                className={cn(
                  /* `min-height:56px; gap:11px; padding:7px` com o avatar de 42.
                     Com `p-2`/`gap-3` a conta media 58 e empurrava o card de
                     crédito 3px para cima do 780 da referência. */
                  "miora-account flex items-center gap-[11px] w-full p-[7px] min-h-14 rounded-xl transition-colors cursor-pointer",
                  "group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:w-10 group-data-[collapsible=icon]:h-10 group-data-[collapsible=icon]:p-0 group-data-[collapsible=icon]:mx-auto",
                )}
              >
                <Avatar className="size-[42px] rounded-xl shrink-0 after:rounded-xl after:border-ms-border-subtle">
                  <AvatarFallback className="rounded-xl bg-transparent p-0 overflow-hidden">
                    <PixelAvatar seed={avatarSeed} size={42} />
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 text-left group-data-[collapsible=icon]:hidden min-w-0">
                  {displayName && <div className="text-[13px] font-semibold text-ms-text truncate leading-tight">{displayName}</div>}
                  <div className="mt-0.5 text-[11px] opacity-55">Configurações da conta</div>
                </div>
                <MoreHorizontal size={15} className="text-ms-icon-tertiary shrink-0 group-data-[collapsible=icon]:hidden" />
              </button>
            }
          />

          {/* Menu popup */}
          <DropdownMenuContent
            side="top"
            align="start"
            sideOffset={8}
            className="miora-account-menu !p-0 !rounded-2xl bg-popover text-popover-foreground border-border !ring-0 !shadow-xl overflow-hidden !w-auto !min-w-[280px]"
          >
            {/* User header — non-interactive */}
            <div className="flex items-center gap-3.5 px-4 pt-4 pb-3.5">
              <Avatar className="size-14 rounded-xl shrink-0 after:rounded-xl after:border-ms-border-subtle">
                <AvatarFallback className="rounded-xl bg-transparent p-0 overflow-hidden">
                  <PixelAvatar seed={avatarSeed} size={56} />
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0">
                {displayName && <div className="text-[15px] font-semibold text-ms-text truncate">{displayName}</div>}
                <div className="flex items-center gap-1.5 mt-0.5 text-[12px] text-ms-icon-tertiary">
                  <CreditIcon size={13} />
                  <span>{balance !== null ? `${balance.toLocaleString()} créditos` : "0 créditos"}</span>
                </div>
              </div>
            </div>

            <DropdownMenuSeparator className="bg-popover/[0.07] !my-0 !mx-0" />

            {/* Perfil — a tela do bloco de perfil (leva 8). Ela entra no menu da
                conta, e não como sétimo item da navegação: no Miora a conta é o
                rodapé da barra, e perfil é assunto de conta. */}
            <DropdownMenuItem
              className="rounded-none px-4 py-3 text-[14px] text-ms-text-secondary hover:text-ms-text focus:text-ms-text focus:bg-ms-bg-hover cursor-pointer"
              onClick={() => { setOpenMobile(false); router.push("/perfil"); }}
            >
              Perfil
            </DropdownMenuItem>

            <DropdownMenuSeparator className="bg-popover/[0.07] !my-0 !mx-0" />

            {/* Comprar créditos */}
            <DropdownMenuItem
              className="flex items-center justify-between rounded-none px-4 py-3 text-[14px] text-ms-text-secondary hover:text-ms-text focus:text-ms-text focus:bg-ms-bg-hover cursor-pointer"
              onClick={() => window.open(URL_COMPRAR_CREDITOS, "_blank")}
            >
              <span>Comprar créditos</span>
              <CreditIcon size={15} />
            </DropdownMenuItem>

            <DropdownMenuSeparator className="bg-popover/[0.07] !my-0 !mx-0" />

            {/* Tema — também no menu para quem usa a barra recolhida. */}
            <DropdownMenuItem
              className="flex items-center justify-between rounded-none px-4 py-3 text-[14px] text-ms-text-secondary hover:text-ms-text focus:text-ms-text focus:bg-ms-bg-hover cursor-pointer"
              onClick={alternarTema}
            >
              <span>{tema === "escuro" ? "Tema claro" : "Tema escuro"}</span>
              {tema === "escuro" ? <Sun size={15} /> : <Moon size={15} />}
            </DropdownMenuItem>

            <DropdownMenuSeparator className="bg-popover/[0.07] !my-0 !mx-0" />

            {/* Settings */}
            <DropdownMenuItem
              className="rounded-none px-4 pb-4 pt-3 text-[14px] text-ms-text-secondary hover:text-ms-text focus:text-ms-text focus:bg-ms-bg-hover cursor-pointer"
              onClick={() => setSettingsOpen(true)}
            >
              Configurações
            </DropdownMenuItem>
          </DropdownMenuContent>

        </DropdownMenu>
      </SidebarFooter>

    </Sidebar>
  );
}
