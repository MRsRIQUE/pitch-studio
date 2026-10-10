import type { Metadata, Viewport } from "next";
import { Inter, JetBrains_Mono, Sora } from "next/font/google";
import "./globals.css";
import { ShellApp } from "@/components/ShellApp";
import GlobalModals from "@/components/GlobalModals";
import { BloqueioAcesso } from "@/components/acesso/BloqueioAcesso";
import { AceiteCreditos } from "@/components/acesso/AceiteCreditos";
import type { CreditsTerms } from "@/lib/saysell/client";
import { getSessionUser } from "@/lib/auth/currentUser";
import { getStudioMe } from "@/lib/saysell/client";
import { TooltipProvider } from "@/components/ui/tooltip";
import { cookies } from "next/headers";
import { TEMA_COOKIE, TEMA_SCRIPT_INICIAL } from "@/lib/temaCookie";

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
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f9f9f9" },
    { media: "(prefers-color-scheme: dark)", color: "#07122a" },
  ],
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const cookieStore = await cookies();
  const sidebarOpen = cookieStore.get("sidebar_state")?.value !== "false";
  // Tema salvo decide no servidor; sem escolha, o script do <head> segue o
  // sistema antes da pintura (por isso o aviso de hidratação fica desligado
  // no <html>: a classe `dark` pode chegar antes do React).
  const temaSalvo = cookieStore.get(TEMA_COOKIE)?.value;
  const html = {
    lang: "pt-BR",
    className: `${inter.variable} ${sora.variable} ${jetbrainsMono.variable} antialiased${temaSalvo === "escuro" ? " dark" : ""}`,
    style: { height: "100%" },
    suppressHydrationWarning: true,
  };
  const head = temaSalvo ? null : (
    <head>
      {/* Extensões do Chrome reescrevem <script> antes do React; o conteúdo é nosso. */}
      <script suppressHydrationWarning dangerouslySetInnerHTML={{ __html: TEMA_SCRIPT_INICIAL }} />
    </head>
  );

  // Sem sessão o proxy só deixa passar as telas públicas (/entrar, /share):
  // elas desenham sozinhas, sem a barra nem os modais do app.
  const user = await getSessionUser();
  if (!user) {
    return (
      <html {...html}>
        {head}
        <body className="h-full overflow-auto">{children}</body>
      </html>
    );
  }

  // O plano manda: Start, Free ou vencido não entram; sem resposta do
  // SaySell, fecha em vez de liberar sem saber.
  let bloqueio: "sem_plano" | "indisponivel" | null = null;
  let clausulaPendente: CreditsTerms | null = null;
  try {
    const me = await getStudioMe(user.uid);
    if (me.level === "none") bloqueio = "sem_plano";
    else if (me.creditsTerms && !me.creditsTerms.accepted) clausulaPendente = me.creditsTerms;
  } catch (error) {
    console.error("[layout] plano indisponível:", error);
    bloqueio = "indisponivel";
  }
  if (bloqueio) {
    return (
      <html {...html}>
        {head}
        <body className="h-full overflow-auto">
          <BloqueioAcesso motivo={bloqueio} email={user.email} />
        </body>
      </html>
    );
  }

  // Primeiro acesso: a cláusula de créditos é aceita antes de abrir o app (o
  // saysell-web também recusa reservar crédito sem esse aceite).
  if (clausulaPendente) {
    return (
      <html {...html}>
        {head}
        <body className="h-full overflow-auto">
          <AceiteCreditos clausula={clausulaPendente} email={user.email} />
        </body>
      </html>
    );
  }

  return (
    <html {...html}>
      {head}
      <body className="h-full overflow-hidden">
        <TooltipProvider>
          {/* Quem decide se há navegação é o `ShellApp`: a página de projeto e o
              canvas de workflow são full-bleed, como na referência. */}
          <ShellApp
            sidebarOpen={sidebarOpen}
            banners={null}
          >
            {children}
          </ShellApp>
        </TooltipProvider>
        <GlobalModals />
      </body>
    </html>
  );
}
