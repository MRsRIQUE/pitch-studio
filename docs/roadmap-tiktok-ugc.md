# Frente UGC/TikTok — mapa do que existe vs. o que falta

Nota de trabalho da frente "templates e recursos de vídeo" (papel Claquete no Maestri).
Objetivo do produto: virar plataforma completa de criação de UGC e vídeo para TikTok,
inspirada em makeugc.ai, vmake.ai/workspace e 3xapp.shop/app. Ver também
`docs/workflow-newtake-implementacao.md`, que documenta a suíte de Produção (Smart Edit,
Smart Breakdown, Áudio, Roteiro, Director Console) entregue antes desta frente — a base
sobre a qual este mapa constrói.

## Estado atual (2026-09-13)

Itens 1, 2, 3, 5 e 6 commitados no branch `feat/sync-heliosgen` (commit `942c1f1`, conferido
pelo usuário com `git show --stat` + `tsc --noEmit`). Item 4 tem sua Fase 1 (multi-trilha, sem
transições/stickers) implementada e testada de ponta a ponta nesta sessão — **ainda não
commitada**. O que falta:

- **Testar com uma chave ElevenLabs real**: transcrição (item 1), clonagem de voz (item 2) e o
  fluxo completo da legenda queimada (item 3) seguem a documentação oficial da API, mas não
  foram exercitados contra o serviço real nesta sessão (sem chave conectada).
- **Item 4**: Fase 1 pronta e testada (ver seção própria abaixo) — falta commitar, e falta
  alinhar com o usuário antes de atacar as fases seguintes (transições, stickers).
- **Item 7**: só registrado no mapa abaixo, sem construção.

## O que já existe (não reconstruir)

- **Troca de personagem/produto em vídeo pronto** — `lib/templates.ts` →
  `makeTrocaPessoaTemplate()`. Vídeo de referência (`referenceVideo`) + até duas imagens de
  recurso (`resource`: personagem/produto) + prompt → `seedance-2-5-edit`. É o mesmo truque
  do "Genjutsu" da Higgsfield.
- **UGC starter** — `makeUGCTemplate()`: 4 colunas texto→imagem→vídeo independentes,
  `seedance-2` + `nano-banana-pro`, formato 9:16.
- **Smart Breakdown** (`smartBreakdownNode`, componente `ProductionTimeline` modo
  `"breakdown"`) — `components/nodes/ProductionTimeline.tsx` + `ProductionNode.tsx`. Detecta
  cortes de plano via FFmpeg local (`/api/production/media` `operation:"analyze"`), extrai
  frame por plano e **descreve** cada plano com IA de visão (lotes de 6 frames,
  `gemini-3.1-pro` por padrão) — cena, enquadramento, iluminação, movimento inferido. O
  prompt de análise diz explicitamente **"não invente falas ou sons não fornecidos"**: hoje
  não existe transcrição real, só descrição visual. Resultado pode ser enviado para um
  `scriptNode` (Roteiro).
- **Smart Edit** (`smartEditNode`, mesmo componente, modo `"edit"`) — corta/reordena/concatena
  clipes conectados (`videoRef`), aplica plano de corte sugerido por IA, mixa uma trilha de
  música (`bgmUrl`) e uma de narração (`narrationUrl`) com volumes independentes, renderiza em
  4 formatos fixos (720p/1080p 16:9, 1080p 9:16, 1080p 1:1) via `/api/production/media`
  `operation:"compose"`. Sem múltiplas trilhas de texto, sem overlay de legenda, sem
  transições/stickers — é corte + mixagem, não um editor de timeline visual.
- **Áudio** (`audioNode`, componente `AudioStudio.tsx`) — `app/api/production/audio/route.ts`.
  TTS (fala multilíngue `eleven_multilingual_v2`/`eleven_v3`, ou Turbo 2.5 via Kie.ai), música
  (`music_v1`), SFX (`eleven_text_to_sound_v2`), isolamento vocal (`audio-isolation`). Vozes:
  só `GET ?voices` lista as já existentes na biblioteca ElevenLabs da conta conectada — **não
  há clonagem**. Kie.ai funciona como proxy assíncrono alternativo para fala/isolamento
  (`taskId` + polling).
- **`/personagens`** (`app/personagens/page.tsx`) — gera personagens consistentes (retrato +
  descrição) reutilizáveis como `resource` nos templates.
- **Catálogo de modelos de vídeo** — `lib/modelConfig.ts` → `VIDEO_MODELS`: Veo 3.1
  (lite/fast/padrão), Gemini Omni Video, Kling 3.0 (+ turbo, + motion-control 2.6/3.0), Grok
  Imagine (+ 1.5 preview), Seedance 2 (padrão/fast/mini), Seedance 2.5 (+ edit), Happyhorse,
  MiniMax H3. Novos templates devem reaproveitar esse catálogo em vez de inventar modelo.
- **Como um template vira uma opção na UI** — dois pontos de registro, sempre os dois:
  `lib/receitas.ts` (`AcaoReceita`, tipo `"template"`, função `abrirTemplate`) e
  `components/WorkflowDashboard.tsx` (constante `..._TEMPLATE_NAME`, `TEMPLATE_NAMES`,
  `handleLoad.../handleReset...`). Um template novo em `lib/templates.ts` sem esses dois fica
  invisível na Home.

## O que falta — 7 prioridades

1. **Transcrição real de fala (speech-to-text)** do vídeo de origem — ✅ implementado
   (2026-09-13). `app/api/production/audio/route.ts` ganhou a operação `"transcribe"`
   (ElevenLabs Speech-to-Text, modelo `scribe_v2`, `timestamps_granularity:"word"`). O Smart
   Breakdown (`ProductionTimeline.tsx`, modo `breakdown`) chama essa operação quando há trilha
   de áudio e a opção "Transcrever fala" está marcada (padrão ligado), recorta o texto real por
   plano a partir dos timestamps por palavra e preenche `Shot.dialogue` com a fala de verdade —
   a análise visual por IA deixa de tocar nesse campo quando há transcrição real (só continua
   "adivinhando" quando não há áudio ou a transcrição falha/está desligada). Os timestamps por
   palavra ficam salvos em `data.transcriptWords` no node, prontos para alimentar a legenda
   palavra-a-palavra do item 3 sem re-transcrever.
2. **Clonagem de voz** — ✅ implementado (2026-09-13). `app/api/production/audio/route.ts`
   ganhou as operações `"clone-voice"` (`POST /v1/voices/add`, Instant Voice Cloning — envia a
   amostra via `multipart/form-data`, campo `files`) e `"delete-voice"` (`DELETE
   /v1/voices/{voice_id}`), mais `GET ?clonedVoices=1` para listar as vozes já clonadas. Tabela
   nova `cloned_voices` em `lib/guest/sqlite.ts` (`id, user_id, voice_id, name, source_url,
   created_at`) com acesso via `insertClonedVoice`/`getClonedVoices`/`deleteClonedVoice` em
   `lib/guest/db.ts`, seguindo o mesmo padrão de `uploads`. A tabela local é só metadado de
   proveniência (nome, amostra de origem, data) — a voz em si já aparece automaticamente no
   seletor de vozes existente (`GET ?voices=1`) assim que clonada, porque a ElevenLabs já inclui
   vozes clonadas na listagem da conta. UI nova em `AudioStudio.tsx`: seção "Clonar voz" com
   upload de amostra, nome, lista das vozes já clonadas com botão remover.
3. **Legenda estilo TikTok queimada no vídeo**, destaque palavra a palavra — ✅ implementado
   (2026-09-13), como extensão pontual do Smart Edit (decisão confirmada: não esperar o editor
   completo do item 4). Botão "Gerar legenda estilo TikTok" em `ProductionTimeline.tsx` (modo
   `edit`): transcreve a montagem já renderizada (`data.videoUrl`) via `/api/production/audio`
   `operation:"transcribe"` — decisão deliberada de retranscrever a saída final em vez de
   reaproveitar `transcriptWords` do Smart Breakdown, porque o corte/reordenação/mixagem do
   Smart Edit desalinha os tempos da fonte original; transcrever a montagem final garante que a
   legenda bate com o vídeo que será postado, funcione a fala com dialogo original ou narração
   TTS mixada. A operação `"caption"` nova em `lib/productionMedia.ts` agrupa as palavras em
   linhas (~4 palavras ou corte por pausa >0.6s), gera uma legenda `.ass` (uma `Dialogue` por
   palavra, reescrevendo a linha toda com só a palavra atual em destaque amarelo — a técnica
   padrão de "karaokê" para preservar centralização/quebra de linha do libass) e queima via
   `ffmpeg -vf subtitles=captions.ass`. Estilo fixo (não configurável, por decisão do usuário):
   texto grande, contorno preto grosso, destaque amarelo na palavra falada, alinhado no
   terço inferior. **Validado de ponta a ponta** (2026-09-13) com um vídeo sintético 1080×1920
   gerado pelo próprio ffmpeg (sem precisar de chave ElevenLabs): o `ffmpeg` local deste
   ambiente é `8.1-full_build (gyan.dev)` com `--enable-libass` presente, o `.ass` gerado por
   `buildCaptionAss` (agora extraída como função pura testável em `lib/productionMedia.ts`)
   parseia sem erro, e o frame extraído confirma visualmente o efeito esperado — texto branco
   com contorno preto, palavra atual em amarelo, quebra de linha automática pelo libass, no
   terço inferior do quadro. O que **não** foi testado por falta de chave ElevenLabs nesta
   sessão: a chamada real a `operation:"transcribe"` (item 1) e `operation:"clone-voice"`/
   `"delete-voice"` (item 2) — a integração segue a documentação oficial da API (endpoints,
   campos e formato de resposta confirmados via busca antes de implementar), mas o usuário
   deve validar com uma chave real antes de considerar esses dois itens 100% prontos.
4. **Editor mais completo estilo CapCut** — múltiplas trilhas, texto/legenda estilizável,
   transições, stickers. **Fase 1 implementada e testada (2026-09-13)** — ver seção própria
   "Item 4 — editor multi-trilha, Fase 1" mais abaixo para todo o detalhe técnico e de
   validação. Faltam as fases seguintes (transições, stickers), que aguardam alinhamento com o
   usuário antes de construir.
5. **Templates de TikTok para postar** — ✅ implementado (2026-09-13). 5 categorias em
   `lib/templates.ts`: `makeFitnessTemplate`, `makeBelezaTemplate`, `makeUnboxingTemplate`,
   `makeDepoimentoTemplate`, `makeComparacaoTemplate` (+ suas `*_TEMPLATE_NAME`), todas
   registradas como `TemplateCard` em `components/WorkflowDashboard.tsx` (reaproveitando o
   ícone `TrocaPessoaArt` existente — nenhuma arte nova). Todas compartilham uma fábrica
   interna `makeNichoTemplate` que reaproveita 100% o motor de `makeTrocaPessoaTemplate`
   (vídeo de referência + `seedance-2-5-edit`, handles `referenceVideo`/`resource`/`prompt`,
   nenhum node/handle novo) — só muda o texto do comentário de instruções e o prompt. Diferença
   real de produto: o prompt de cada template já vem com **duas falas** (gancho em ~2s, CTA em
   ~15s de exemplo) em vez de uma só, porque "gancho nos 3s + CTA no final" é sobre roteiro, não
   sobre mecânica de template — para isso, `TrocaDePessoa.fala` (única) virou `falas: Fala[]`
   em `lib/ugcPromptKit.ts` (breaking change controlado: único call site era
   `makeTrocaPessoaTemplate`, migrado junto) e `produto` (único) virou `produtos: string[]`
   para suportar o template de comparação (2 produtos lado a lado, prompt gerado dinamicamente
   como "hold @A in one hand and @B in the other"). Comentário de cada template já avisa o
   usuário para mover o segundo do CTA para o fim do SEU vídeo de referência (a duração real só
   se sabe depois do upload). Validado estruturalmente com um script standalone (fora do repo):
   contagem de nós/edges, handles corretos, prompt contendo `@Personagem`/`@Produto*` e as duas
   falas — não requer chave de API para esse teste. **Não feito de propósito**: não adicionei
   entradas em `lib/receitas.ts` (a lista curada de "Receitas" com resumo/passos/crédito) — é
   decisão de conteúdo/copy, não de arquitetura, e o `WorkflowDashboard.tsx` já é o caminho
   funcional principal para abrir os templates.
6. **Templates de TikTok LIVE** — ✅ implementado (2026-09-13), como UM template combinado
   (`makeLiveTemplate`/`LIVE_TEMPLATE_NAME = "TikTok Live — Apoio (não automação)"` em
   `lib/templates.ts`, ícone próprio `LiveArt` no dashboard — clipboard + selo vermelho, para
   não parecer os cards de vídeo-pronto-pra-postar). Combinei os dois pedidos num só grafo
   porque servem à mesma live: (a) **vitrine em loop** — o usuário solta a foto do produto,
   o prompt (`seedance-2`, 9:16, sem som) pede uma órbita de 360° que termina no mesmo ângulo em
   que começou, pra tocar em loop sem corte perceptível como fundo/janela secundária; (b)
   **roteiro da live** — um segundo `commentNode` com um roteiro completo pronto pra ler/adaptar
   (abertura, apresentação, prova social, oferta+urgência, objeções, CTA de seguir, encerramento),
   servindo de teleprompter manual — decidi não construir um componente de teleprompter com
   rolagem automática porque não existe esse tipo de node hoje e não foi pedido como obrigatório
   ("teleprompter OU roteiro"); um texto pronto pra ler já entrega o valor. Um terceiro
   `commentNode` (aviso, o primeiro do grafo) é explícito: **nunca** tocar só a vitrine sozinha
   no lugar de uma live de verdade — reforça a mesma restrição do briefing sobre o padrão do
   3xapp.shop. Nenhum node/handle novo (reaproveita `imageInputNode`→`startFrame`,
   `promptNode`→`prompt`, `videoGeneratorNode`, `commentNode`, todos sem edges nos comentários
   porque são só anotação). Validado estruturalmente com o mesmo tipo de script standalone dos
   templates de nicho.
7. **Roadmap de prioridade menor** (registrar, não construir ainda): tradutor/dublagem com
   sincronismo labial (vmake.ai), upscaler e reframe automático 16:9↔9:16↔1:1, modo assistente
   linear guiado (roteiro→avatar→gerar) por cima do canvas de nós para usuários não-técnicos
   (inspirado no wizard de 6 passos do 3xapp.shop).

## Item 4 — editor multi-trilha, Fase 1 (2026-09-13)

**Decisão de arquitetura confirmada**: componente/tela nova (overlay em tela cheia, `createPortal`
no `document.body`, `z-index:100000`, mesmo padrão de `MediaPickerModal.tsx`), **não** estender
`ProductionTimeline`/`smartEditNode`. Motivo: um editor multi-trilha de verdade precisa de
arraste contínuo (corte, reordenar, playhead) que entra em conflito direto com os gestos do
`@xyflow/react` (pan/zoom/marquee) — o código atual já usa `nodrag nowheel` como remendo pra uma
UI bem mais simples. O Smart Edit atual continua exatamente como está; um botão novo "Abrir
editor completo (multi-trilha)" no Smart Edit abre a tela nova, pré-carregada com os clipes já
adicionados (recalculando offsets sequenciais + reprobando duração real de cada um).

**Fase 1 = só multi-trilha** (decisão confirmada, sem transições nem stickers ainda):

- `lib/timelineEditor.ts` — tipos compartilhados (`Timeline`, `TimelineClip`, `TimelineText`) e
  helpers puros, sem dependência de servidor.
- `lib/productionMedia.ts` — nova operação `compose-multitrack`: N trilhas de vídeo/imagem
  sobrepostas (posição x/y/escala normalizados 0-1) via `overlay=...:enable='between(t,...)'`
  do ffmpeg, com `trim`+`setpts` pra alinhar cada clipe no ponto certo da timeline global, mais
  uma trilha de texto via `drawtext` (fonte explícita `arialbd.ttf`, copiada pro diretório
  temporário — **`drawtext` sem fontconfig configurado falha ao resolver fonte por nome**,
  diferente do `subtitles`/libass da legenda do item 3, que usa a API nativa de fonte do
  Windows). Áudio: mixa o áudio de cada clipe de vídeo não mudo (realinhado com `atrim`+`asetpts`)
  + bgm (em loop) + narração via `amix`, sempre incluindo uma base de silêncio com
  `duration=longest` pra garantir que o áudio cobre a timeline inteira mesmo com trilhas de
  vídeo cheias de buracos.
- `components/nodes/TimelineEditor.tsx` + `timeline.css` — a UI: trilhas horizontais com caixas
  arrastáveis (mover = tempo + trilha; alças nas bordas = cortar início/fim), trilha de texto
  dedicada, painel de propriedades do item selecionado, preview do clipe selecionado (**sem
  composição ao vivo** — decisão deliberada de escopo: renderiza pra ver o resultado final,
  igual ao Smart Edit de hoje), zoom da régua, upload direto de vídeo/imagem novos.

**Validação real feita** (não só `tsc`/`eslint`):
1. Backend: script standalone com clipes sintéticos (vermelho/verde/azul/imagem amarela +
   texto + bgm em loop) via ffmpeg puro — **achei e corrigi 2 bugs reais**: (a) `inputIndex`
   sendo reaproveitado tanto pra índice de input do ffmpeg quanto pra sufixo de rótulo dos
   overlays, inflando o índice usado pra bgm/narração; (b) `drawtext` sem fonte explícita falha
   com `Fontconfig error` neste ambiente. Depois da correção, validei visualmente (frames
   extraídos) que overlay, imagem, texto e áudio aparecem/somem nos instantes certos.
2. Frontend: subi o dev server (já rodando na 3000) e testei o componente isolado numa página
   temporária (`app/test-timeline-editor/`, removida depois), via Chrome automation +
   `javascript_tool` pra despachar `PointerEvent`s reais (a ação `left_click_drag` da ferramenta
   de automação não sintetiza um evento de ponteiro completo — sem `button`/`isPrimary`/
   `pointerType`, o que por si só não aciona o `onPointerDown`; um `PointerEvent` construído à
   mão com essas propriedades funciona igual a um mouse de verdade). **Achei e corrigi um bug
   real de robustez**: `setPointerCapture` lança `NotFoundError` quando chamado sem estar
   envolto em try/catch e o navegador não reconhece o ponteiro como "ativo" (o que só acontece
   com dispatch 100% sintético, não com mouse/touch real — mas o código não tinha proteção).
   Depois de blindar com try/catch, confirmei mover clipe, cortar início, cortar fim e mover
   texto, todos com a matemática exata esperada e sem exceção no console.
3. **Não testado**: o botão "Renderizar e usar" de ponta a ponta dentro do app de verdade (o
   seed de teste usava URLs `r2.dev` externas, que `mediaBytes()` rejeita de propósito — só
   aceita mídia já importada pro acervo local; isso não é bug, é a mesma trava de segurança que
   todas as outras operações de `lib/productionMedia.ts` já têm). O caminho de upload
   (`+ Vídeo`/`+ Imagem`) segue o mesmo padrão já comprovado de `AudioStudio.tsx`/
   `ProductionNode.tsx` (`/api/upload-asset`), não testado ao vivo mas de baixo risco por
   precedente direto.

**O que falta pra fases seguintes** (não construir sem alinhar de novo): transições entre
clipes adjacentes (`xfade`), stickers (overlays de imagem arrastáveis sobre o preview, distintos
de "clipe em trilha" porque tipicamente não ocupam uma trilha de vídeo inteira), e — se o usuário
quiser depois — uma preview ao vivo composta (canvas + múltiplos `<video>` ocultos), que é um
projeto à parte em complexidade.

## Decisões já confirmadas com o usuário (2026-09-13)

- **STT (item 1):** ElevenLabs Speech-to-Text — implementado, ver item 1 acima.
- **Vozes clonadas (item 2):** persistir numa tabela nova no SQLite — ✅ implementado, ver item 2
  acima.
- **Ordem de ataque confirmada:** STT (item 1, feito) → legenda queimada no Smart Edit usando os
  timestamps do item 1 (item 3) → clonagem de voz em paralelo (item 2) → templates de nicho
  (item 5) → templates de LIVE (item 6) → editor multi-track completo (item 4, por último) →
  itens 7 registrados sem data.

## Perguntas em aberto (decisões de arquitetura ainda não alinhadas)

- **Legenda queimada (item 3) e editor (item 4):** a legenda estilo TikTok pode nascer como uma
  opção dentro do Smart Edit atual (overlay simples renderizado no FFmpeg de
  `/api/production/media`) sem esperar o editor completo — desacoplar os dois entregaria valor
  mais cedo. Confirmar se faz sentido essa ordem (legenda antes do editor completo) ou se o
  usuário prefere o editor multi-track já nascer com legenda embutida.
- **UI do editor multi-track (item 4):** estender `ProductionTimeline`/`smartEditNode` (reusa
  handles e nó existentes) vs. node/tela nova dedicada. Componente novo custa mais para
  construir mas evita sobrecarregar um componente que já faz corte + IA + mixagem + preview.

## Plano de ataque confirmado (detalhamento passo a passo)

1. ✅ STT com timestamps por palavra no Smart Breakdown (item 1) — desbloqueia roteiro real E
   fornece os dados para legenda palavra-a-palavra.
2. ✅ Legenda estilo TikTok queimada no Smart Edit (item 3), transcrevendo a montagem final em
   vez de reaproveitar os timestamps do passo 1 (ver justificativa no item 3 acima).
3. ✅ Clonagem de voz na ElevenLabs (item 2).
4. ✅ Templates de post por nicho reaproveitando `makeTrocaPessoaTemplate` (item 5).
5. ✅ Templates de LIVE (apoio, não automação) (item 6).
6. ✅ Editor multi-trilha (item 4) — **Fase 1** (sem transições/stickers): multi-trilha de
   vídeo/imagem + texto, testada de ponta a ponta (ver seção própria). Fases seguintes
   (transições, stickers) aguardam alinhamento com o usuário. **Próximo passo: revisar com o
   usuário e decidir se avança de fase, ou commit + pausa.**
7. Itens de menor prioridade (item 7) ficam registrados, sem data.
