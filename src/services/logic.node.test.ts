import test from 'node:test';
import assert from 'node:assert/strict';
import { DEMO_ASSETS } from '../data/demo';
import { PALETTES, parseUploadedPalette, registerCustomPalette } from '../data/palettes';
import { adaptFormat, generateCompositions, seededRandom } from './CompositionEngine';
import { matchComponentsByNames, matchTopic } from './SemanticMatcher';
import type { GenerationOptions } from '../types';

const options: GenerationOptions = {
  assets: DEMO_ASSETS,
  selectedIds: DEMO_ASSETS.slice(0, 4).map(a => a.id),
  palette: 'lavender',
  format: 'square',
  count: 6,
  seed: 1234,
  density: 0.5,
  size: 'auto',
};

test('Default library provides 20 vector illustration components', () => {
  assert.equal(DEMO_ASSETS.length, 20);
  for (const asset of DEMO_ASSETS) {
    assert.ok(asset.sources['main:L']);
    assert.ok(asset.sources['main:S']);
    assert.ok(asset.sources['background:L']);
    assert.ok(asset.sources['background:S']);
  }
});

test('CompositionEngine deterministic generation and strategies', () => {
  const first = generateCompositions(options);
  const second = generateCompositions(options);
  assert.deepEqual(first, second);
  assert.equal(new Set(first.map(c => c.strategy)).size, 6);

  const rngA = seededRandom(42);
  const rngB = seededRandom(42);
  assert.deepEqual(Array.from({ length: 8 }, rngA), Array.from({ length: 8 }, rngB));
});

test('CompositionEngine format adaptation preserves element scales', () => {
  const base = generateCompositions(options)[0];
  const adapted = adaptFormat(base, DEMO_ASSETS, 'story');
  assert.equal(adapted.canvas.width, 1080);
  assert.equal(adapted.canvas.height, 1920);
  assert.deepEqual(
    adapted.elements.map(e => e.scale),
    base.elements.map(e => e.scale),
  );
});

test('Scenario 1 & 2: SemanticMatcher matches topics and component names locally', () => {
  const education = matchTopic('Обучение и развитие', DEMO_ASSETS);
  assert.equal(education.mode, 'local');
  assert.equal(education.objects.some(o => o.objectId === 'demo-cards'), true);

  const byNames = matchComponentsByNames('Книга, Лампа идеи, Карандаш', DEMO_ASSETS);
  assert.equal(byNames.length, 3);
  assert.deepEqual(
    byNames.map(a => a.id),
    ['demo-book', 'demo-bulb', 'demo-pencil'],
  );
});

test('Custom palette parsing and registration from SVG and JSON', () => {
  const parsedSvg = parseUploadedPalette(
    '<svg><rect fill="#f0f4ff"/><rect fill="#3b5bdb"/><rect fill="#fab005"/><rect fill="#1e293b"/></svg>',
    'Figma Ocean.svg',
  );
  const id = registerCustomPalette(parsedSvg);
  assert.ok(PALETTES[id]);
  assert.equal(PALETTES[id].background, '#f0f4ff');
  assert.equal(PALETTES[id].mainObjectColors[0], '#3b5bdb');
});
