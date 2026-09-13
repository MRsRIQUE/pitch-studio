# Workflow — implementação do inventário NewTake

Referência: `newtake-inventario-funcional.md`, levantamento de 08/09/2026.

## Entregue

- Menu e canvas com Áudio, Roteiro, Director Studio, Smart Edit, Smart Breakdown e Director Console, incluindo handles, conexões, persistência, exportação e undo.
- Roteiro com geração assistida, referências de imagem, extração de assets, storyboard em lotes, síntese de prompts e geração de imagens de referência.
- Áudio com upload persistente, player, TTS, música, SFX, isolamento vocal, vozes ElevenLabs, polling Kie.ai, recorte e efeitos locais.
- Smart Edit com timeline de clipes, cortes, velocidade, volume, BGM/narração, plano de montagem por IA e renderização MP4.
- Smart Breakdown com análise FFmpeg, detecção de mudanças de plano, frames, duração e estatísticas de áudio, enviando a decupagem ao Roteiro.
- Director Console com viewport Three.js, órbita, transformação, personagens articulados, poses, objetos, câmeras, keyframes, upload de GLB/panorama, composição assistida e capturas PNG/WebM.
- Studio Tools para imagem e vídeo: crop, upscale, iluminação, outpaint, cutout, máscara, grid split, repaint, erase, foco, lente, panorama, multiângulo, recorte e separação de áudio/vídeo.
- Histórico de gerações, biblioteca local, compartilhamento somente leitura por token e cópia do workflow compartilhado para o canvas.

As integrações externas usam as credenciais já suportadas pelo projeto (Kie.ai, ElevenLabs e provedor de IA configurado). Sem essas chaves, a interface e as operações locais continuam disponíveis, enquanto as ações pagas retornam uma mensagem de configuração.

## Validação

- `npx tsc --noEmit --incremental false` — aprovado.
- `npm run build` — aprovado; apenas avisos preexistentes do Edge Runtime/Open External.
- `node scripts/test-production.mjs` — aprovado para grupos, prompts, pipeline, direção e áudio.
- Playwright em `http://localhost:3011` — menu, criação de Roteiro, edição, síntese de prompt, storyboard, Director Console e persistência após reload.
- API de mídia — upload WAV, grid split, composição e rotas de produção verificadas.

O código principal está em `components/nodes`, `lib/production*` e `app/api/production`.
