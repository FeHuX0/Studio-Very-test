import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import type { Asset, Composition, ElementInstance, FormatId, PaletteId, ProjectFile } from '../types';
import { DEMO_ASSETS } from '../data/demo';
import { generateCompositions, adaptFormat } from '../services/CompositionEngine';
import { mergeAssets } from '../services/SvgImportService';
import { indexedStorage } from '../services/storage';
const initial = generateCompositions({ assets: DEMO_ASSETS, selectedIds: ['demo-cards', 'demo-orbit', 'demo-blocks'], palette: 'lavender', format: 'square', count: 3, seed: 42, density: .65, size: 'auto' });
export interface StudioState {
  title: string; assets: Asset[]; composition: Composition; variants: Composition[]; selectedIds: string[];
  selectedElement: string | null; past: Composition[]; future: Composition[]; notice: string | null;
  setTitle: (title: string) => void; selectElement: (id: string | null) => void;
  toggleAsset: (id: string) => void; setSelectedIds: (ids: string[]) => void; addAssets: (assets: Asset[]) => void; updateAsset: (id: string, patch: Partial<Pick<Asset, 'tags' | 'keywords' | 'colorMap'>>) => void;
  commit: (composition: Composition) => void; preview: (composition: Composition) => void; checkpoint: () => void;
  setVariants: (variants: Composition[], activeIndex?: number) => void; setPalette: (id: PaletteId) => void; setFormat: (id: FormatId) => void;
  updateElement: (id: string, patch: Partial<ElementInstance>, history?: boolean) => void;
  addElement: (objectId: string) => void; duplicate: () => void; remove: () => void; layer: (direction: 1 | -1) => void;
  undo: () => void; redo: () => void; reset: () => void; loadProject: (project: ProjectFile) => void; notify: (notice: string | null) => void;
}
export const useStudio = create<StudioState>()(persist((set, get) => ({
  title: 'Новая перспектива', assets: DEMO_ASSETS, composition: initial[0], variants: initial,
  selectedIds: ['demo-cards', 'demo-orbit', 'demo-blocks'], selectedElement: null, past: [], future: [], notice: null,
  setTitle: title => set({ title }), selectElement: id => set({ selectedElement: id }),
  toggleAsset: id => set(state => ({ selectedIds: state.selectedIds.includes(id) ? state.selectedIds.filter(v => v !== id) : [...state.selectedIds, id] })),
  setSelectedIds: selectedIds => set({ selectedIds }),
  addAssets: assets => {
    const merged = mergeAssets(get().assets, assets);
    if (merged.length > 200 || new TextEncoder().encode(JSON.stringify(merged)).length > 18*1024*1024) throw new Error('Лимит библиотеки: 200 объектов и 18 МБ исходников. Сохраните текущий проект и начните новую библиотеку.');
    set({ assets: merged });
  },
  updateAsset: (id, patch) => set(state => ({ assets: state.assets.map(a => a.id === id ? { ...a, ...patch } : a) })),
  commit: composition => set(state => ({ composition, past: [...state.past.slice(-49), state.composition], future: [] })),
  preview: composition => set({ composition }),
  checkpoint: () => set(state => ({ past: [...state.past.slice(-49), state.composition], future: [] })),
  setVariants: (variants, activeIndex = 0) => { get().commit(variants[activeIndex] ?? variants[0]); set({ variants, selectedElement: null }); },
  setPalette: palette => get().commit({ ...get().composition, canvas: { ...get().composition.canvas, palette } }),
  setFormat: format => get().commit(adaptFormat(get().composition, get().assets, format)),
  updateElement: (id, patch, history = true) => {
    const composition = { ...get().composition, elements: get().composition.elements.map(e => e.id === id ? { ...e, ...patch, id: e.id, objectId: e.objectId } : e) };
    if (history) get().commit(composition); else set({ composition });
  },
  addElement: objectId => {
    const state = get(); const asset = state.assets.find(a => a.id === objectId); if (!asset) return;
    const id = `e-${crypto.randomUUID()}`;
    const role = asset.sources['main:L'] || asset.sources['main:S'] ? 'main' : 'background';
    state.commit({ ...state.composition, elements: [...state.composition.elements, { id, objectId, role, size: 'L', x: .5, y: .5, scale: .3, rotation: 0, zIndex: Math.max(0, ...state.composition.elements.map(e => e.zIndex)) + 1, hidden: false }] });
    set({ selectedElement: id });
  },
  duplicate: () => {
    const state = get(); const selected = state.composition.elements.find(e => e.id === state.selectedElement); if (!selected) return;
    const id = `e-${crypto.randomUUID()}`;
    state.commit({ ...state.composition, elements: [...state.composition.elements, { ...selected, id, x: Math.min(.85, selected.x + .04), y: Math.min(.85, selected.y + .04), zIndex: Math.max(...state.composition.elements.map(e => e.zIndex)) + 1 }] }); set({ selectedElement: id });
  },
  remove: () => { const state = get(); if (!state.selectedElement) return; state.commit({ ...state.composition, elements: state.composition.elements.filter(e => e.id !== state.selectedElement) }); set({ selectedElement: null }); },
  layer: direction => {
    const state = get(); const sorted = [...state.composition.elements].sort((a, b) => a.zIndex - b.zIndex); const index = sorted.findIndex(e => e.id === state.selectedElement); const next = index + direction;
    if (index < 0 || next < 0 || next >= sorted.length) return;
    [sorted[index], sorted[next]] = [sorted[next], sorted[index]];
    state.commit({ ...state.composition, elements: sorted.map((e, i) => ({ ...e, zIndex: i })) });
  },
  undo: () => set(state => state.past.length ? { composition: state.past[state.past.length - 1], past: state.past.slice(0, -1), future: [state.composition, ...state.future].slice(0, 50), selectedElement: null } : {}),
  redo: () => set(state => state.future.length ? { composition: state.future[0], past: [...state.past, state.composition], future: state.future.slice(1), selectedElement: null } : {}),
  reset: () => { const state = get(); state.commit({ ...state.composition, elements: [] }); set({ selectedElement: null }); },
  loadProject: project => set({ title: project.title, assets: project.assets, composition: project.composition, variants: [project.composition], selectedElement: null, selectedIds: [], past: [], future: [] }),
  notify: notice => set({ notice }),
}), {
  name: 'forma-project-v1', storage: createJSONStorage(() => indexedStorage),
  partialize: ({ title, assets, composition, variants, selectedIds }) => ({ title, assets, composition, variants, selectedIds }),
  onRehydrateStorage: () => (_state, error) => { if (error) setTimeout(() => useStudio.getState().notify('Не удалось восстановить локальное сохранение. Скачивайте резервную копию JSON.'), 0); },
}));
