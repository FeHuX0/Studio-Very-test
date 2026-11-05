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
export function coloredSvg(asset: Asset, role: Role, size: Size, paletteId: PaletteId, prefix: string): string {
  const source = sourceFor(asset, role, size);
  if (!source) throw new Error(`Нет исходного варианта ${role} у «${asset.name}».`);
  const document = new DOMParser().parseFromString(source.svg, 'image/svg+xml');
  const root = document.documentElement;
  const palette = PALETTES[paletteId];
  const safePrefix = prefix.replace(/[^A-Za-z0-9_-]/g, '_');
  const nodes = [root, ...root.querySelectorAll('*')];
  const mapEntries = Object.keys(asset.colorMap).sort();
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
        if (mapped && asset.allowedPalettes.includes(paletteId)) {
          const bucket = role === 'background' ? palette.backgroundDecorations : palette[mapped === 'backgroundDecorations' ? 'mainObjectColors' : mapped];
          value = bucket[Math.max(0, mapEntries.indexOf(key)) % bucket.length];
        }
      }
      node.setAttribute(attribute.name, value);
    }
  }
  return new XMLSerializer().serializeToString(root);
}
