# Pitch Studio

Estúdio de geração e edição de imagens e vídeos com IA, com builder visual de
pipelines em canvas infinito.

O projeto adota a base do [HeliosGen](https://github.com/SegFault42/HeliosGen)
(MIT) — veja [NOTICE.md](NOTICE.md). O protótipo anterior em Vite + Fastify está
preservado em [`legacy/`](legacy/) para consulta.

## Stack

| Camada | Tecnologia |
| --- | --- |
| Framework | Next.js 16 (App Router, Turbopack) |
| UI | React 19, Tailwind CSS 4, shadcn/base-ui |
| Canvas | `@xyflow/react` |
| Estado | Zustand |
| Persistência local | SQLite via `node:sqlite` (sem build nativo) |
| Imagens | `sharp` |
| Provider de IA | kie.ai (imagem e vídeo) |

## Desenvolvimento

Requer **Node 22+** (o guest mode usa `node:sqlite`, embutido no runtime).

```bash
npm install
npm run dev
```

Abra `http://localhost:3000`.

### Modo local (guest mode)

O `.env.local` já vem configurado para rodar **100% na sua máquina**: sem
Supabase, sem Cloudflare R2 e sem ngrok.

| O quê | Onde |
| --- | --- |
| Histórico, workflows, pastas, settings | `data/guest.db` (SQLite) |
| Mídia gerada | `public/generated/` |
| Estado de jobs | `data/.job-store.json` |

Apague esses caminhos para zerar o app.

Em guest mode o app faz **polling** da kie.ai (`lib/kieJobPoller.ts`) em vez de
receber webhook, por isso não precisa de URL pública.

### Geração simulada

Sem chave da kie.ai, a geração cai automaticamente no provider simulado
(`lib/mockProvider.ts`): o ciclo real do job roda inteiro — `jobStore` → evento
SSE em `/api/job-status` → SQLite → galeria — e só a chamada externa é falsa.

- Imagem: PNG gerado na hora com o prompt, modelo e proporção.
- Vídeo: `public/mock/placeholder-video.mp4`.

Defina `MOCK_GENERATION=false` no `.env.local` para desativar e voltar ao erro
401 quando não houver chave.

### Geração real

1. Crie uma chave em [kie.ai](https://kie.ai).
2. Cole em **Settings → API Keys** (fica no SQLite local) ou em `KIE_API_KEY` no
   `.env.local`.

O caminho real assume sozinho assim que a chave existe — nenhuma outra mudança
é necessária.

## Validação

```bash
npx tsc --noEmit
npm run lint
npm run build
```

## Documentação

- [docs/ARQUITETURA.md](docs/ARQUITETURA.md) — estrutura, fluxo de geração e persistência.
- [docs/MODEL_PRESETS.md](docs/MODEL_PRESETS.md) — presets de persona do Pitch Studio.

## Próximas frentes

1. Re-skin: tokens de cor/tipografia, sidebar, logo e textos em pt-BR.
2. Reintegrar os presets de persona (`lib/modelPresets.ts`) na UI.
3. Decidir sobre as rotas dependentes de Supabase (auth, spaces públicos, share).
4. Conectar a primeira chave real da kie.ai.
