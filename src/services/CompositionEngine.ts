import { FORMATS } from '../data/palettes';
import type { Asset, Composition, ElementInstance, GenerationOptions, Strategy } from '../types';
import { matchTopic } from './SemanticMatcher';
import { availableRoles, sourceFor } from './PaletteService';

export const STRATEGIES: Strategy[] = ['central', 'diagonal', 'asymmetric', 'triangle', 'hero', 'decorative'];
export const STRATEGY_NAMES: Record<Strategy, string> = { central: 'В центре внимания', diagonal: 'По диагонали', asymmetric: 'Свободный ритм', triangle: 'Точка равновесия', hero: 'Главный акцент', decorative: 'В окружении деталей' };
export function seededRandom(seed: number) {
  let value = seed >>> 0;
  return () => { value += 0x6D2B79F5; let t = value; t = Math.imul(t ^ t >>> 15, t | 1); t ^= t + Math.imul(t ^ t >>> 7, t | 61); return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}
export function elementDimensions(asset: Asset, element: ElementInstance, canvas: Composition['canvas']) {
  const source = sourceFor(asset, element.role, element.size);
  if (!source) return { width: 0, height: 0, boxWidth: 0, boxHeight: 0 };
  const long = Math.min(canvas.width, canvas.height) * element.scale;
  const ratio = source.aspectRatio;
  const width = ratio >= 1 ? long : long * ratio;
  const height = ratio >= 1 ? long / ratio : long;
  const radians = element.rotation * Math.PI / 180;
  return { width, height, boxWidth: Math.abs(width * Math.cos(radians)) + Math.abs(height * Math.sin(radians)), boxHeight: Math.abs(width * Math.sin(radians)) + Math.abs(height * Math.cos(radians)) };
}
export function fitElement(asset: Asset, element: ElementInstance, canvas: Composition['canvas']): ElementInstance {
  let fitted = { ...element };
  let dim = elementDimensions(asset, fitted, canvas);
  const factor = Math.min(1, canvas.width * .91 / dim.boxWidth, canvas.height * .91 / dim.boxHeight);
  fitted.scale *= factor;
  dim = elementDimensions(asset, fitted, canvas);
  const px = dim.boxWidth / canvas.width / 2 + .035;
  const py = dim.boxHeight / canvas.height / 2 + .035;
  fitted.x = Math.max(px, Math.min(1 - px, fitted.x));
  fitted.y = Math.max(py, Math.min(1 - py, fitted.y));
  return fitted;
}
type Box = { x: number; y: number; w: number; h: number; role: string };
export function scoreComposition(composition: Composition, assets: Asset[]): number {
  const boxes: Box[] = composition.elements.filter(e => !e.hidden).flatMap(e => {
    const asset = assets.find(a => a.id === e.objectId); if (!asset) return [];
    const dim = elementDimensions(asset, e, composition.canvas);
    return [{ x: e.x, y: e.y, w: dim.boxWidth / composition.canvas.width, h: dim.boxHeight / composition.canvas.height, role: e.role }];
  });
  let penalty = 0; let coverage = 0; let massX = 0; let massY = 0; let totalMass = 0;
  for (const [i, a] of boxes.entries()) {
    const area = a.w * a.h; const mass = area * (a.role === 'main' ? 1 : .25);
    coverage += area; massX += a.x * mass; massY += a.y * mass; totalMass += mass;
    penalty += Math.max(0, a.w / 2 - a.x, a.x + a.w / 2 - 1) * 200;
    penalty += Math.max(0, a.h / 2 - a.y, a.y + a.h / 2 - 1) * 200;
    for (const b of boxes.slice(i + 1)) {
      if (a.role !== 'main' || b.role !== 'main') continue;
      const overlap = Math.max(0, Math.min(a.x + a.w / 2, b.x + b.w / 2) - Math.max(a.x - a.w / 2, b.x - b.w / 2)) * Math.max(0, Math.min(a.y + a.h / 2, b.y + b.h / 2) - Math.max(a.y - a.h / 2, b.y - b.h / 2));
      penalty += Math.max(0, overlap / Math.min(area, b.w * b.h) - .12) * 65;
      penalty += Math.max(0, .17 - Math.hypot(a.x - b.x, a.y - b.y)) * 35;
    }
  }
  if (totalMass) penalty += (Math.abs(massX / totalMass - .5) + Math.abs(massY / totalMass - .5)) * 30;
  penalty += Math.abs(coverage - .43) * 18;
  return Math.round(Math.max(0, Math.min(100, 100 - penalty)) * 10) / 10;
}
function anchor(strategy: Strategy, i: number, n: number): [number, number] {
  if (n === 1) return [.5, .5];
  const arrays: Record<Strategy, [number, number][]> = {
    central: [[.5,.5],[.23,.28],[.77,.72],[.76,.25],[.23,.75],[.5,.16]],
    diagonal: [[.28,.3],[.55,.53],[.76,.75],[.2,.76],[.78,.23],[.47,.18]],
    asymmetric: [[.38,.52],[.76,.29],[.73,.72],[.2,.19],[.25,.8],[.8,.5]],
    triangle: [[.5,.27],[.27,.68],[.76,.68],[.5,.87],[.17,.3],[.84,.28]],
    hero: [[.42,.49],[.78,.3],[.75,.7],[.19,.79],[.22,.18],[.74,.87]],
    decorative: [[.5,.46],[.25,.74],[.78,.68],[.16,.24],[.81,.21],[.51,.86]],
  };
  return arrays[strategy][i % arrays[strategy].length];
}
export function generateCompositions(options: GenerationOptions): Composition[] {
  const matches = matchTopic(options.topic ?? '', options.assets);
  const ids = options.selectedIds?.length ? options.selectedIds : matches.objects.slice(0, 5).map(v => v.objectId);
  const selected = ids.map(id => options.assets.find(a => a.id === id)).filter((a): a is Asset => !!a);
  if (!selected.length) throw new Error('Не найдены подходящие элементы. Выберите их в библиотеке или добавьте теги.');
  if (selected.length > 24) throw new Error('Выберите не более 24 объектов для одной композиции.');
  const format = FORMATS[options.format];
  const canvas = { width: format.width, height: format.height, palette: options.palette, format: options.format };
  const start = STRATEGIES.indexOf(matches.strategy);
  const chosen: Composition[] = [];
  return Array.from({ length: options.count }, (_, variant) => {
    const strategy = STRATEGIES[(start + variant) % STRATEGIES.length];
    let best: Composition | undefined;
    for (let candidate = 0; candidate < 22; candidate++) {
      const seed = options.seed + variant * 1009 + candidate * 31;
      const random = seededRandom(seed);
      const rotationLimit = strategy === 'diagonal' ? 22 : 14;
      const instances: ElementInstance[] = selected.map((asset, i) => {
        const role = availableRoles(asset).includes('main') ? 'main' : 'background';
        const [x, y] = anchor(strategy, i, selected.length);
        const hero = i === 0 && ['hero', 'central', 'decorative', 'asymmetric'].includes(strategy);
        const base = Math.min(hero ? .47 : .34, .82 / Math.sqrt(selected.length));
        const size = options.size === 'auto' ? (Math.min(canvas.width, canvas.height) * base > 290 ? 'L' : 'S') : options.size;
        return fitElement(asset, { id: `e-${options.seed}-${variant}-${i}`, objectId: asset.id, role, size, x: x + (random() - .5) * .12, y: y + (random() - .5) * .12, scale: base * (.91 + random() * .16), rotation: (random() - .5) * Math.min(rotationLimit, asset.placement?.maxRotation ?? 360), zIndex: i + 10, hidden: false }, canvas);
      });
      const decorative = selected.filter(asset => availableRoles(asset).includes('background'));
      const decorationCount = Math.min(6, Math.round(options.density * 6));
      for (let i = 0; i < decorationCount && decorative.length; i++) {
        const asset = decorative[i % decorative.length];
        const theta = (i / Math.max(1, decorationCount) * Math.PI * 2) + random() * .6;
        instances.push(fitElement(asset, { id: `d-${options.seed}-${variant}-${i}`, objectId: asset.id, role: 'background', size: options.size === 'auto' ? 'S' : options.size, x: .5 + Math.cos(theta) * .36, y: .5 + Math.sin(theta) * .36, scale: .14 + random() * .08, rotation: (random() - .5) * 60, zIndex: i, hidden: false }, canvas));
      }
      const composition: Composition = { id: `c-${options.seed}-${variant}`, name: STRATEGY_NAMES[strategy], seed, strategy, score: 0, canvas, elements: instances };
      // Penalize near-duplicate layouts relative to variants already chosen.
      const distance = chosen.length ? Math.min(...chosen.map(previous => {
        const main = composition.elements.filter(e => e.role === 'main');
        if (!main.length) return 1;
        return main.reduce((sum, e) => {
          const other = previous.elements.find(p => p.objectId === e.objectId && p.role === e.role);
          return sum + (other ? Math.hypot(e.x-other.x,e.y-other.y) + Math.abs(e.rotation-other.rotation)/180 : 1);
        }, 0)/main.length;
      })) : 1;
      composition.score = Math.round((scoreComposition(composition, options.assets) - Math.max(0, .16-distance)*60)*10)/10;
      if (!best || composition.score > best.score) best = composition;
    }
    chosen.push(best!);
    return best!;
  });
}
export function adaptFormat(composition: Composition, assets: Asset[], formatId: Composition['canvas']['format']): Composition {
  const format = FORMATS[formatId];
  const canvas = { ...composition.canvas, width: format.width, height: format.height, format: formatId };
  return { ...composition, canvas, elements: composition.elements.map(e => {
    const asset = assets.find(a => a.id === e.objectId);
    return asset ? fitElement(asset, e, canvas) : e;
  }) };
}
