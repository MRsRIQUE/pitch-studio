import type { Metadata, Viewport } from "next";
import { DM_Sans, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { AppSidebar } from "@/components/AppSidebar";
import GlobalModals from "@/components/GlobalModals";
import KieBanner from "@/components/KieBanner";
import UpdateBanner from "@/components/UpdateBanner";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { TooltipProvider } from "@/components/ui/tooltip";
import { cookies } from "next/headers";

// Tipografia da marca: DM Sans na interface, JetBrains Mono nas metricas
// que mudam ao vivo. Ver o bloco IDENTIDADE PITCH AI em globals.css.
const dmSans = DM_Sans({
  variable: "--font-dm-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
  weight: ["400", "500", "700"],
});

export const metadata: Metadata = {
  title: "Pitch Studio",
  description: "Crie e edite imagens e videos com IA em pipelines visuais.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const cookieStore = await cookies();
  const sidebarOpen = cookieStore.get("sidebar_state")?.value !== "false";

  return (
    <html
      lang="pt-BR"
      className={`${dmSans.variable} ${jetbrainsMono.variable} antialiased dark`}
      style={{ height: "100%" }}
    >
      <body className="text-white h-full overflow-hidden" style={{ background: "var(--surface-night)" }}>
        <TooltipProvider>
          <SidebarProvider defaultOpen={sidebarOpen} className="h-full">
            <AppSidebar />
            <SidebarInset style={{ backgroundColor: "transparent" }} className="flex flex-col min-h-0 min-w-0 border-l border-r border-t border-white/[0.08] mx-2 mt-2 rounded-tl-xl rounded-tr-xl">
              <KieBanner />
              <UpdateBanner />
              <div className="md:hidden flex items-center h-10 px-3 border-b border-white/[0.08] shrink-0">
                <SidebarTrigger className="text-white/50 hover:text-white hover:bg-white/[0.05] transition-colors rounded-lg p-1.5 [&_svg]:size-4" />
              </div>
              {children}
            </SidebarInset>
          </SidebarProvider>
        </TooltipProvider>
        <GlobalModals />
      </body>
    </html>
  );
}
