import type { Metadata, Viewport } from "next";
import { DM_Sans, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { ShellApp } from "@/components/ShellApp";
import GlobalModals from "@/components/GlobalModals";
import KieBanner from "@/components/KieBanner";
import UpdateBanner from "@/components/UpdateBanner";
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

// O icone do app vem das convencoes de arquivo do Next (app/icon.svg e
// app/apple-icon.png) — ambos ja desenham a marca "P" no gradiente do kit.
export const metadata: Metadata = {
  applicationName: "Pitch Studio",
  title: {
    default: "Pitch Studio",
    template: "%s · Pitch Studio",
  },
  description: "Crie e edite imagens e vídeos com IA em pipelines visuais.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  // Tinta a barra do navegador com a mesma cor da pagina. O Violeta da marca
  // ficaria descolado do chrome claro — ele vive no logo e no botao primario.
  themeColor: "#f9f9f9",
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
      className={`${dmSans.variable} ${jetbrainsMono.variable} antialiased`}
      style={{ height: "100%" }}
    >
      <body className="h-full overflow-hidden">
        <TooltipProvider>
          {/* Quem decide se há navegação é o `ShellApp`: a página de projeto e o
              canvas de workflow são full-bleed, como na referência. */}
          <ShellApp
            sidebarOpen={sidebarOpen}
            banners={<><KieBanner /><UpdateBanner /></>}
          >
            {children}
          </ShellApp>
        </TooltipProvider>
        <GlobalModals />
      </body>
    </html>
  );
}
