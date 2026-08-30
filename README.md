# Pitch Studio

Novo produto independente do ecossistema Pitch AI para geração e edição leve de imagens e vídeos com IA.

## Estado atual

O repositório contém a primeira vertical slice navegável do workspace:

- fluxo de criação por prompt;
- alternância entre imagem e vídeo;
- seleção de estilo e modelo;
- simulação de geração e consumo de créditos;
- galeria de variações;
- canvas com zoom, ferramentas e ajustes;
- painel de camadas;
- layout responsivo.
- páginas de Projetos, Biblioteca e Brand Kit;
- persistência local de projetos, assets, identidade e créditos.

O repositório já inclui uma API local com jobs assíncronos, abstração de providers, SQLite, fila recuperável, ledger de créditos e storage local de manifests. O provider atual é simulado; autenticação, storage de mídia real, billing e exportação ainda não estão conectados.

## Desenvolvimento

```bash
npm install
npm run dev
```

Abra `http://127.0.0.1:5173`.

O comando inicia o Vite e a API Fastify em `http://127.0.0.1:8787`. Consulte [docs/API.md](docs/API.md) para os contratos.

A biblioteca imersiva de presets e a adaptacao web do efeito Shockwave estao documentadas em [docs/MODEL_PRESETS.md](docs/MODEL_PRESETS.md).

## Validação

```bash
npm run lint
npm run build
```

## Próximas frentes

1. Separar o protótipo em componentes e rotas.
2. Persistir jobs, projetos e assets em PostgreSQL.
3. Adicionar storage e fila durável.
4. Implementar autenticação e billing.
5. Conectar o primeiro provider real de imagem em ambiente de desenvolvimento.
