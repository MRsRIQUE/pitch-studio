# Studio C — Multiusuário na Vercel — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** o Studio deixa de ser um app local de um usuário só e roda na Vercel para os assinantes do SaySell, com login do SaySell, dados por usuário, mídia na nuvem e cada geração debitando créditos.

**Architecture:** três adaptadores com a mesma interface assíncrona e escolha por ambiente — dados (Firestore do SaySell em produção, SQLite local em dev), mídia (Vercel Blob em produção, disco local em dev) e créditos (rotas `/api/studio/*` do saysell-web em produção, carteira falsa só em dev). A sessão é um cookie HMAC emitido depois de validar o ID token do Firebase. Os jobs deixam de depender de processo vivo: cada leitura de status avança o job um passo, e um Cron da Vercel varre os pendentes.

**Tech Stack:** Next 16 (App Router, `proxy.ts`), Firebase Auth (cliente), Firestore REST com conta de serviço, `@vercel/blob`, `ffmpeg-static`, Vitest.

**Spec:** `docs/superpowers/specs/2026-10-08-saysell-studio-design.md` no saysell-web (branch `claude/studio-plan-20261008`).

## Global Constraints

- Produção nunca cai em adaptador local: se `VERCEL` está definido e falta credencial, a rota responde 503 em vez de usar SQLite, disco ou carteira falsa.
- Nenhum segredo com prefixo `NEXT_PUBLIC_`. Chaves de provedor (`KIE_API_KEY`, `ELEVENLABS_API_KEY`) só no servidor; a tela de chaves do usuário sai.
- Toda geração paga reserva créditos **antes** da chamada ao provedor e encerra a reserva (`committed`/`refunded`) exatamente uma vez.
- Paleta e marca já são as do site SaySell (fase D, commits `7c5fe42` e `8cb1803`); nada aqui muda cor.
- Modelos `higgsfield-*` ficam bloqueados (sem preço fixo); o seletor não os mostra.
- Corpo de requisição na Vercel tem limite de ~4,5 MB: arquivo maior vai direto do navegador para o Blob.

## Variáveis de ambiente (produção)

| Variável | Para quê |
|---|---|
| `STUDIO_SESSION_SECRET` | HMAC do cookie de sessão (≥ 32 caracteres) |
| `NEXT_PUBLIC_FIREBASE_API_KEY`, `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`, `NEXT_PUBLIC_FIREBASE_PROJECT_ID` | Login (valores públicos do projeto SaySell) |
| `FIREBASE_SERVICE_ACCOUNT` | Firestore do SaySell (JSON, base64 ou caminho) |
| `FIREBASE_DATABASE_ID` | Banco Firestore (o mesmo do saysell-web) |
| `BLOB_READ_WRITE_TOKEN` | Vercel Blob |
| `SAYSELL_API_URL`, `STUDIO_SERVICE_KEY` | Rotas de crédito do saysell-web |
| `KIE_API_KEY` | Geração |
| `CRON_SECRET` | Cron de jobs pendentes |
| `SAYSELL_PLANS_URL` | Link "ver planos" da tela de bloqueio |

## Fases

### C1 — Sessão e login
- [ ] `lib/auth/session.ts`: assina/valida cookie `ss_studio_session` (`uid`, `email`, `exp`, 7 dias) com HMAC-SHA256; Web Crypto, para rodar no `proxy.ts` e no Node.
- [ ] `lib/auth/idToken.ts`: valida ID token no Identity Toolkit (`accounts:lookup`), como `verifyFirebaseIdToken` do saysell-web.
- [ ] `app/api/session/route.ts`: `POST { idToken }` cria a sessão; `DELETE` encerra.
- [ ] `lib/auth/currentUser.ts`: `requireUser()` para route handlers (401 sem sessão) e `getSessionUser()` para server components.
- [ ] `proxy.ts`: sem sessão, página → `/entrar`; API → 401. Livres: `/entrar`, `/api/session`, `/api/cron/*`, assets.
- [ ] `/entrar`: Firebase Auth (Google e e-mail/senha), troca o ID token por sessão.
- [ ] Bloqueio por plano: `/api/studio/access` consulta o saysell-web; `level: "none"` mostra a tela "Studio nos planos Pro e Max".
- [ ] Dev: `STUDIO_DEV_USER=<uid>` pula o login, recusado quando `VERCEL` existe.

### C2 — Dados por usuário
- [ ] `lib/firestore/`: credencial (o leitor de `lib/pitchai/credencial.ts`, apontado para o SaySell), token com cache, REST `get`/`set`/`create` com precondição/`delete`/`query`/`commit`, codificação de valores.
- [ ] `lib/data/`: interface `StudioData` assíncrona com `uid` explícito; implementação Firestore (`studio_users/{uid}/…`, `studio_jobs/{taskId}`, `studio_asset_cache/{hash}`) e SQLite (o código de `lib/guest/` adaptado).
- [ ] Trocar `GUEST_USER_ID` e `lib/guest/db` em todas as rotas por `requireUser()` + `data()`.
- [ ] `jobStore` (JSON em disco) vira `studio_jobs/{taskId}` com dono, provedor, reserva de crédito e estado.

### C3 — Mídia
- [ ] `lib/media/`: `uploadBuffer`, `mirrorToStorage`, `ensureStorage` com Blob (produção) e disco (dev), mesma assinatura de hoje.
- [ ] `/api/blob-upload` (`handleUpload`, só com sessão, tipos de imagem/vídeo/áudio) e helper cliente `enviarArquivo()` que usa upload direto acima de 4 MB.
- [ ] Trocar as chamadas cliente de `/api/upload-asset`, `/api/upload-video` e `/api/upload` pelo helper.
- [ ] Miniaturas dos templates hoje vêm de um R2 do HeliosGen que responde 401: copiar para `public/` ou remover.

### C4 — Jobs sem processo vivo, com créditos
- [ ] `lib/credits/`: cliente das rotas `reserve`/`settle` do saysell-web (uid pelo header de serviço) e carteira falsa em dev; custo via `estimateGenerationCost()` arredondado para cima.
- [ ] `lib/jobs/advance.ts`: `advanceJob(taskId)` consulta o provedor uma vez (no máximo a cada 3 s por job), espelha a mídia, grava geração e job, encerra a reserva. Trava de encerramento por precondição no documento do job.
- [ ] `/api/generate` e `/api/generate-video`: reserva → `createTask` → job pendente; falha ao criar → estorno. Sem ramos Azure/Codex/Higgsfield.
- [ ] `/api/job-status` e `/api/job-stream`: chamam `advanceJob`; o SSE faz laço de 3 s até ~280 s e fecha (o `EventSource` reconecta sozinho).
- [ ] `/api/cron/jobs` (Vercel Cron, `CRON_SECRET`): avança até 50 jobs pendentes; job pendente há mais de 30 min vira erro com estorno.
- [ ] Mock: job `mock-` com `readyAt`, encerrado na leitura (sem `setTimeout`).
- [ ] Assistente: só modelos kie; débito fixo por mensagem (`kind: "chat"`) — ver ajuste no saysell-web.

### C5 — ffmpeg na função
- [ ] `ffmpeg-static` e `ffprobe-static` no lugar de `ffmpeg` do PATH; `outputFileTracingIncludes` para os binários.
- [ ] Entradas baixadas para `os.tmpdir()`; saídas sobem para o Blob.
- [ ] `maxDuration` 300 nas rotas de mídia; render acima de 120 s de vídeo é recusado com mensagem clara.

### C6 — Sai o que é desktop
- [ ] `src-tauri/`, `scripts/desktop/`, `legacy/`, `update-check`, `open-external`, `DesktopLinkHandler`, `UpdateBanner`, Codex (`lib/codex*`, rotas `settings/codex-*`), chaves do usuário (`settings/kie-key`, `azure-key`, `higgsfield-key`, `KieBanner`, aba de chaves do `SettingsModal`).
- [ ] Fora do v1, escondidos da navegação e com rota 404: Tendências (yt-dlp e banco local), Quentes (Firestore do PitchAI), áudio ElevenLabs (sem preço no sistema de créditos).

### C7 — Configuração e verificação
- [ ] `vercel.json` (Cron a cada minuto, `maxDuration`), `next.config.ts` (domínio do Blob em `images.remotePatterns`), `.env.example`, README.
- [ ] Vitest: sessão, codificação Firestore, `advanceJob` (sucesso, falha, corrida de dois encerramentos), cliente de créditos.
- [ ] `tsc`, lint sem erro novo, `next build`, e ponta a ponta local com mock: login dev → gerar imagem → galeria.

## Riscos

- **Alto: Cron por minuto exige plano Pro da Vercel.** No Hobby só há Cron diário; aí o job só termina enquanto alguém olha a tela.
- **Alto: domínio autorizado no Firebase Auth.** O login por popup falha até o subdomínio do Studio entrar em *Authorized domains* do projeto.
- **Médio: tamanho do workflow.** Documento do Firestore tem limite de 1 MB; workflow maior é recusado com mensagem, em vez de truncado.
- **Médio: ffmpeg na Vercel.** Binário de ~80 MB dentro do limite de 250 MB da função, mas render longo pode estourar o tempo máximo.
