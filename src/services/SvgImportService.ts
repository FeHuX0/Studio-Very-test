import type { Asset, Role, Size, SvgSource } from '../types';

const ELEMENTS = new Set('svg g path rect circle ellipse line polyline polygon text tspan defs linearGradient radialGradient stop clipPath mask pattern use title desc symbol'.split(' '));
const ATTRS = new Set('id xmlns xmlns:xlink viewBox width height x y x1 y1 x2 y2 cx cy r rx ry d points fill stroke stroke-width stroke-linecap stroke-linejoin stroke-miterlimit stroke-dasharray stroke-dashoffset fill-rule clip-rule fill-opacity stroke-opacity opacity transform gradientTransform gradientUnits offset stop-color stop-opacity spreadMethod fx fy fr href xlink:href clip-path mask maskUnits maskContentUnits clipPathUnits patternUnits patternContentUnits patternTransform preserveAspectRatio font-size font-family font-weight text-anchor dominant-baseline color data-color-role'.split(' '));
for (const name of 'filter feGaussianBlur feOffset feBlend feComposite feFlood feColorMatrix feMerge feMergeNode feComponentTransfer feFuncR feFuncG feFuncB feFuncA feDropShadow'.split(' ')) ELEMENTS.add(name);
for (const name of 'filter in in2 result stdDeviation mode operator k1 k2 k3 k4 values type dx dy filterUnits primitiveUnits color-interpolation-filters flood-color flood-opacity slope intercept amplitude exponent tableValues vector-effect'.split(' ')) ATTRS.add(name);
export const MAX_SVG_BYTES = 2 * 1024 * 1024;
export function parseSvg(raw: string): SvgSource {
  if (new TextEncoder().encode(raw).length > MAX_SVG_BYTES) throw new Error('SVG превышает 2 МБ.');
  if (/<!DOCTYPE|<!ENTITY|<\?xml-stylesheet/i.test(raw)) throw new Error('DTD, сущности и внешние стили запрещены.');
  const document = new DOMParser().parseFromString(raw, 'image/svg+xml');
  const root = document.documentElement;
  if (document.querySelector('parsererror') || root.localName !== 'svg') throw new Error('Некорректный SVG-файл.');
  if (document.getElementsByTagName('*').length > 15000) throw new Error('Слишком сложный SVG.');
  for (const node of [root, ...root.querySelectorAll('*')]) {
    if (!ELEMENTS.has(node.localName) || node.namespaceURI !== 'http://www.w3.org/2000/svg') throw new Error(`Элемент ${node.localName} запрещён. Разрешена только векторная графика.`);
    if (node.hasAttribute('style')) {
      const declarations = node.getAttribute('style')!.split(';').filter(s => s.trim());
      for (const declaration of declarations) {
        const i = declaration.indexOf(':');
        const key = declaration.slice(0, i).trim(); const value = declaration.slice(i + 1).trim();
        if (i < 1 || !ATTRS.has(key)) throw new Error(`Неподдерживаемый CSS: ${key}. Экспортируйте SVG с атрибутами представления.`);
        node.setAttribute(key, value);
      }
      node.removeAttribute('style');
    }
    for (const attr of [...node.attributes]) {
      if (!ATTRS.has(attr.name) || /^on/i.test(attr.name)) throw new Error(`Атрибут ${attr.name} запрещён.`);
      const value = attr.value.trim();
      if ((attr.localName === 'href' && !/^#[A-Za-z_][\w.:-]*$/.test(value)) || /javascript:|data:|https?:|file:|\\|\/\*|@import|expression\s*\(/i.test(value)) {
        if (attr.name !== 'xmlns' && attr.name !== 'xmlns:xlink') throw new Error('Внешние ресурсы и опасные ссылки запрещены.');
      }
      if (/url\s*\(/i.test(value) && !/^url\(\s*#[A-Za-z_][\w.:-]*\s*\)$/.test(value)) throw new Error('Разрешены только локальные SVG-ссылки.');
    }
  }
  const ids = new Set<string>();
  for (const node of root.querySelectorAll('[id]')) {
    if (!/^[A-Za-z_][\w.:-]*$/.test(node.id) || ids.has(node.id)) throw new Error('Некорректные или повторяющиеся SVG id.');
    ids.add(node.id);
  }
  const references = [...new XMLSerializer().serializeToString(root).matchAll(/(?:url\(\s*#|(?:href)=['"]#)([\w.:-]+)/g)];
  if (references.some(match => !ids.has(match[1]))) throw new Error('SVG содержит ссылку на отсутствующий элемент.');
  const viewBoxText = root.getAttribute('viewBox');
  let viewBox: number[];
  if (viewBoxText) viewBox = viewBoxText.trim().split(/[\s,]+/).map(Number);
  else {
    const dimension = (s: string | null) => s && /^(\d+(?:\.\d+)?)(?:px)?$/.test(s) ? parseFloat(s) : NaN;
    viewBox = [0, 0, dimension(root.getAttribute('width')), dimension(root.getAttribute('height'))];
  }
  if (viewBox.length !== 4 || viewBox.some(v => !Number.isFinite(v) || Math.abs(v) > 1e7) || viewBox[2] <= 0 || viewBox[3] <= 0) throw new Error('SVG должен содержать корректный viewBox или размеры в px.');
  root.setAttribute('viewBox', viewBox.join(' '));
  root.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  return { svg: new XMLSerializer().serializeToString(root), viewBox: viewBox as SvgSource['viewBox'], aspectRatio: viewBox[2] / viewBox[3] };
}

export function importSvg(raw: string, filename: string, options?: { role?: Role; size?: Size; tags?: string[]; category?: string }): Asset {
  const source = parseSvg(raw);
  const stem = filename.replace(/\.svg$/i, '');
  const parts = stem.split('__');
  const name = parts[0] || 'Без названия';
  const role: Role = parts.includes('background') ? 'background' : options?.role ?? 'main';
  const size: Size = parts.includes('L') ? 'L' : parts.includes('S') ? 'S' : options?.size ?? 'L';
  const id = `import-${Array.from(name.toLocaleLowerCase()).map(c => c.codePointAt(0)!.toString(16)).join('-')}`;
  const hasColors = /(?:fill|stroke|stop-color)=["'](?!none|url\()[^"']+["']/.test(source.svg);
  return { id, name, category: options?.category || 'Моя библиотека', tags: options?.tags ?? [name.toLocaleLowerCase()], keywords: [name.toLocaleLowerCase()], role, sizeVariants: [size], sources: { [`${role}:${size}`]: source }, colorMap: {}, allowedPalettes: ['lavender', 'peach', 'mint'], warnings: hasColors ? ['Цвета сохранены. Настройте карту цветов для переключения палитры.'] : [] };
}

export function mergeAssets(existing: Asset[], incoming: Asset[]): Asset[] {
  const result = new Map(existing.map(asset => [asset.id, asset]));
  for (const asset of incoming) {
    const old = result.get(asset.id);
    result.set(asset.id, old ? { ...old, sources: { ...old.sources, ...asset.sources }, sizeVariants: [...new Set([...old.sizeVariants, ...asset.sizeVariants])] } : asset);
  }
  return [...result.values()];
}
