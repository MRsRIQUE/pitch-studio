# API de geração

A API local modela o ciclo assíncrono que será usado pelos providers reais.

## Executar

`npm run dev` inicia web e API. A API escuta em `http://127.0.0.1:8787` e o Vite encaminha chamadas `/api` durante o desenvolvimento.

## Endpoints

- `GET /api/health` — saúde do serviço.
- `GET /api/v1/models` — modelos e capacidades disponíveis.
- `GET /api/v1/credits` — saldo persistente do workspace de desenvolvimento.
- `GET /api/v1/assets` — assets persistidos pelo backend.
- `POST /api/v1/generations` — cria um job e retorna HTTP 202.
- `GET /api/v1/generations/:id` — consulta o estado e o resultado.

Estados possíveis: `queued`, `processing`, `succeeded` e `failed`.

## Criar geração

```json
{
  "workspaceId": "demo-workspace",
  "projectId": "project-123",
  "prompt": "Escultura de vidro violeta em um estúdio escuro",
  "kind": "image",
  "modelId": "mock-flux-ultra",
  "aspectRatio": "1:1",
  "style": "3D",
  "brandSnapshot": {
    "name": "Pitch AI",
    "colors": ["#A775FF", "#FF8A98"],
    "headingFont": "Manrope",
    "bodyFont": "DM Sans",
    "voice": "Clara, confiante e inventiva."
  }
}
```

## Providers

Todo provider implementa `MediaProvider`, expondo `listModels()` e `generate()`. O orquestrador conhece apenas essa interface. Credenciais, payloads proprietários, polling e webhooks de cada fornecedor deverão permanecer dentro de seu adaptador.

O `MockProvider` atual não cria arquivos reais; ele permite validar contratos, estados, custos e integração com o frontend sem consumir créditos externos.

Jobs, fila, ledger e metadados de assets são persistidos em SQLite. Consulte [PERSISTENCE.md](PERSISTENCE.md).
