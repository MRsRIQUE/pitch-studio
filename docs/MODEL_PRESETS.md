# Presets de persona

Pontos de partida visuais para a geração. O preset escolhido **complementa** o
prompt do usuário — não representa uma identidade fixa e nunca inicia uma
geração automaticamente.

## Estado atual

Os presets vieram do protótipo original e hoje vivem em
[`lib/modelPresets.ts`](../lib/modelPresets.ts). **Ainda não estão ligados à
interface** — a reintegração faz parte do re-skin.

## Taxonomia

Cada preset tem identificador estável, nome, categoria, descrição, prompt-base,
posição no sprite e cor de destaque. A coleção inicial cobre:

| Categoria | Presets |
| --- | --- |
| `people` | mulher editorial, homem clássico, mulher jovem, homem jovem, mulher sênior, criança lifestyle |
| `animals` | animal companion |
| `products` | produto beauty |

O sprite com as 8 miniaturas está em `public/pitch/persona-presets-v1.png`, numa
grade 4×2; `spritePosition` é o `background-position` de cada célula.

As próximas dimensões recomendadas são estilo, enquadramento, proporção, uso e
Brand Kit. A interface deve evitar filtros baseados em atributos sensíveis,
inferências pessoais ou condições de saúde.

## Shockwave

O componente de referência da Reactix depende de React Native, Skia, Reanimated
e Worklets. Como o Pitch Studio é web, o efeito foi reinterpretado como uma onda
radial em CSS disparada a partir da posição do clique.

Essa versão usa apenas `transform` e `opacity`, e desativa a animação quando o
sistema indica `prefers-reduced-motion: reduce`.

- Componente: [`components/Shockwave.tsx`](../components/Shockwave.tsx)
- Estilos: seção `PITCH STUDIO — SHOCKWAVE` em `app/globals.css`

## Antes de conectar modelos reais

- validação server-side do catálogo de presets;
- política de conteúdo por provider;
- controles de consentimento para referências de pessoas reais.
