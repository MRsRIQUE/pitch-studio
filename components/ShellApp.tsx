"use client";

/* ============================================================
   O SHELL — e as telas que NÃO têm navegação

   No Miora a página de projeto (`/file/<id>`) é full-bleed: a barra de
   250px simplesmente não existe ali. Medido nos dois, lado a lado:

     Miora  /file/<id>   barra de ferramentas em x = 394, painel em x = 9
     nosso  /projeto     barra de ferramentas em x = 644, painel em x = 258

   Os 250px de diferença eram exatamente a nossa nav, que continuava
   desenhada numa tela onde a referência não tem nenhuma. A tela inteira
   ficava deslocada.

   A Memória já resolvia isso por conta própria, com um overlay
   `fixed inset-0` por cima da barra. Aqui o certo é não desenhar a barra:
   overlay esconde, mas o espaço continua reservado no fluxo.

   Quem entra na lista abaixo perde a navegação — então precisa ter um
   caminho de volta dentro da própria tela. Na página de projeto é o
   PitchMark do cabeçalho do painel.
   ============================================================ */

import * as React from "react";
import { usePathname } from "next/navigation";
import { AppSidebar } from "@/components/AppSidebar";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";

/** As telas full-bleed — as que não desenham a barra de 250px.
 *
 *  O canvas de workflow entrou aqui, saiu, e voltou. Vale a história, porque a
 *  razão mudou no meio e não a vontade:
 *
 *  1. Entrou na leva 7 por fidelidade — a página de projeto do Miora não tem
 *     navegação nenhuma.
 *  2. Saiu quando o usuário perguntou "cadê a sidebar no workflow?": naquele
 *     momento aquela tela **não tinha painel de chat**, e sem a barra não havia
 *     como sair dela a não ser pelo botão do navegador.
 *  3. Voltou agora, porque a leva 7 fundiu as duas telas: o canvas de workflow
 *     passou a ter o painel, cujo cabeçalho carrega a marca como caminho de
 *     volta. A condição que motivou a saída deixou de existir.
 *
 *  O caminho de volta sobrevive ao painel recolhido: "Mostrar o painel" fica
 *  visível em (262,12) e devolve o cabeçalho — conferido antes de tirar a barra.
 *
 *  `/workflow` (a lista de projetos) **não** entra: lá é painel de cards, e a
 *  referência também tem navegação nas telas de lista. */
function semNavegacao(pathname: string): boolean {
  if (pathname === "/projeto" || pathname.startsWith("/projeto/")) return true;
  return /^\/workflow\/[^/]+/.test(pathname);
}

export function ShellApp({
  sidebarOpen,
  banners,
  children,
}: {
  sidebarOpen: boolean;
  /** Os avisos do topo, que só existem onde há navegação. */
  banners: React.ReactNode;
  children: React.ReactNode;
}) {
  const pathname = usePathname() ?? "";

  if (semNavegacao(pathname)) {
    return (
      <div className="miora-shell h-full flex flex-col min-h-0 min-w-0" style={{ backgroundColor: "var(--app-v2-bg-page)" }}>
        {children}
      </div>
    );
  }

  return (
    <SidebarProvider defaultOpen={sidebarOpen} className="miora-shell h-full">
      <AppSidebar />
      <SidebarInset style={{ backgroundColor: "var(--app-v2-bg-page)" }} className="flex flex-col min-h-0 min-w-0">
        {banners}
        <div className="miora-mobile-bar md:hidden flex items-center h-12 px-3 shrink-0">
          <SidebarTrigger className="rounded-xl p-2 [&_svg]:size-4" aria-label="Abrir navegação" />
        </div>
        {children}
      </SidebarInset>
    </SidebarProvider>
  );
}
