import type { FormatId, PaletteDefinition, PaletteId } from '../types';

export const PALETTES: Record<string, PaletteDefinition> = {
  lavender: { id: 'lavender', name: 'Lavender', label: 'Лаванда', background: '#f2effa', backgroundDecorations: ['#e1d9f2', '#d0c4e8'], mainObjectColors: ['#9881d9', '#7660bb', '#c1afe9'], accents: ['#f5c96c', '#f1aa8e'], shadows: ['#5d478f'], outlines: ['#382952'] },
  peach: { id: 'peach', name: 'Peach', label: 'Персик', background: '#fcf0e9', backgroundDecorations: ['#f5d8c9', '#edc2ae'], mainObjectColors: ['#df9474', '#bb7259', '#efb49a'], accents: ['#a5b8a0', '#e4b655'], shadows: ['#9b5a48'], outlines: ['#54352d'] },
  mint: { id: 'mint', name: 'Mint', label: 'Мята', background: '#edf5f1', backgroundDecorations: ['#cfe4db', '#b6d5c7'], mainObjectColors: ['#79ad98', '#4e8875', '#a0c9b6'], accents: ['#edc77c', '#d89789'], shadows: ['#3e6b5c'], outlines: ['#29483d'] },
};

export const PALETTE_IDS: PaletteId[] = ['lavender', 'peach', 'mint'];

export function registerCustomPalette(palette: PaletteDefinition): PaletteId {
  const fg = new Set([...palette.mainObjectColors, ...palette.accents, ...palette.shadows, ...palette.outlines].map(c => c.toLowerCase()));
  const safeBgDecor = palette.backgroundDecorations.map(c => (fg.has(c.toLowerCase()) ? '#e4dff0' : c));
  const normalized: PaletteDefinition = { ...palette, backgroundDecorations: safeBgDecor.length ? safeBgDecor : ['#e4dff0'] };
  PALETTES[normalized.id] = normalized;
  if (!PALETTE_IDS.includes(normalized.id)) {
    PALETTE_IDS.push(normalized.id);
  }
  return normalized.id;
}

export function parseUploadedPalette(raw: string, filename = 'custom'): PaletteDefinition {
  const cleanName = filename.replace(/\.(json|svg)$/i, '').trim() || 'Своя палитра';
  const id = `custom-${Array.from(cleanName.toLowerCase()).map(c => c.codePointAt(0)!.toString(16)).join('').slice(0, 16) || 'palette'}`;
  if (raw.trim().startsWith('{')) {
    const data = JSON.parse(raw) as Record<string, unknown>;
    const str = (v: unknown, fallback: string) => (typeof v === 'string' && /^#[\da-f]{3,8}$/i.test(v.trim()) ? v.trim().toLowerCase() : fallback);
    const arr = (v: unknown, fallback: string[]) =>
      Array.isArray(v)
        ? v.filter((x): x is string => typeof x === 'string' && /^#[\da-f]{3,8}$/i.test(x.trim())).map(x => x.trim().toLowerCase())
        : fallback;
    const main = arr(data.mainObjectColors ?? data.main ?? data.colors, ['#5c7cfa', '#4263eb', '#91a7ff']);
    const accents = arr(data.accents ?? data.accent, ['#fcc419', '#ff922b']);
    const shadows = arr(data.shadows ?? data.shadow, ['#364fc7']);
    const outlines = arr(data.outlines ?? data.outline, ['#1e293b']);
    const bg = str(data.background ?? data.bg, '#f1f5f9');
    const bgDecor = arr(data.backgroundDecorations ?? data.decor, ['#dbe4ff', '#bac8ff']);
    return {
      id,
      name: typeof data.name === 'string' && data.name.trim() ? data.name.trim().slice(0, 40) : cleanName,
      label: cleanName,
      background: bg,
      backgroundDecorations: bgDecor.length ? bgDecor : ['#dbe4ff'],
      mainObjectColors: main.length ? main : ['#5c7cfa'],
      accents: accents.length ? accents : ['#fcc419'],
      shadows: shadows.length ? shadows : ['#364fc7'],
      outlines: outlines.length ? outlines : ['#1e293b'],
    };
  }
  const matches = [...raw.matchAll(/#(?:[\da-fA-F]{6}|[\da-fA-F]{3})\b/g)].map(m => m[0].toLowerCase());
  const unique = [...new Set(matches)];
  if (unique.length < 2) {
    throw new Error('Не удалось найти минимум 2 HEX-цвета в файле палитры (.svg или .json).');
  }
  const background = unique[0];
  const main1 = unique[1] ?? '#5c7cfa';
  const main2 = unique[2] ?? main1;
  const accent = unique[3] ?? '#f59f00';
  const shadow = unique[4] ?? '#364fc7';
  const outline = unique[5] ?? '#1e293b';
  const decor = unique[6] && ![main1, main2, accent, shadow, outline].includes(unique[6]) ? unique[6] : '#dde5f4';
  return {
    id,
    name: cleanName.slice(0, 40),
    label: cleanName.slice(0, 40),
    background,
    backgroundDecorations: [decor],
    mainObjectColors: [main1, main2],
    accents: [accent],
    shadows: [shadow],
    outlines: [outline],
  };
}

export const FORMATS: Record<FormatId, { name: string; label: string; width: number; height: number }> = {
  square: { name: 'Square', label: 'Квадрат', width: 1080, height: 1080 },
  landscape: { name: 'Landscape', label: 'Альбомный', width: 1600, height: 900 },
  portrait: { name: 'Portrait', label: 'Портрет', width: 1080, height: 1350 },
  story: { name: 'Story', label: 'История', width: 1080, height: 1920 },
};
