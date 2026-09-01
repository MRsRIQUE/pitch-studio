# Arquitetura

Visão geral do Pitch Studio depois da adoção da base do HeliosGen.

## Estrutura

| Pasta | Conteúdo |
| --- | --- |
| `app/` | Rotas do App Router e 32 route handlers em `app/api/` |
| `components/` | UI — `WorkflowCanvas.tsx`, `nodes/`, `edges/`, `ui/` (shadcn) |
| `lib/` | Domínio — modelos, providers, jobs, storage, guest mode |
| `hooks/` | Hooks compartilhados |
| `public/` | Assets estáticos; `public/generated/` recebe a mídia gerada |
| `src-tauri/` | Shell desktop (Tauri) — importado, ainda não usado |
| `legacy/` | Protótipo anterior em Vite + Fastify, apenas para consulta |

## Modos de execução

O app tem dois modos, decididos por `GUEST_MODE` no ambiente.

### Guest mode (`GUEST_MODE=true`) — o padrão em desenvolvimento

Roda inteiramente local. `lib/guestMode.ts` resolve todo usuário como `"guest"`,
e nenhuma chamada a Supabase ou Cloudflare R2 acontece.

| Recurso | Implementação |
| --- | --- |
| Banco | `lib/guest/sqlite.ts` — `node:sqlite`, arquivo `data/guest.db` |
| Acesso a dados | `lib/guest/db.ts` |
| Storage de mídia | `lib/guest/localStorage.ts` → `public/generated/` |
| Caminhos | `lib/guest/paths.ts` (`HELIOS_DATA_DIR` / `HELIOS_MEDIA_DIR` sobrescrevem) |

### Modo hospedado (`GUEST_MODE` ausente)

Usa Supabase para auth e dados (`lib/supabase/`) e R2 para mídia (`lib/r2.ts`).
Não está configurado neste projeto — 18 dos 32 endpoints tocam Supabase e vão
falhar sem credenciais reais.

## Fluxo de geração

```
UI (GenerateNode / gallery)
  └─ POST /api/generate | /api/generate-video
       ├─ resolveUserId          lib/guestMode.ts
       ├─ getKieTokenForUser     lib/getKieToken.ts
       │
       ├─ sem chave → startMockJob        lib/mockProvider.ts
       └─ com chave → POST api.kie.ai/api/v1/jobs/createTask
                       └─ pollKieJob      lib/kieJobPoller.ts
  
  ambos terminam em "settle":
       jobStore.set()            data/.job-store.json
       jobEvents.emit(job:<id>)  consumido pelo SSE
       guestDb.updateGeneration()
       mídia → public/generated/

UI acompanha via GET /api/job-status (SSE) e lista em GET /api/gallery
```

### Convenção de task IDs

Providers locais usam prefixo para que `lib/kieJobPoller.ts` não tente buscá-los
na kie.ai (ver `isKieTaskId`):

| Prefixo | Provider |
| --- | --- |
| `mock-` | Simulado (`lib/mockProvider.ts`) |
| `azure-` | Azure AI Foundry |
| `codex-` | Codex CLI local |
| *(sem prefixo)* | kie.ai |

### Callback vs. polling

Em modo hospedado a kie.ai faz POST em `/api/callback`, o que exige
`CALLBACK_BASE_URL` pública. Em guest mode o app faz polling
(`GET /api/v1/jobs/recordInfo`), então **não precisa de ngrok** — os handlers já
tratam a ausência de callback atrás de `!GUEST_MODE`.

## Provider simulado

`lib/mockProvider.ts` entra quando não há chave kie.ai e `MOCK_GENERATION` não é
`"false"`. Ele reproduz exatamente a sequência de `settle` do poller real, então
o ciclo completo é exercitado — só a chamada externa é falsa.

- **Imagem:** SVG renderizado para PNG por `sharp`, com prompt, modelo e
  proporção. A cor é derivada do hash do prompt, então o mesmo prompt sempre
  produz o mesmo placeholder.
- **Vídeo:** `public/mock/placeholder-video.mp4`, asset estático — sem
  dependência de ffmpeg em runtime.

## Catálogo de modelos

`lib/modelConfig.ts` (~950 linhas) é a fonte única: `IMAGE_MODELS` e
`VIDEO_MODELS`, cada um com `apiId`, formato do payload (`apiInput`), proporções,
limites de duração e custo. `lib/providers.ts` decide o backend por modelo
(kie.ai, Azure ou Codex).

`lib/modelPresets.ts` é a contribuição do Pitch Studio: os 8 presets de persona
do protótipo original, com sprite em `public/pitch/persona-presets-v1.png`.
