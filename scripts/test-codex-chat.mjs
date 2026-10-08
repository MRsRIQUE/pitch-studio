import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';

const compile = file => ts.transpileModule(readFileSync(new URL(file, import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
const url = code => `data:text/javascript;base64,${Buffer.from(code).toString('base64')}`;
const processUrl = url(compile('../lib/codexProcess.ts'));
const toolsUrl = url(compile('../lib/assistantTools.ts'));
const { FERRAMENTAS_CHAT } = await import(toolsUrl);
const moduleUrl = url(compile('../lib/codexChat.ts').replace('"./codexProcess"', JSON.stringify(processUrl)).replace('"./assistantTools"', JSON.stringify(toolsUrl)));
const { parseCodexReply, codexChatResponse } = await import(moduleUrl);
const { lerTurno } = await import(url(compile('../lib/assistantTurno.ts')));
assert.deepEqual(parseCodexReply('{"text":"Olá","calls":[]}', []), { content: 'Olá' });
const action = JSON.stringify({ text: 'Vou criar.', calls: [{ name: 'criar_workflow', arguments: '{"nome":"UGC"}' }] });
assert.equal(parseCodexReply(action, FERRAMENTAS_CHAT).tool_calls[0].function.name, 'criar_workflow');
assert.throws(() => parseCodexReply(action, []));
assert.throws(() => parseCodexReply('{"text":"","calls":[{"name":"criar_workflow","arguments":"null"}]}', FERRAMENTAS_CHAT));
assert.throws(() => parseCodexReply('not json', []));
assert.throws(() => parseCodexReply('{"text":null,"calls":[]}', []));
console.log('Codex adapter: text, allowed tools, invalid JSON and invalid arguments passed.');

if (process.argv.includes('--live')) {
  const { codexChatStatus } = await import(processUrl);
  const status = await codexChatStatus();
  console.log('Codex status:', JSON.stringify(status));
  assert.equal(status.ready, true, 'Connect Codex before running the live test.');
  const signal = AbortSignal.timeout(180000);
  const response = await codexChatResponse([
    { role: 'system', content: 'Teste de integração do Pitch Studio. Quando solicitado um workflow, retorne a chamada criar_workflow. Não use ferramentas do computador.' },
    { role: 'user', content: 'Crie um workflow vazio chamado Teste Codex. Apenas solicite a ação ao aplicativo.' },
  ], 'chat', signal);
  assert.equal(response.status, 200);
  const turn = await lerTurno(response.body, () => {});
  assert.equal(turn.falha, null, turn.falha || 'Provider error');
  assert.ok(turn.chamadas.some(c => c.name === 'criar_workflow' && c.arguments.nome === 'Teste Codex'), JSON.stringify(turn));
  console.log('Live ChatGPT session: received a valid workflow tool call. No application data or media was created.');
}
