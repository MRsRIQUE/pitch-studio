/**
 * Portão do Studio: sem sessão, página vai para `/entrar` e API responde 401.
 *
 * É a checagem otimista (o cookie existe e a assinatura confere); cada route
 * handler confere de novo com `getSessionUser()` antes de tocar em dado.
 */
import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, decodeSession, devSession } from "@/lib/auth/session";

/** Caminhos que não pedem sessão. */
function isPublic(pathname: string): boolean {
  if (pathname === "/entrar" || pathname.startsWith("/entrar/")) return true;
  if (pathname === "/api/session") return true;
  // O Cron da Vercel se autentica com CRON_SECRET dentro da própria rota.
  if (pathname.startsWith("/api/cron/")) return true;
  // Link público de workflow compartilhado (somente leitura).
  if (pathname.startsWith("/share/")) return true;
  return false;
}

export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  if (isPublic(pathname)) return NextResponse.next();

  const session = devSession() ?? decodeSession(request.cookies.get(SESSION_COOKIE)?.value);
  if (session) return NextResponse.next();

  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "Sua sessão expirou. Entre de novo." }, { status: 401 });
  }
  const url = request.nextUrl.clone();
  url.pathname = "/entrar";
  url.search = `?voltar=${encodeURIComponent(pathname + search)}`;
  return NextResponse.redirect(url);
}

export const config = {
  matcher: [
    // Tudo, menos assets do Next e arquivos estáticos de `public/`.
    "/((?!_next/static|_next/image|favicon.ico|icon.png|apple-icon.png|.*\\.(?:png|jpg|jpeg|gif|webp|svg|ico|mp4|webm|mp3|wav|woff2?|txt|md)$).*)",
  ],
};
