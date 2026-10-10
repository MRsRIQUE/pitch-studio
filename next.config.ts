import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: ["192.168.64.2"],
  turbopack: {
    root: path.join(__dirname),
  },
  experimental: {
    proxyClientMaxBodySize: '30mb',
  },
  // Binários resolvidos em runtime pelo caminho do pacote (lib/ffmpegBin.ts):
  // ficam fora do bundle e entram pela lista de arquivos abaixo.
  serverExternalPackages: ["undici", "ffmpeg-static", "ffprobe-static"],
  outputFileTracingIncludes: {
    // `sharp` é nativo; o rastreador perde os binários da plataforma.
    "/**": ["node_modules/sharp/**/*", "node_modules/@img/**/*"],
    // Quase toda rota de API pode guardar vídeo (o upload limpa metadados com
    // ffmpeg) e o editor usa ffprobe e a fonte embutida.
    "/api/**": [
      "node_modules/ffmpeg-static/ffmpeg",
      "node_modules/ffprobe-static/bin/linux/x64/ffprobe",
      "assets/fonts/**/*",
    ],
  },
  outputFileTracingExcludes: {
    // O ffprobe-static traz todas as plataformas (~330 MB); a função é linux/x64.
    "/**": [
      "node_modules/ffprobe-static/bin/darwin/**/*",
      "node_modules/ffprobe-static/bin/win32/**/*",
      "node_modules/ffprobe-static/bin/linux/ia32/**/*",
      "node_modules/ffprobe-static/bin/linux/arm64/**/*",
    ],
  },
  images: {
    remotePatterns: [
      // Mídia do Studio hospedado (Vercel Blob, lib/media).
      { protocol: "https", hostname: "*.public.blob.vercel-storage.com" },
      // Bucket antigo das amostras de template do HeliosGen: nós salvos antes
      // da troca ainda podem apontar para lá.
      { protocol: "https", hostname: "*.r2.dev" },
      { protocol: "https", hostname: "*.replicate.delivery" },
      { protocol: "https", hostname: "pbxt.replicate.delivery" },
      { protocol: "https", hostname: "*.replicate.com" },
      { protocol: "https", hostname: "*.aiquickdraw.com" },

      /* CDN das fotos dos Produtos Quentes (`captured_products` do PitchAI).
         A aba saiu do Studio hospedado, mas `next/image` LANÇA quando o host
         não está nesta lista, e a exceção derruba a árvore do React Flow
         inteira: um projeto antigo com um nó desses ficaria impossível de
         abrir. Estas linhas fazem o caso degradar para uma imagem. */
      { protocol: "https", hostname: "*.500fd.com" },
      { protocol: "https", hostname: "*.ibyteimg.com" },
    ],
  },
};

export default nextConfig;
