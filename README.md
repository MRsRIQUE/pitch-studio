# SaySell Studio

Estúdio de geração e edição de imagens e vídeos com IA, com builder visual de
pipelines em canvas infinito — o serviço de criação dos planos Pro e Max do
SaySell, hospedado na Vercel.

O projeto adota a base do [HeliosGen](https://github.com/SegFault42/HeliosGen)
(MIT) — veja [NOTICE.md](NOTICE.md).

## Como funciona

| Peça | Produção (Vercel) | Desenvolvimento |
| --- | --- | --- |
| Login | Firebase Auth do SaySell → cookie de sessão (`lib/auth`) | `STUDIO_DEV_USER` |
| Plano e créditos | rotas `/api/studio/*` do saysell-web (`lib/saysell`) | carteira falsa em memória |
| Dados | Firestore do SaySell (`lib/data/firestore.ts`) | SQLite em `data/guest.db` |
| Mídia | Vercel Blob (`lib/media`) | `public/generated/` |
| Jobs | avançam a cada leitura + Cron `/api/cron/jobs` (`lib/jobs`) | idem |
| Geração | kie.ai com `KIE_API_KEY` do servidor | simulada sem chave |

Toda geração reserva créditos no saysell-web **antes** de chamar a kie.ai e
encerra a reserva uma vez: confirmada quando o resultado chega, estornada se a
geração falha, cai ou passa de 30 minutos.

| Plano | Studio | Créditos/mês |
| --- | --- | --- |
| Free / Start | não | — |
| Pro | modelos selecionados, vídeo até 720p, imagem até 2K | 1.200 |
| Max e cortesia | todos os modelos | 4.000 |

A regra mora no saysell-web (`src/lib/studio/policy.ts`); o Studio só pergunta.

## Desenvolvimento

Requer **Node 22+** (o SQLite local usa `node:sqlite`).

```bash
npm install
cp .env.example .env.local   # preencha STUDIO_DEV_USER=dev-local
npm run dev
```

Abra `http://localhost:3000` (use `localhost`, não `127.0.0.1`: o dev server
do Next 16 só hidrata na origem configurada).

## Produção

Projeto próprio na Vercel, no mesmo time do saysell-web. Variáveis em
[`.env.example`](.env.example) — todas as marcadas `[prod]`. Antes do primeiro
deploy:

1. Ligar o Vercel Blob no projeto (cria `BLOB_READ_WRITE_TOKEN`).
2. Cadastrar o mesmo `STUDIO_SERVICE_KEY` aqui e no saysell-web.
3. Incluir o domínio do Studio em *Authorized domains* do Firebase Auth.
4. Cron por minuto (`vercel.json`) exige plano Pro da Vercel.

## Fora do v1

Áudio ElevenLabs (sem preço no sistema de créditos), modelos Higgsfield (sem
preço fixo), Tendências (yt-dlp local) e Produtos Quentes (Firestore do PitchAI).

## Validação

```bash
npx tsc --noEmit
npm run lint
npm test
npm run build
```

## Documentação

- [docs/superpowers/plans/2026-10-08-studio-c-vercel.md](docs/superpowers/plans/2026-10-08-studio-c-vercel.md) — plano da migração para a Vercel.
- [docs/ARQUITETURA.md](docs/ARQUITETURA.md) — estrutura herdada do HeliosGen (parte local desatualizada).
- [docs/MODEL_PRESETS.md](docs/MODEL_PRESETS.md) — presets de persona.
