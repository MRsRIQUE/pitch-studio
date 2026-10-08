import path from "node:path";
import type { NextConfig } from "next";

// The packaged desktop (Tauri) build runs `next build` with DESKTOP_BUILD=1 and
// ships the self-contained `.next/standalone` server as a bundled sidecar. Plain
// `next dev` / `next build` (local development) leave it unset.
const DESKTOP_BUILD = process.env.DESKTOP_BUILD === "1";

const nextConfig: NextConfig = {
  allowedDevOrigins: ["192.168.64.2"],
  ...(DESKTOP_BUILD ? { output: "standalone" as const } : {}),
  turbopack: {
    root: path.join(__dirname),
  },
  experimental: {
    proxyClientMaxBodySize: '30mb',
  },
  serverExternalPackages: ["undici"],
  // `sharp` is a native module; the file tracer misses its platform binaries
  // unless we point at them explicitly for the standalone bundle.
  outputFileTracingIncludes: {
    "/**": ["node_modules/sharp/**/*", "node_modules/@img/**/*"],
  },
  // Never trace the Tauri desktop staging area into the standalone output.
  outputFileTracingExcludes: {
    "/**": ["src-tauri/**/*"],
  },
  images: {
    remotePatterns: [
      // Read-only public bucket holding the bundled workflow-template sample media
      // (lib/templates.ts). Not app storage — just an image CDN allow-list entry.
      { protocol: "https", hostname: "*.r2.dev" },
      { protocol: "https", hostname: "*.replicate.delivery" },
      { protocol: "https", hostname: "pbxt.replicate.delivery" },
      { protocol: "https", hostname: "*.replicate.com" },
      { protocol: "https", hostname: "*.aiquickdraw.com" },

      /* CDN das fotos dos Produtos Quentes (`captured_products` do PitchAI).
         O caminho normal grava a foto em disco antes de ela virar nó, e um
         nó nunca deveria apontar para cá — mas isto é rede de segurança, e
         a razão é séria: `next/image` LANÇA quando o host não está nesta
         lista, e a exceção derruba a árvore do React Flow inteira. Como o
         grafo é persistido, um único nó com endereço de fora deixa o
         projeto IMPOSSÍVEL DE ABRIR, não só feio. Aconteceu em teste.
         Estas duas linhas fazem esse caso degradar para uma imagem em vez
         de uma tela de erro. */
      { protocol: "https", hostname: "*.500fd.com" },
      { protocol: "https", hostname: "*.ibyteimg.com" },
    ],
  },
};

export default nextConfig;
