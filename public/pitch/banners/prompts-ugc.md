# Prompts — banners da home (imagem → vídeo)

Fluxo em duas etapas: gera a **imagem** (frame inicial), aprova, depois anima
com image-to-video (`start_image`). A imagem é só o **fundo**: o texto do banner
entra depois, por composição — modelo de imagem/vídeo erra tipografia.

## Os 3 banners (`bannersHome` em `components/home/BannerCarrossel.tsx`)

| # | Banner | Texto que vai por cima | Ação |
|---|---|---|---|
| 1 | Workflow UGC | TEMPLATE PRONTO / **Workflow UGC** / Quatro roteiros, quatro vídeos, um clique. | abre o template |
| 2 | Modelo em destaque | MODELO EM DESTAQUE / **Seedance 2.5** / Vídeo com áudio, até 30 segundos. | abre o Criar |
| 3 | Inspiração | INSPIRAÇÃO EM DESTAQUE / **O que já foi criado** / Remixe qualquer geração… | abre a Inspiração |

## Especificação comum

| Item | Imagem | Vídeo |
|---|---|---|
| Proporção | 16:9 | 16:9 (banner 750×280 corta o centro, `object-fit: cover`) |
| Resolução | 1920×1080+ | 1080p |
| Duração | — | 5 s, loop, sem áudio |
| Composição | sujeito no **terço direito**, metade esquerda limpa (área do texto) | mesma |
| Sem | texto, legenda, logo, marca d'água, UI, mãos deformadas | idem + cortes, tremor |

**Negative prompt (imagem e vídeo):**
`text, letters, captions, watermark, logo, on-screen UI, distorted hands, extra fingers, blurry, low quality`

---

## 1. Workflow UGC — `banner-workflow-ugc`
Paleta do SVG: escuro #0B0A18 → #241C4D, brilho roxo #4318FF à direita. Texto branco por cima.

**Imagem**
```
UGC TikTok Shop creator photo, landscape 16:9. A young woman in a dim home studio,
positioned on the right third of the frame, holding a smartphone in portrait
orientation toward the camera, smiling mid-sentence. Behind her, four small ring
lights glow deep purple in soft bokeh. Purple LED strip rim light on her hair and
shoulder. Left half of the frame is dark, empty, near-black navy. Phone-camera
aesthetic, shallow depth of field, cinematic contrast, dark navy and violet palette.
Photorealistic. No text, no UI on the phone screen.
```

**Movimento (image-to-video)**
```
She talks to the camera with small natural gestures, slightly tilting the phone.
Ring lights pulse gently. Subtle handheld drift. Slow, continuous, loopable. No cuts.
```

## 2. Modelo em destaque (Seedance 2.5) — `banner-modelo-destaque`
Paleta do SVG: claro #F5F2FF → #C3B4FF, brilho #868CFF à direita. Texto roxo #2C04D7 por cima.

**Imagem**
```
Bright airy UGC product photo, landscape 16:9. Close-up of a creator's hands
holding a small premium skincare bottle with a blank label, on a white marble table,
placed on the right third of the frame. Soft window daylight, pastel lavender and
lilac tones, gentle lens flare. Left half of the frame is a clean pale-lavender
gradient background. Phone-shot aesthetic, shallow depth of field. Photorealistic.
No text on the label, no logo, no UI.
```

**Movimento (image-to-video)**
```
Hands slowly rotate the bottle toward the camera, light glides across the glass.
Soft lens flare drifts. Slow, smooth, loopable. No cuts.
```

## 3. Inspiração — `banner-inspiracao`
Paleta do SVG: claro #EFEBFC → #B9AEE4, grade masonry de 4 colunas à direita. Texto roxo #2C04D7 por cima.

**Imagem**
```
Landscape 16:9 photo of a wall with a staggered masonry grid of vertical phone
screens, four columns, on the right side of the frame. Each screen shows a
different short creator clip: a woman trying on a jacket, a man reviewing
headphones, hands holding a coffee mug, a kitchen gadget demo. Screens glow soft
lilac; the room is pale lavender and white, minimal. Left half of the frame is an
empty softly lit pale wall. Photorealistic, clean. No readable text on the
screens, no logos, no UI.
```

**Movimento (image-to-video)**
```
Each screen plays its clip with subtle motion; the camera pushes in very slowly.
Soft glow shifts on the wall. Calm, continuous, loopable. No cuts.
```

---

## Depois de gerar
1. Imagens em `public/pitch/banners/src/` (`workflow-ugc.png`, `modelo-destaque.png`, `inspiracao.png`) — servem de `poster`.
2. Vídeos em `public/pitch/banners/` com o mesmo nome `.mp4`.
3. Eu componho: corte 750×280 + gradiente + texto dos SVGs sobre o clipe, e preencho `videoUrl`/`imageUrl` no `BannerCarrossel.tsx`.
