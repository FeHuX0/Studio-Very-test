export type Role = 'main' | 'background';
export type Size = 'S' | 'L';
export type BuiltinPaletteId = 'lavender' | 'peach' | 'mint';
export type PaletteId = BuiltinPaletteId | (string & {});
export type FormatId = 'square' | 'landscape' | 'portrait' | 'story';
export type Strategy = 'central' | 'diagonal' | 'asymmetric' | 'triangle' | 'hero' | 'decorative';
export type ColorRole = 'mainObjectColors' | 'accents' | 'shadows' | 'outlines' | 'backgroundDecorations';
export interface PaletteDefinition {
  id: PaletteId;
  name: string;
  label: string;
  background: string;
  backgroundDecorations: readonly string[];
  mainObjectColors: readonly string[];
  accents: readonly string[];
  shadows: readonly string[];
  outlines: readonly string[];
}
export interface SvgSource { svg: string; viewBox: [number, number, number, number]; aspectRatio: number; }
export interface Asset {
  id: string; name: string; category: string; tags: string[]; keywords: string[];
  role: Role; sizeVariants: Size[]; sources: Partial<Record<`${Role}:${Size}`, SvgSource>>;
  colorMap: Record<string, ColorRole>; allowedPalettes: PaletteId[];
  demo?: boolean; warnings: string[]; placement?: { maxRotation?: number };
}
export interface ElementInstance {
  id: string; objectId: string; role: Role; size: Size; x: number; y: number;
  scale: number; rotation: number; zIndex: number; hidden: boolean;
}
export interface Composition {
  id: string; name: string; seed: number; strategy: Strategy; score: number;
  canvas: { width: number; height: number; palette: PaletteId; format: FormatId };
  elements: ElementInstance[];
}
export interface ProjectFile { version: 1; title: string; assets: Asset[]; composition: Composition; }
export interface GenerationOptions {
  assets: Asset[]; selectedIds?: string[]; topic?: string; palette: PaletteId; format: FormatId;
  count: 3 | 6; seed: number; density: number; size: Size | 'auto';
}
export interface MatchResult {
  theme: string; objects: { objectId: string; weight: number; reason: string }[];
  strategy: Strategy; explanation: string; mode: 'local';
}
