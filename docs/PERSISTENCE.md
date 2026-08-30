# Persistência local

O desenvolvimento usa `node:sqlite`, sem serviço externo ou dependência nativa adicional. O arquivo padrão é `data/pitch-studio.db` e não entra no Git.

## Dados persistidos

- `generation_jobs`: entrada, provider, custo, estado e resultado.
- `queue_jobs`: estado da execução, tentativas e lock.
- `assets`: vínculo com geração, MIME type, storage key e metadados.
- `credit_accounts`: saldo atual por conta.
- `credit_ledger`: débitos e reembolsos imutáveis.

O storage local grava um manifesto por asset em `data/assets`. O provider mock ainda não produz mídia binária.

## Invariantes

- créditos nunca podem ficar negativos;
- o débito acontece antes do job entrar na fila;
- uma falha reembolsa o débito uma única vez;
- um asset pertence a uma única geração;
- toda nova geração e asset pertencem a um workspace e projeto;
- o snapshot do Brand Kit usado fica dentro do input imutável da geração;
- jobs interrompidos em `queued` ou `processing` são recuperados na inicialização;
- o ledger não aceita duas entradas do mesmo tipo para a mesma geração.

## Produção

SQLite é adequado para desenvolvimento local e uma única instância. Antes de escalar horizontalmente, os repositórios deverão receber implementações PostgreSQL e a fila deverá migrar para um mecanismo com locks distribuídos. A interface de providers e o domínio de geração não dependem diretamente do SQLite.

Gates obrigatórios antes de produção: migrações de schema versionadas, `locked_by` por worker, recuperação periódica de locks expirados, limite global de concorrência e monitoramento de espaço do storage.
