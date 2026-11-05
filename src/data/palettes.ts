import type { FormatId, PaletteId } from '../types';
export const PALETTES = {
  lavender: { id: 'lavender', name: 'Lavender', label: 'Лаванда', background: '#f2effa', backgroundDecorations: ['#e1d9f2', '#d0c4e8'], mainObjectColors: ['#9881d9', '#7660bb', '#c1afe9'], accents: ['#f5c96c', '#f1aa8e'], shadows: ['#5d478f'], outlines: ['#382952'] },
  peach: { id: 'peach', name: 'Peach', label: 'Персик', background: '#fcf0e9', backgroundDecorations: ['#f5d8c9', '#edc2ae'], mainObjectColors: ['#df9474', '#bb7259', '#efb49a'], accents: ['#a5b8a0', '#e4b655'], shadows: ['#9b5a48'], outlines: ['#54352d'] },
  mint: { id: 'mint', name: 'Mint', label: 'Мята', background: '#edf5f1', backgroundDecorations: ['#cfe4db', '#b6d5c7'], mainObjectColors: ['#79ad98', '#4e8875', '#a0c9b6'], accents: ['#edc77c', '#d89789'], shadows: ['#3e6b5c'], outlines: ['#29483d'] },
} as const;
export const PALETTE_IDS: PaletteId[] = ['lavender', 'peach', 'mint'];
export const FORMATS: Record<FormatId, { name: string; label: string; width: number; height: number }> = {
  square: { name: 'Square', label: 'Квадрат', width: 1080, height: 1080 },
  landscape: { name: 'Landscape', label: 'Альбомный', width: 1600, height: 900 },
  portrait: { name: 'Portrait', label: 'Портрет', width: 1080, height: 1350 },
  story: { name: 'Story', label: 'История', width: 1080, height: 1920 },
};
