# Frente Motor de Tendências — mapa do que existe vs. o que falta

Nota de trabalho da frente "motor de tendências" (papel Garimpo no Maestri). Referência única:
a nota do canvas `orior-ai-engenharia-revers` (engenharia reversa da Orior AI, 21/09/2026),
citada aqui por seção (`§7.3` = seção 7.3 da nota). Frente separada da de vídeo/UGC da
Claquete (`docs/roadmap-tiktok-ugc.md`), que reaproveita bastante.

Tese da Orior que esta frente persegue (§7.5): **o trabalho é feito na ingestão, não no
clique**. Cada tendência entra já decomposta (first-frame, slides, hook com slots, beats,
assets exigidos) e a UI só coleta o delta do usuário.

## Estado atual (2026-09-21)

Quatro decisões de arquitetura confirmadas (ver seção própria). **Passo 4.1 (importar)
implementado e validado** — ver "4.1 — o que foi construído". Próximo: 4.2 (fatiar).

Pendências conhecidas:
- **Entrada na sidebar**: `/tendencias` só abre pela URL por enquanto. `components/AppSidebar.tsx`
  tem ~950 linhas de mudança não commitada de outra frente (a barra nova, com Quentes/Séries,
  nem existe no HEAD); acrescentar o item agora misturaria o commit desta frente com trabalho
  alheio. Entra quando a barra nova for commitada: um item `{ label: "Tendências", href:
  "/tendencias", … }` no grupo de cima, irmão de Inspiração/Quentes (fonte de material).
- **Link real via yt-dlp não testado**: o `yt-dlp` não está instalado nesta máquina, e instalar é
  decisão do usuário. Testado: o caminho sem ele (mensagem clara) e todo o resto do fluxo.

## Mapeamento do plano da Orior (§10) contra o Pitch Studio

| Fase Orior | Situação no Pitch Studio | Onde |
|---|---|---|
| 1 — Shell (sidebar marca+personagem, fila global, Ctrl K) | Adiada por decisão do usuário (entrega pouco sozinha, §10) | — |
| 2 — Personagem como asset | **Já existe** | `app/personagens/page.tsx` |
| 3 — Composer linear guiado | **Já registrado** (prioridade menor) | `docs/roadmap-tiktok-ugc.md`, item 7 |
| Rota B "Copy motion" (§6.3) | **Já existe** | `lib/templates.ts` → `makeTrocaPessoaTemplate` (Seedance 2.5 Edit); `VIDEO_MODELS` tem Kling 3.0 Motion Control 2.6/3.0 |
| "Styles" (§5.3) | **Já existe** | `components/WorkflowDashboard.tsx` (5 nichos + Live) |
| **4 — Ingestão de tendências** | **Não existe — é esta frente** | — |
| 5 — Remix (deck de swipe, tela Goal→assets→Direction) | Não existe; só a "ponte mínima" entra aqui (ver passo 4.5) | — |
| 6 — Distribuição | Fora do escopo | — |

## O que já existe e será reaproveitado (não reconstruir)

- **Fatiamento de vídeo** — `lib/productionMedia.ts`, operação `analyze`: FFmpeg local detecta
  cortes (`select='gt(scene,0.3)'`), extrai um frame por plano (640px) e salva no acervo local.
  Hoje só é chamada pelo Smart Breakdown. A Claquete confirmou (2026-09-21) que não tem nada em
  andamento nesse arquivo. A ideia é chamar a mesma lógica como etapa de ingestão, sem mudar o
  comportamento atual.
- **Transcrição real** — `app/api/production/audio/route.ts`, operação `transcribe` (ElevenLabs
  `scribe_v2`, timestamps por palavra). Serve para pegar a fala do vídeo, que muitas vezes É o
  hook. Opcional: sem chave ElevenLabs, a ingestão segue só com legenda + frames.
- **LLM com visão** — `/api/assistant` já roteia `gemini-3.1-pro` / `gemini-3-flash` pela Kie
  (endpoint OpenAI-compatível, aceita imagens). É o padrão do Smart Breakdown e de
  `/personagens` (`MODELO_LEITURA_PADRAO`). Pela memória do projeto: Claude via Kie está sem
  conta, GPT via Kie ignora tools (irrelevante aqui: a análise é JSON, não tool call).
  `parseProductionJSON` (`lib/productionClient.ts`) já tolera cerca de ```json.
- **Download server-side de mídia** — `/api/fetch-url`: baixa URL **direta** de mídia (≤50MB) para
  o acervo. Não resolve link de página do TikTok/IG — precisa de um resolvedor antes.
- **SQLite local** — `lib/guest/sqlite.ts` + `lib/guest/db.ts`, padrão já seguido pela tabela
  `cloned_voices` da Claquete.
- **Template a partir de vídeo de referência** — `makeNichoTemplate(cfg: NichoConfig)` em
  `lib/templates.ts` (privada hoje; a Claquete topou exportar quando eu precisar). Recebe
  `hook`/`cta` e monta o grafo vídeo de referência + personagem + prompt → Seedance 2.5 Edit.
  É a saída natural de "usar esta tendência", sem node nem handle novo.

## O que falta — Fase 4, quebrada em passos

Cada passo entrega algo verificável sozinho. Ordem proposta:

### 4.1 Importar (link ou arquivo) — com trava de direito de uso

- Entrada: link TikTok/Instagram **ou** upload de mp4 (o upload é o caminho que sempre funciona,
  mesmo se o link falhar).
- Checkbox obrigatória "Tenho o direito de usar este vídeo" (§5.2); a data da confirmação fica
  gravada na tendência.
- O vídeo original fica **só no acervo local**, usado para derivar estrutura/movimento. Nada na
  UI oferece baixar ou republicar o original.
- Resolver o link: ver pergunta em aberto P2.
- Metadados da fonte quando disponíveis: handle, legenda, duração, views/likes/comments/shares.

#### 4.1 — o que foi construído (2026-09-21)

Só arquivos novos — nenhum arquivo base (`lib/guest/sqlite.ts`, `lib/guest/db.ts`, rotas de
upload) foi tocado, porque vários deles têm mudança não commitada de outra frente.

- `lib/tendencias/tipos.ts` — tipos compartilhados cliente/servidor (`Tendencia`,
  `StatusTendencia` com o ciclo inteiro da ingestão, `CodigoErroImportacao`), `origemDoLink()`
  (hosts TikTok/Instagram aceitos) e a mensagem única de yt-dlp ausente.
- `lib/tendencias/db.ts` — tabela `trends` no mesmo `guest.db`, criada sob demanda
  (`CREATE TABLE IF NOT EXISTS` na primeira chamada), com o esquema desta frente morando aqui
  e não em `sqlite.ts`. Dedupe por `source_key` único por usuário (`tiktok:<id do post>` ou
  `upload:<url do acervo>`, que já deduplica por hash). `trend_insights`, `brands` e
  `trend_brand_fit` entram nos passos 4.3/4.4.
- `lib/tendencias/importar.ts` — `versaoYtdlp()` (sem cache: instalou e reiniciou, já vê);
  `importarPorLink()` roda `yt-dlp -f "b[ext=mp4]/b" --max-filesize 100M --dump-json
  --no-simulate` num diretório temporário, lê handle/legenda/duração/views/likes/comentários/
  compartilhamentos do JSON e classifica a falha (`login_exigido` quando o stderr fala em
  login/cookies, `falha_download` no resto, sempre com o motivo do yt-dlp e a saída "envie o
  mp4"). `importarArquivo()` confere que a URL é do acervo (com trava de path traversal) e que o
  ffprobe acha uma trilha de vídeo. **O vídeo baixado por link não entra na tabela `uploads`**,
  então não aparece no Acervo com botão de baixar — é referência para derivar, não para
  republicar. O mp4 enviado pelo usuário entra, como todo upload, porque é arquivo dele.
- `app/api/tendencias/route.ts` — `GET` (lista + status do yt-dlp), `POST` (`url` ou
  `videoUrl`, exige `direitoConfirmado: true`, responde `jaExistia` na duplicata), `DELETE ?id=`
  (só a linha; o arquivo fica no acervo porque o dedupe pode tê-lo compartilhado).
- `app/tendencias/page.tsx` + `components/tendencias/TendenciasPage.tsx` + `tendencias.css` —
  casca de `/quentes`, cartão de importação (link sempre visível, "ou", arquivo, checkbox) e grade
  9:16. O botão primário nomeia o bloqueio ("Cole um link ou escolha um arquivo", "Link não
  reconhecido", "Envie o arquivo mp4", "Confirme o direito de uso"). A checkbox desmarca depois
  de cada importação: o direito é confirmado por vídeo, não uma vez por sessão. Player com
  `controlsList="nodownload"`. Remoção em dois cliques, sem diálogo nativo.

**Validação real**:
1. API pelo dev server (`curl`, 9 casos): GET vazio com `ytdlp.disponivel:false`; link TikTok sem
   yt-dlp → 400 `ytdlp_ausente` com a mensagem combinada; sem direito → 400
   `direito_nao_confirmado`; link do YouTube → 400 `link_invalido`; mp4 sintético (ffmpeg, 4s,
   540×960) enviado por `/api/upload-video` → tendência criada com `duracao: 4`; mesmo arquivo de
   novo → `jaExistia: true` com o mesmo id; arquivo corrompido gravado direto no acervo → 400
   `video_invalido` pelo ffprobe; `videoUrl` com `../` → 400 "Caminho de mídia inválido";
   DELETE → 200, e de novo → 404.
2. Tela no Chromium do Playwright (14 checagens num `run-code`): estado vazio, os quatro rótulos
   de bloqueio na ordem certa, a mensagem do yt-dlp aparecendo ao colar o link (antes de
   clicar), upload real → card com "Arquivo enviado · Importada · 0:04", `controlslist=nodownload`,
   checkbox resetada, remoção em dois cliques zerando a grade. Screenshots conferidos (o vídeo
   decodifica e aparece no card), console sem erro.
3. **Achado durante o teste**: `/api/upload-video` (rota base, não desta frente) devolve o log
   inteiro do ffmpeg quando o arquivo não é vídeo. A tela troca isso por uma mensagem legível em
   vez de mexer na rota compartilhada.
4. **Não testado**: link real (yt-dlp ausente). Rastro dos testes: um `upload` `user_upload` do
   mp4 sintético ficou no acervo (a tendência foi removida).

### 4.2 Fatiar (ingestão, uma vez só)

- `analyze` (cortes de plano) → frames por plano.
- `first-frame` (t≈0,1s) + até 6 "slides" escolhidos entre os planos (distribuídos ao longo do
  vídeo), no espírito de `content-trends/{id}/slide-01..06.jpg` (§2.3).
- Transcrição (se houver chave ElevenLabs).
- Status por etapa gravado (`importando → fatiando → analisando → pronta | erro`), para a tela
  mostrar progresso e permitir re-tentar só a etapa que falhou.

### 4.3 Insights independentes de marca (um LLM, uma vez por tendência)

Uma chamada com visão (frames + legenda + transcrição) devolvendo JSON validado campo a campo
(mesma filosofia de `lib/estruturaIdeia.ts`: desserializar com tolerância e corrigir/registrar):

- `hookOriginal` e `hookTemplate` com slots (§7.2), ex.
  `not mad. just disappointed because i [ação] and you still [comportamento]`, + `slots[]`.
- `beats[]`: Opening / Story / Ending ancorados em índice de slide (§7.3).
- `whyItWorks`: uma frase.
- `requiredAssets[]`: `{ nome, motivo, slideIndex, soQuandoCitaMarca }` — o último campo modela
  o comportamento da Orior em que o objetivo "Grow audience" remove a exigência (§6.4).
- `niches[]` sugeridos.

Separar isto do brand-fit é deliberado: trocar de marca não re-analisa frames (a parte cara).

### 4.4 Perfil de marca + brand fit

- Perfil mínimo: nome, tipo (app, site/SaaS, produto, serviço, marca pessoal), "o que você está
  construindo" — o caminho manual da Orior (§6.1). Scraping do site fica para depois.
- `brandFit` = chamada barata só de texto (`gemini-3-flash`) sobre os insights já prontos +
  perfil; cacheada por (tendência, marca).

### 4.5 Tela `/tendencias` + ponte mínima para gerar

- Grade "Explore" (§5.2): card mostra o **hook com slots**, não a legenda original; métricas da
  fonte; status de ingestão.
- Detalhe "Por trás do post": métricas, beats clicáveis, why-it-works, brand fit, assets exigidos.
- Botão "Usar esta tendência": abre um template via `makeNichoTemplate` já com o vídeo de
  referência e o hook preenchidos. O deck de swipe e a tela Goal→assets→Direction completa são
  Fase 5, fora deste escopo.

### Fora do escopo desta fase (registrar, não construir)

- Coletor/crawler automático de tendências por nicho — começar só com importação manual,
  como o próprio plano sugere (§10, Fase 4 item 1).
- Carrosséis de foto (a Orior trata como tipo próprio). Começar só com vídeo.
- Scraping do site da marca.
- Sistema de créditos: não desenhar nada sem decisão de produto/preço do usuário.

## O que não copiar (§10)

64 vozes (ElevenLabs + clonagem já resolvem), 10 modelos expostos (catálogo atual já é enxuto),
Community pública.

## Riscos

- **Direito de uso**: checkbox + original nunca republicado (4.1).
- **Semelhança com pessoa real**: `lib/modelConfig.ts` não tem campo nenhum para esse tipo de
  restrição, e nem eu nem a Claquete verificamos a documentação dos provedores. A Fase 4 não
  expõe escolha de modelo (é só ingestão/análise), então **não bloqueia** — mas é checagem
  obrigatória antes da ponte 4.5 gerar vídeo e antes de qualquer seletor de modelo na Fase 5.
- **Custo**: a ingestão gasta LLM (1 chamada com visão por tendência + 1 barata por marca) e STT
  por minuto de áudio. Na Fase 4 não há créditos; referência de mercado se virar produto: §8.
- **Termos da plataforma**: baixar vídeo de TikTok/IG por ferramenta de terceiros pode violar os
  termos dessas plataformas mesmo com o usuário tendo direito ao conteúdo. O upload de arquivo
  é o caminho sem essa ambiguidade.

## Decisões já confirmadas com o usuário

- Começar pela Fase 4, não pela Fase 1 (briefing, 2026-09-21).
- **LLM (2026-09-21)**: `gemini-3.1-pro` via Kie para a análise com visão (4.3) e
  `gemini-3-flash` para o brand fit (4.4), pelo `/api/assistant` existente. Nenhuma dependência nova.
- **Perfil de marca (2026-09-21)**: entra na Fase 4 como formulário manual (nome, tipo, "o que
  você está construindo"), uma marca só; sem leitura automática do site por enquanto.
- **Persistência (2026-09-21)**: tabelas novas no SQLite — `trends`, `trend_insights` (versionada
  por tentativa), `brands`, `trend_brand_fit` — no padrão de `cloned_voices`. Motivo: a ingestão
  roda no servidor em etapas e o resultado dela é o ativo caro; no navegador ele se perderia.
- **Importação (2026-09-21)**: upload de mp4 **sempre** disponível + link TikTok/IG via `yt-dlp`
  **opcional**, detectado no PATH como o `ffmpeg`. O usuário aprovou ciente do risco de termos de
  uso das plataformas e da fragilidade no Instagram (cookies de login). Descartadas: API paga de
  scraping (custo por chamada, link passa por terceiro) e só-upload (perde o gesto principal e as
  métricas de origem). Comportamento sem `yt-dlp`: o campo de link continua visível; ao colar um
  link o app responde com mensagem clara ("Importar por link precisa do yt-dlp, que não está
  instalado. Instale com `winget install yt-dlp` ou envie o arquivo mp4.") e o upload segue
  funcionando no mesmo fluxo. **O app nunca instala nada sozinho.**

## Perguntas em aberto

- **P5 — Ecossistema Pitch AI**: `lib/pitchai/` já lê o Firestore do Pitch AI (produtos quentes do
  TikTok). Existe lá alguma fonte de vídeos em alta ou sessão de TikTok que substitua o
  resolvedor de link?
