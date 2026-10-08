# Codex no chat

1. Instale o Codex CLI no computador que executa o Pitch Studio.
2. No chat, selecione **Codex · ChatGPT** no seletor de modelo.
3. Se necessário, clique em **Conectar com ChatGPT**, abra o link da OpenAI e informe o código exibido. Uma sessão existente é reutilizada.
4. Peça, por exemplo: “Monte um workflow vertical de skincare com um ramo de imagem para vídeo. Não gere mídia.”

O login é local ao servidor/computador, compartilhado com o Codex CLI. Esta integração destina-se ao Pitch Studio local, em ambiente confiável. Não é uma autenticação individual de visitantes de um site público. O app não lê nem envia o arquivo de credenciais ao navegador.

O Codex responde à conversa e solicita as mesmas ferramentas dos outros provedores. As fichas são salvas em Personagens; os workflows são abertos pelo cartão na conversa. Retratos continuam usando Kie.ai. Anexos de imagem não são aceitos pelo provedor Codex nesta versão.

A ponte usa `codex exec --json --output-schema`, autenticação salva, diretório temporário isolado, sandbox de leitura e ferramentas de computador desabilitadas. Cada turno retorna texto e chamadas estruturadas; o cliente executa as ações e envia seus resultados ao próximo turno. A resposta aparece ao concluir o turno do Codex, com sinal de espera durante o processamento. Há limite de três minutos por turno.

Variáveis opcionais do servidor:

- `PITCH_CODEX_BIN`: caminho para o executável nativo do Codex. No Windows, o app também procura a instalação em `%LOCALAPPDATA%/Programs/OpenAI/Codex/bin/codex.exe`.
- `PITCH_CODEX_MODEL`: substitui o modelo padrão do CLI. Deve ser um modelo disponível para a conta conectada.

Validação:

```text
node scripts/test-chat.mjs
node scripts/test-codex-chat.mjs
node scripts/test-codex-chat.mjs --live
```

O teste `--live` usa a sessão autenticada e sua cota para solicitar uma chamada de ferramenta, sem executar a criação de dados ou mídia.

Referência: [modo não interativo oficial do Codex](https://developers.openai.com/codex/noninteractive).
