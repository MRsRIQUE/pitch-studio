import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';

const compile = file => ts.transpileModule(readFileSync(new URL(file, import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
const url = code => `data:text/javascript;base64,${Buffer.from(code).toString('base64')}`;
const schemas = await import(url(compile('../lib/assistantTools.ts')));
assert.ok(!schemas.ferramentasOpenAI().some(t => t.function.name === 'criar_personagem'));
assert.deepEqual(schemas.ferramentasAnthropic(true).map(t => t.name), schemas.ferramentasOpenAI(true).map(t => t.function.name));
const { lerTurno } = await import(url(compile('../lib/assistantTurno.ts')));
const stream = events => {
  const bytes = new TextEncoder().encode(events.map(e => `data:${JSON.stringify(e)}`).join('\n'));
  return new ReadableStream({ start(controller) { for (let i = 0; i < bytes.length; i += 3) controller.enqueue(bytes.slice(i, i + 3)); controller.close(); } });
};
const openai = await lerTurno(stream([
  { choices: [{ delta: { content: 'Olá, criação!' } }] },
  { choices: [{ delta: { tool_calls: [{ index: 0, id: 'c1', function: { name: 'criar_personagem', arguments: '{"nome":' } }] } }] },
  { choices: [{ delta: { tool_calls: [{ index: 0, function: { arguments: '"Ana"}' } }] } }] },
]), () => {});
assert.equal(openai.texto, 'Olá, criação!');
assert.deepEqual(openai.chamadas, [{ id: 'c1', name: 'criar_personagem', arguments: { nome: 'Ana' } }]);
const anthropic = await lerTurno(stream([
  { type: 'content_block_start', index: 1, content_block: { type: 'tool_use', id: 'a1', name: 'criar_workflow' } },
  { type: 'content_block_delta', index: 1, delta: { partial_json: '{"nome":"UGC"}' } },
]), () => {});
assert.equal(anthropic.chamadas[0].arguments.nome, 'UGC');
assert.ok((await lerTurno(stream([{ type: 'error', error: { message: 'Sem créditos' } }]), () => {})).falha);
assert.ok((await lerTurno(stream([{ choices: [{ finish_reason: 'length' }] }]), () => {})).falha);
assert.ok((await lerTurno(stream([
  { type: 'content_block_start', content_block: { type: 'tool_use', name: 'criar_workflow' } },
  { type: 'content_block_delta', delta: { partial_json: '{bad' } },
]), () => {})).falha);

// Exercise mutations with isolated stores: no API charges or user data writes.
let applied = 0;
let failPortrait = false;
const workflow = {
  spaces: [{ id: 'unrelated', name: 'Projeto existente' }], activeSpaceId: 'unrelated',
  createSpace(name) { this.activeSpaceId = `wf-${this.spaces.length}`; this.spaces.push({ id: this.activeSpaceId, name }); },
  switchSpace(id) { this.activeSpaceId = id; },
};
const people = {
  personagens: [],
  criar(nome, dados) { const id = `p-${this.personagens.length}`; this.personagens.push({ id, nome, ...dados, fotos: [] }); return id; },
  atualizarGeracao(id, geracao, erroGeracao) { Object.assign(this.personagens.find(p => p.id === id), { geracao, erroGeracao }); },
};
globalThis.__chatMocks = {
  FERRAMENTAS: schemas.FERRAMENTAS,
  useWorkflowStore: { getState: () => workflow },
  usePersonagensStore: { getState: () => people },
  iniciarRetrato: async () => { if (failPortrait) throw new Error('Conecte Kie.ai'); return 'task-real'; },
  aplicarChamadas: () => { applied++; return { resultados: [{ saida: 'Nós criados' }], resumo: { falhas: [] } }; },
  grafoComoTexto: () => 'grafo', modelosComoTexto: () => 'modelos',
};
const code = compile('../lib/chatActions.ts').replace(/import \{([^}]+)\} from [^;]+;/g, (_, names) => `const {${names}} = globalThis.__chatMocks;`);
const { executarAcaoChat, workflowDaConversa } = await import(url(code));
const call = (name, args, id = 'call') => ({ name, arguments: args, id });
assert.match((await executarAcaoChat(call('criar_no', { tipo: 'promptNode' }))).content, /Erro/);
assert.equal(applied, 0);
const created = await executarAcaoChat(call('criar_workflow', { nome: 'UGC' }));
assert.equal(created.artifact.tipo, 'workflow');
assert.equal(workflowDaConversa([created]), created.artifact.id);
workflow.activeSpaceId = 'unrelated';
await executarAcaoChat(call('criar_no', { tipo: 'promptNode' }), created.artifact.id);
assert.equal(workflow.activeSpaceId, created.artifact.id);
assert.equal(applied, 1);
assert.match((await executarAcaoChat(call('criar_personagem', { nome: 'Ana', descricao: '' }))).content, /Erro/);
assert.equal(people.personagens.length, 0);
const portrait = await executarAcaoChat(call('criar_personagem', { nome: 'Ana', descricao: 'Apresentadora adulta de skincare' }));
assert.equal(people.personagens[0].geracao.taskId, 'task-real');
assert.equal(portrait.artifact.tipo, 'personagem');
failPortrait = true;
const failed = await executarAcaoChat(call('criar_personagem', { nome: 'Bia', descricao: 'Criadora adulta com cabelo castanho' }));
assert.match(failed.content, /não foi iniciado/);
assert.equal(people.personagens.length, 2);
assert.match(people.personagens[1].erroGeracao, /Kie/);
const sheet = await executarAcaoChat(call('criar_personagem', { nome: 'Lia', descricao: 'Personagem adulta para uma campanha', gerar_retrato: false }));
assert.ok(sheet.artifact);
assert.equal(people.personagens[2].geracao, undefined);
assert.match((await executarAcaoChat(call('unknown', {}))).content, /desconhecida/);
delete globalThis.__chatMocks;

// Validate provider payloads, including the second turn after tools execute.
globalThis.__routeMocks = { ...schemas, getKieToken: async () => 'test-key', getAzureToken: async () => 'test-key', mediaBytes: () => {} };
const routeCode = compile('../app/api/assistant/route.ts')
  .replace(/import \{([^}]+)\} from [^;]+;/g, (_, names) => `const {${names}} = globalThis.__routeMocks;`)
  .replace(/import sharp from [^;]+;/, 'const sharp = () => { throw new Error("Unexpected image conversion"); };');
const { POST } = await import(url(routeCode));
const originalFetch = globalThis.fetch;
let payload;
globalThis.fetch = async (_, options) => { payload = JSON.parse(options.body); return new Response('data: [DONE]\n\n'); };
try {
  const messages = [
    { role: 'system', content: 'Crie personagens.' },
    { role: 'user', content: 'Crie Ana' },
    { role: 'assistant', content: '', toolCalls: [{ id: 'c1', name: 'criar_personagem', arguments: { nome: 'Ana' } }] },
    { role: 'tool', content: 'Ficha salva', toolCallId: 'c1' },
  ];
  const request = body => new Request('http://localhost/api/assistant', { method: 'POST', body: JSON.stringify(body) });
  assert.equal((await POST(request({ model: 'claude-sonnet-4-6', tools: 'chat', messages }))).status, 200);
  assert.equal(payload.system, 'Crie personagens.');
  assert.ok(payload.messages.every(m => m.role !== 'system'));
  assert.equal(payload.messages.at(-1).content[0].tool_use_id, 'c1');
  assert.ok(payload.tools.some(t => t.name === 'criar_personagem'));
  await POST(request({ model: 'gpt-5-2', tools: 'chat', messages }));
  assert.equal(payload.messages.at(-1).tool_call_id, 'c1');
  assert.equal(payload.messages[2].tool_calls[0].function.name, 'criar_personagem');
  await POST(request({ model: 'gpt-5-2', tools: true, messages: [{ role: 'user', content: 'Monte o grafo' }] }));
  assert.ok(payload.tools.every(t => t.function.name !== 'criar_personagem'));
} finally { globalThis.fetch = originalFetch; delete globalThis.__routeMocks; }
console.log('Chat: streaming and provider payloads, tool scopes, workflow isolation, character persistence and portrait failures passed.');
