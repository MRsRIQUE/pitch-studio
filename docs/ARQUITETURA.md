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

## Identidade visual

A marca segue o "Pitch AI Brand Kit". Os tokens estão no bloco
`IDENTIDADE PITCH AI` no topo de `app/globals.css`:

| Papel | Token | Valor |
| --- | --- | --- |
| Marca | `--brand-violet` / `--brand-lilac` | `#4318FF` / `#868CFF` |
| Gradiente | `--brand-gradient` | `135°, #868CFF → #4318FF` |
| Fundo | `--surface-night` | `#0F0F1A` |
| Cartão | `--surface-card` | `#171728` |
| Borda | `--border` | `#262640` |
| Texto fraco | `--text-muted` | `#8B9CC7` |
| Sinais | `--signal-*` | Sucesso `#01B574`, Atenção `#FFB547`, Crítico `#E31A1A`, Voz `#0BC5EA`, Informação `#1B84FF` |

**Acento interativo.** O kit define o Violeta `#4318FF` como cor de marca, mas
em superfície escura ele não tem contraste para texto e ícone. O acento
interativo é o Lilás `#868CFF`; o Violeta fica no gradiente — logo, botão
primário e realces.

**Regra dos sinais.** O kit determina que cores de sinal apareçam só em texto,
ícone e tinta a 14–18%, nunca em áreas grandes.

**Tipografia.** DM Sans em toda a interface (`--font-ui`); JetBrains Mono
apenas em números que mudam ao vivo (`--font-metric`, tabular).

**Logotipo.** `components/PitchLogo.tsx` — tile com raio de 27% do lado,
gradiente e "P"; wordmark `PITCH STUDIO` em caixa-alta com `letter-spacing`
0.16em. O ícone do app é `app/icon.svg`.

**Handles dos nós.** O canvas usa matizes distintas para diferenciar tipos de
conector. Em vez de colapsar tudo em uma cor, elas foram remapeadas sobre a
paleta de sinais do kit, preservando a distinção funcional.

### Chaves de armazenamento

O rebrand renomeou as chaves do `localStorage` de `heliosgen*` para
`pitch-studio*`. `lib/store.ts` e `lib/chatSessionStore.ts` migram os valores
antigos na primeira execução, para não orfanar workflows e conversas já salvos.
