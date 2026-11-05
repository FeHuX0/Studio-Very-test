import type { Asset, Composition, ElementInstance, ProjectFile } from '../types';
import { PALETTES, FORMATS } from '../data/palettes';
import { coloredSvg, sourceFor } from './PaletteService';
import { elementDimensions, STRATEGIES } from './CompositionEngine';
import { parseSvg } from './SvgImportService';
const NS = 'http://www.w3.org/2000/svg';
export function instanceMarkup(asset: Asset, element: ElementInstance, composition: Composition, scope = ''): string {
  const raw = coloredSvg(asset, element.role, element.size, composition.canvas.palette, `${scope ? `${scope}-` : ''}${element.id}`);
  const root = new DOMParser().parseFromString(raw, 'image/svg+xml').documentElement;
  const { width, height } = elementDimensions(asset, element, composition.canvas);
  root.setAttribute('width', String(width)); root.setAttribute('height', String(height));
  root.setAttribute('x', String(-width / 2)); root.setAttribute('y', String(-height / 2));
  root.setAttribute('preserveAspectRatio', 'xMidYMid meet');
  return new XMLSerializer().serializeToString(root);
}
export function exportSvg(composition: Composition, assets: Asset[], scope = ''): string {
  const document = window.document.implementation.createDocument(NS, 'svg');
  const root = document.documentElement;
  const { width, height, palette } = composition.canvas;
  root.setAttributeNS('http://www.w3.org/2000/xmlns/', 'xmlns', NS); root.setAttribute('width', String(width)); root.setAttribute('height', String(height)); root.setAttribute('viewBox', `0 0 ${width} ${height}`);
  const background = document.createElementNS(NS, 'rect');
  background.setAttribute('width', String(width)); background.setAttribute('height', String(height)); background.setAttribute('fill', PALETTES[palette].background); root.append(background);
  for (const element of [...composition.elements].sort((a, b) => a.zIndex - b.zIndex)) {
    if (element.hidden) continue;
    const asset = assets.find(a => a.id === element.objectId);
    if (!asset || !sourceFor(asset, element.role, element.size)) throw new Error(`Отсутствует исходный SVG для ${element.objectId}.`);
    const group = document.createElementNS(NS, 'g');
    group.setAttribute('transform', `translate(${element.x * width} ${element.y * height}) rotate(${element.rotation})`);
    const nested = new DOMParser().parseFromString(instanceMarkup(asset, element, composition, scope), 'image/svg+xml').documentElement;
    group.append(document.importNode(nested, true)); root.append(group);
  }
  return `<?xml version="1.0" encoding="UTF-8"?>\n${new XMLSerializer().serializeToString(root)}`;
}
export function downloadFile(content: string, name: string, type: string) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const anchor = document.createElement('a'); anchor.href = url; anchor.download = name; anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export function exportProject(title: string, composition: Composition, assets: Asset[]): string {
  return JSON.stringify({ version: 1, title, composition, assets } satisfies ProjectFile, null, 2);
}
const record = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
export function importProject(raw: string): ProjectFile {
  if (new TextEncoder().encode(raw).length > 20 * 1024 * 1024) throw new Error('Проект превышает 20 МБ.');
  const value: unknown = JSON.parse(raw);
  if (!record(value) || value.version !== 1 || typeof value.title !== 'string' || value.title.length > 200 || !Array.isArray(value.assets) || value.assets.length > 200 || !record(value.composition)) throw new Error('Неподдерживаемый формат проекта.');
  const ids = new Set<string>();
  const validIds = (id: unknown): id is string => typeof id === 'string' && /^[\w-]{1,1000}$/.test(id);
  const assets: Asset[] = value.assets.map((v: unknown) => {
    if (!record(v) || !validIds(v.id) || ids.has(v.id) || typeof v.name !== 'string' || v.name.length > 200 || !record(v.sources) || !record(v.colorMap) || !['main', 'background'].includes(String(v.role))) throw new Error('Некорректный объект библиотеки.');
    ids.add(v.id);
    const sources: Asset['sources'] = {};
    for (const [key, source] of Object.entries(v.sources)) {
      if (!/^(main|background):(S|L)$/.test(key) || !record(source) || typeof source.svg !== 'string') throw new Error('Некорректный SVG-вариант.');
      sources[key as keyof Asset['sources']] = parseSvg(source.svg);
    }
    if (!Object.keys(sources).length) throw new Error('В объекте нет SVG.');
    const colorMap: Asset['colorMap'] = {};
    for (const [key, role] of Object.entries(v.colorMap)) {
      if (!['mainObjectColors', 'accents', 'shadows', 'outlines', 'backgroundDecorations'].includes(String(role))) throw new Error('Некорректная карта цветов.');
      colorMap[key] = role as Asset['colorMap'][string];
    }
    const strings = (x: unknown): string[] => Array.isArray(x) ? x.filter((s): s is string => typeof s === 'string').slice(0, 100) : [];
    return { id: v.id, name: v.name, category: typeof v.category === 'string' ? v.category : 'Импорт', tags: strings(v.tags), keywords: strings(v.keywords), role: v.role as Asset['role'], sizeVariants: [...new Set(Object.keys(sources).map(k => k.endsWith('S') ? 'S' as const : 'L' as const))], sources, colorMap, allowedPalettes: ['lavender', 'peach', 'mint'], warnings: strings(v.warnings), demo: v.demo === true };
  });
  const c = value.composition;
  if (!record(c.canvas) || !Object.hasOwn(FORMATS, String(c.canvas.format)) || !Object.hasOwn(PALETTES, String(c.canvas.palette)) || !Array.isArray(c.elements) || c.elements.length > 300 || !STRATEGIES.includes(c.strategy as Composition['strategy'])) throw new Error('Некорректный холст.');
  const formatId = c.canvas.format as Composition['canvas']['format'];
  if (c.canvas.width !== FORMATS[formatId].width || c.canvas.height !== FORMATS[formatId].height) throw new Error('Размеры холста не соответствуют формату.');
  const instanceIds = new Set<string>();
  const elements = c.elements.map((e: unknown) => {
    if (!record(e) || !validIds(e.id) || instanceIds.has(e.id) || typeof e.objectId !== 'string' || !ids.has(e.objectId) || !['main', 'background'].includes(String(e.role)) || !['S', 'L'].includes(String(e.size))) throw new Error('Некорректный элемент композиции.');
    instanceIds.add(e.id);
    const number = (name: string, min: number, max: number) => {
      const n = e[name]; if (typeof n !== 'number' || !Number.isFinite(n) || n < min || n > max) throw new Error(`Некорректное значение ${name}.`); return n;
    };
    const element: ElementInstance = { id: e.id, objectId: e.objectId, role: e.role as ElementInstance['role'], size: e.size as ElementInstance['size'], x: number('x', -2, 3), y: number('y', -2, 3), scale: number('scale', .01, 4), rotation: number('rotation', -3600, 3600), zIndex: number('zIndex', -10000, 10000), hidden: e.hidden === true };
    if (!sourceFor(assets.find(a => a.id === element.objectId)!, element.role, element.size)) throw new Error('Не найден исходный вариант элемента.');
    return element;
  });
  return { version: 1, title: value.title, assets, composition: { id: typeof c.id === 'string' ? c.id : crypto.randomUUID(), name: typeof c.name === 'string' ? c.name : 'Импорт', seed: typeof c.seed === 'number' && Number.isFinite(c.seed) ? c.seed : 0, score: typeof c.score === 'number' && Number.isFinite(c.score) ? c.score : 0, strategy: c.strategy as Composition['strategy'], canvas: { width: FORMATS[formatId].width, height: FORMATS[formatId].height, format: formatId, palette: c.canvas.palette as Composition['canvas']['palette'] }, elements } };
}
