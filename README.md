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
| Providers de IA | kie.ai (imagem e vídeo), Higgsfield (Seedance 2.0 texto-para-vídeo) |

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

O Higgsfield também é acompanhado por polling (`lib/higgsfieldJobPoller.ts`).
As submissões são registradas antes do POST para evitar duplicatas cobradas; se
um timeout deixar o resultado da submissão incerto, o app não reenvia sozinho.

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

#### Higgsfield / Seedance 2.0 e Genjutsu

1. Crie um API key ID e secret no [Higgsfield Console](https://open.higgsfield.ai/api-keys).
2. Em **Settings → Chaves de API → Higgsfield**, salve os dois valores. Como
   alternativa de servidor, defina `HF_CREDENTIALS=KEY_ID:KEY_SECRET` em
   `.env.local` (também são aceitos `HF_API_KEY_ID` e `HF_API_KEY_SECRET`).
3. No seletor de vídeo, escolha **Higgsfield → Seedance 2.0** e gere a partir de
   um prompt. O modelo aceita 4–15 segundos, 480p/720p/1080p/4k, áudio opcional
   e proporções 16:9, 4:3, 1:1, 3:4, 9:16 ou 21:9.
4. Para Genjutsu, escolha **Motion Transfer** ou **Object Swap**, conecte um
   vídeo-fonte de 4–30 segundos ao handle `Source video` e conecte de 1 a 8
   imagens ao handle `Reference images`. O prompt é opcional e a saída pode ser
   480p ou 720p. Arquivos locais são enviados ao CDN da Higgsfield no servidor
   antes da submissão.

As credenciais permanecem no servidor/SQLite local e não são devolvidas pela
API de configurações nem incluídas em logs.

A integração usa o fluxo REST de URL pré-assinada para uploads (incluindo todos
os `upload_headers` devolvidos pela API) e o SDK oficial para submissão. Ela
salva o `request_id` com o usuário local, acompanha o `status_url` com backoff e
espelha o resultado em `public/generated/`. Em caso de timeout ambíguo no POST,
o app não reenvia a geração automaticamente.

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
