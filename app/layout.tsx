import type { Metadata, Viewport } from "next";
import { Inter, JetBrains_Mono, Sora } from "next/font/google";
import "./globals.css";
import { ShellApp } from "@/components/ShellApp";
import GlobalModals from "@/components/GlobalModals";
import KieBanner from "@/components/KieBanner";
import UpdateBanner from "@/components/UpdateBanner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { cookies } from "next/headers";

// Tipografia do site SaySell: Inter na interface, Sora no wordmark e
// JetBrains Mono nas metricas que mudam ao vivo. Ver app/tokens/pitch.css.
const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const sora = Sora({
  variable: "--font-sora",
  subsets: ["latin"],
  weight: ["700", "800"],
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
  weight: ["400", "500", "700"],
});

// O icone do app vem das convencoes de arquivo do Next (app/icon.png e
// app/apple-icon.png) — os mesmos arquivos do site SaySell.
export const metadata: Metadata = {
  applicationName: "SaySell Studio",
  title: {
    default: "SaySell Studio",
    template: "%s · SaySell Studio",
  },
  description: "Crie e edite imagens e vídeos com IA em pipelines visuais.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  // Tinta a barra do navegador com a mesma cor da pagina. O azul da marca
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
      className={`${inter.variable} ${sora.variable} ${jetbrainsMono.variable} antialiased`}
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
