# Biblioteca de modelos visuais

A tela **Modelos** oferece pontos de partida visuais para a geracao. O preset escolhido complementa o prompt do usuario, mas nao representa uma identidade fixa e nunca inicia uma geracao automaticamente.

## Experiencia

- mosaico imersivo inspirado em galerias editoriais;
- filtros por pessoas, animais e produtos;
- embaralhamento para exploracao;
- foco no hover e selecao explicita;
- acao **Usar no editor** para confirmar a escolha;
- retorno ao editor preservando projeto, prompt, formato e demais configuracoes.

## Shockwave no navegador

O componente de referencia da Reactix depende de React Native, Skia, Reanimated e Worklets. Como o Pitch Studio e uma aplicacao web, o efeito foi reinterpretado como uma onda radial em CSS, disparada a partir da posicao do clique.

Essa versao evita uma dependencia grafica pesada, usa apenas `transform` e `opacity` e desativa a animacao quando o sistema indica `prefers-reduced-motion: reduce`.

## Taxonomia inicial

Cada preset possui identificador estavel, nome, categoria, descricao, prompt-base e posicao no sprite. A primeira colecao cobre:

- mulher adulta;
- homem adulto;
- mulher jovem adulta;
- homem jovem adulto;
- mulher senior;
- crianca em contexto seguro e apropriado para a idade;
- animal de companhia;
- produto de skincare.

As proximas dimensoes recomendadas sao estilo, enquadramento, proporcao, uso e Brand Kit. A interface deve evitar filtros baseados em atributos sensiveis, inferencias pessoais ou condicoes de saude.

## Contrato de geracao

O cliente envia `presetId` junto ao input da geracao. O servidor ja aceita o campo opcional, permitindo que um provider futuro resolva o prompt-base e registre qual preset originou cada asset.

Antes de conectar modelos reais, devem ser adicionados validacao server-side do catalogo, politica de conteudo por provider e controles de consentimento para referencias de pessoas reais.
