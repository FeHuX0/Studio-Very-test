import { PALETTES } from '../data/palettes';
import type { Asset, ColorRole, PaletteId, Role, Size } from '../types';

export function sourceFor(asset: Asset, role: Role, size: Size) {
  return asset.sources[`${role}:${size}`] ?? asset.sources[`${role}:${size === 'S' ? 'L' : 'S'}`];
}
export function availableRoles(asset: Asset): Role[] {
  return (['main', 'background'] as Role[]).filter(role => !!sourceFor(asset, role, 'L'));
}
export function sourceColors(asset: Asset): string[] {
  const colors = new Set<string>();
  for (const source of Object.values(asset.sources)) {
    if (!source) continue;
    const root = new DOMParser().parseFromString(source.svg, 'image/svg+xml').documentElement;
    for (const node of [root, ...root.querySelectorAll('*')]) for (const name of ['fill', 'stroke', 'stop-color', 'flood-color', 'color']) {
      const color = node.getAttribute(name);
      if (color && /^(#[\da-f]{3,8}|[a-z]+|rgba?\([\d\s.,%]+\))$/i.test(color) && !['none', 'transparent', 'currentColor'].includes(color)) colors.add(color.toLowerCase());
    }
  }
  return [...colors];
}
export function autoMapAssetColors(asset: Asset): Record<string, ColorRole> {
  const colors = sourceColors(asset);
  const next: Record<string, ColorRole> = { ...asset.colorMap };
  const hexToLum = (hex: string): number => {
    const clean = hex.replace('#', '');
    const full = clean.length === 3 ? clean.split('').map(c => c + c).join('') : clean.slice(0, 6);
    if (full.length !== 6) return 0.5;
    const r = parseInt(full.slice(0, 2), 16) / 255;
    const g = parseInt(full.slice(2, 4), 16) / 255;
    const b = parseInt(full.slice(4, 6), 16) / 255;
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };
  colors.forEach((color, index) => {
    if (next[color]) return;
    const lum = color.startsWith('#') ? hexToLum(color) : 0.5;
    if (lum < 0.24) next[color] = 'outlines';
    else if (lum < 0.42) next[color] = 'shadows';
    else if (index === colors.length - 1 && colors.length > 2) next[color] = 'accents';
    else next[color] = 'mainObjectColors';
  });
  return next;
}
export function coloredSvg(asset: Asset, role: Role, size: Size, paletteId: PaletteId, prefix: string): string {
  const source = sourceFor(asset, role, size);
  if (!source) throw new Error(`Нет исходного варианта ${role} у «${asset.name}».`);
  const document = new DOMParser().parseFromString(source.svg, 'image/svg+xml');
  const root = document.documentElement;
  const palette = PALETTES[paletteId] ?? PALETTES.lavender;
  const safePrefix = prefix.replace(/[^A-Za-z0-9_-]/g, '_');
  const nodes = [root, ...root.querySelectorAll('*')];
  const mapEntries = Object.keys(asset.colorMap).sort();
  const isCustomPalette = !['lavender', 'peach', 'mint'].includes(paletteId);
  for (const node of nodes) {
    for (const attribute of [...node.attributes]) {
      let value = attribute.value;
      if (attribute.name === 'id') value = `${safePrefix}-${value}`;
      else {
        value = value.replace(/url\(\s*#([\w.:-]+)\s*\)/g, (_, id: string) => `url(#${safePrefix}-${id})`);
        if (attribute.localName === 'href' && value.startsWith('#')) value = `#${safePrefix}-${value.slice(1)}`;
      }
      if (['fill', 'stroke', 'stop-color', 'flood-color', 'color'].includes(attribute.name)) {
        const key = attribute.value.toLowerCase();
        const semantic = node.getAttribute('data-color-role') as ColorRole | null;
        const explicit = Object.hasOwn(asset.colorMap, key) ? asset.colorMap[key] : undefined;
        const mapped = semantic && ['mainObjectColors', 'accents', 'shadows', 'outlines', 'backgroundDecorations'].includes(semantic) ? semantic : explicit;
        if (mapped && (isCustomPalette || asset.allowedPalettes.includes(paletteId))) {
          const bucket = role === 'background' ? palette.backgroundDecorations : palette[mapped === 'backgroundDecorations' ? 'mainObjectColors' : mapped];
          value = bucket[Math.max(0, mapEntries.indexOf(key)) % bucket.length];
        }
      }
      node.setAttribute(attribute.name, value);
    }
  }
  return new XMLSerializer().serializeToString(root);
}
