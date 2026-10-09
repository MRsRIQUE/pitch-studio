import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';

// Load the pure TypeScript helpers without an additional test dependency.
const compile = (file) => ts.transpileModule(readFileSync(new URL(file, import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
const moduleUrl = (code) => `data:text/javascript;base64,${Buffer.from(code).toString('base64')}`;
const productionUrl = moduleUrl(compile('../lib/production.ts'));
const production = await import(productionUrl);
const { resolveInputs, buildPipelineWaves } = await import(moduleUrl(compile('../lib/executor.ts').replace('"./production"', JSON.stringify(productionUrl))));
const shot = { ...production.newShot(), scene: 'Personagem entra na sala', dialogue: 'Olá', movement: 'Travelling' };
const source = { id: 'script', type: 'scriptNode', position: { x: 0, y: 0 }, data: { label: 'Roteiro', shots: [shot] } };
for (const type of ['generateNode', 'videoGeneratorNode']) {
  const batch = production.storyboardBatch(source, [shot, { ...shot, id: 'second', finalPrompt: 'Prompt revisado' }], type);
  assert.equal(batch.nodes.length, 5);
  assert.equal(new Set(batch.nodes.map(n => n.id)).size, 5);
  assert.equal(batch.edges.length, 2);
  const generators = batch.nodes.filter(n => n.type === type);
  assert.match(resolveInputs(generators[0].id, batch.nodes, batch.edges).prompt, /Personagem entra/);
  assert.equal(resolveInputs(generators[1].id, batch.nodes, batch.edges).prompt, 'Prompt revisado');
  assert.equal(buildPipelineWaves(batch.nodes, batch.edges)[0].length, 2);
  assert.ok(batch.nodes.slice(1).every(n => n.parentId === batch.nodes[0].id));
  assert.ok(generators.every(n => n.data.status === 'idle'));
}
const director = { id: 'director', type: 'directorStudioNode', position: { x: 0, y: 0 }, data: { label: 'Direção', prompt: 'Retrato', direction: { Paleta: 'Warm Gold', Câmera: 'Auto' } } };
assert.equal(resolveInputs('out', [director], [{ source: 'director', target: 'out', targetHandle: 'prompt' }]).prompt, 'Retrato\nPaleta: Warm Gold');
const audio = { id: 'audio', type: 'audioNode', data: { label: 'Áudio', audioUrl: '/generated/uploads/test.wav' } };
assert.deepEqual(resolveInputs('video', [audio], [{ source: 'audio', target: 'video', targetHandle: 'audioRef' }]).referenceAudioUrls, ['/generated/uploads/test.wav']);
assert.match(production.productionText(source.data), /Plano 1 \(5s\)/);
console.log('Production: batch graph, prompt propagation, direction, audio and pipeline checks passed.');
