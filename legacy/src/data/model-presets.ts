import type { ModelPreset } from '../types/studio'

export const modelPresets: ModelPreset[] = [
  { id: 'woman-editorial', name: 'Mulher editorial', category: 'people', description: 'Confiante, sofisticada e natural', prompt: 'mulher adulta confiante, retrato editorial sofisticado, expressão natural, iluminação de estúdio premium', spritePosition: '0% 0%', tone: '#6d203f' },
  { id: 'man-classic', name: 'Homem clássico', category: 'people', description: 'Elegante, seguro e versátil', prompt: 'homem adulto elegante, retrato comercial premium, postura confiante, iluminação editorial', spritePosition: '33.333% 0%', tone: '#c55742' },
  { id: 'young-woman', name: 'Mulher jovem', category: 'people', description: 'Contemporânea, criativa e urbana', prompt: 'mulher jovem adulta na faixa dos 20 anos, styling contemporâneo, retrato editorial criativo, luz cinematográfica', spritePosition: '66.666% 0%', tone: '#123b76' },
  { id: 'young-man', name: 'Homem jovem', category: 'people', description: 'Moderno, leve e autêntico', prompt: 'homem jovem adulto na faixa dos 20 anos, visual moderno e autêntico, fotografia comercial, luz suave', spritePosition: '100% 0%', tone: '#0c676b' },
  { id: 'senior-woman', name: 'Mulher sênior', category: 'people', description: 'Experiente, elegante e acolhedora', prompt: 'mulher sênior elegante, retrato digno e acolhedor, textura de pele realista, fotografia editorial premium', spritePosition: '0% 100%', tone: '#33343b' },
  { id: 'child-lifestyle', name: 'Criança lifestyle', category: 'people', description: 'Espontânea, alegre e natural', prompt: 'criança alegre em contexto publicitário apropriado para a idade, roupa casual, expressão espontânea, luz natural', spritePosition: '33.333% 100%', tone: '#a46113' },
  { id: 'golden-dog', name: 'Animal companion', category: 'animals', description: 'Expressivo, amigável e realista', prompt: 'golden retriever amigável, retrato de animal expressivo, fotografia comercial premium, pelagem realista', spritePosition: '66.666% 100%', tone: '#7663a8' },
  { id: 'beauty-product', name: 'Produto beauty', category: 'products', description: 'Minimalista, premium e clean', prompt: 'produto cosmético premium sem marca, still life minimalista, superfície natural, iluminação suave de campanha', spritePosition: '100% 100%', tone: '#d7c5a4' },
]
