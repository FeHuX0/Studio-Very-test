import { useRef, useState } from 'react';
import { Check, ChevronDown, Library, Plus, Search, Upload, X, SlidersHorizontal } from 'lucide-react';
import { useStudio } from '../store/useStudio';
import { importSvg, mergeAssets } from '../services/SvgImportService';
import { api } from '../services/api';
import type { Asset, Role, Size } from '../types';
import { AssetArtwork } from './Artwork';
import { AssetSettings } from './AssetSettings';

export function LibraryPanel() {
  const { assets, selectedIds, toggleAsset, addElement, addAssets, composition, notify } = useStudio();
  const [search, setSearch] = useState(''); const [category, setCategory] = useState('all');
  const [role, setRole] = useState<Role>('main'); const [size, setSize] = useState<Size>('L');
  const [tags, setTags] = useState(''); const [importOpen, setImportOpen] = useState(false);
  const [editing, setEditing] = useState<Asset | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const categories = [...new Set(assets.map(a => a.category))];
  const filtered = assets.filter(a => (category === 'all' || a.category === category) && `${a.name} ${a.tags.join(' ')}`.toLocaleLowerCase().includes(search.toLocaleLowerCase()));
  async function upload(files: FileList | null) {
    if (!files?.length) return;
    const incoming: Asset[] = []; const errors: string[] = [];
    for (const file of Array.from(files).slice(0, 100)) {
      try { incoming.push(importSvg(await file.text(), file.name, { role, size, tags: tags.split(',').map(s => s.trim()).filter(Boolean) })); }
      catch (e) { errors.push(`${file.name}: ${(e as Error).message}`); }
    }
    if (incoming.length) {
      try {
        addAssets(incoming); setCategory('all'); setSearch('');
        try { await api.saveAssets(mergeAssets([], incoming)); } catch { /* IndexedDB remains the local source of truth. */ }
      } catch (e) { notify((e as Error).message); return; }
    }
    notify(errors.length ? `Импортировано: ${incoming.length}. ${errors.slice(0, 3).join(' ')}` : `Импортировано SVG: ${incoming.length}. Добавьте теги и карту цветов через настройки элемента.`);
    if (fileInput.current) fileInput.current.value = '';
  }
  return <aside className="library-panel">
    <div className="panel-heading"><div><Library size={17}/><h2>Библиотека</h2></div><span className="count">{assets.length}</span></div>
    <div className="library-controls">
      <label className="search-field"><Search size={16}/><input placeholder="Найти элемент…" value={search} onChange={e => setSearch(e.target.value)}/>{search && <button aria-label="Очистить поиск" onClick={() => setSearch('')}><X size={13}/></button>}</label>
      <div className="filter-row"><label className="select-wrap"><select aria-label="Категория библиотеки" value={category} onChange={e => setCategory(e.target.value)}><option value="all">Все элементы</option>{categories.map(c => <option key={c}>{c}</option>)}</select><ChevronDown size={13}/></label><button className={`icon-button ${importOpen ? 'active' : ''}`} aria-label="Параметры импорта" onClick={() => setImportOpen(!importOpen)}><SlidersHorizontal size={16}/></button></div>
    </div>
    {importOpen && <div className="import-options"><strong>Новый SVG</strong><div className="two-fields"><label>Роль<select value={role} onChange={e => setRole(e.target.value as Role)}><option value="main">Главный</option><option value="background">Фоновый</option></select></label><label>Версия<select value={size} onChange={e => setSize(e.target.value as Size)}><option>S</option><option>L</option></select></label></div><label>Теги через запятую<input placeholder="книга, обучение, идеи" value={tags} onChange={e => setTags(e.target.value)}/></label><p>Для объединения версий: книга__main__L.svg</p></div>}
    <div className="library-scroll">
      <div className="section-caption">{category === 'all' ? 'ЭЛЕМЕНТЫ КОМПОЗИЦИИ' : category.toLocaleUpperCase()}<span>{filtered.length}</span></div>
      <div className="asset-grid">{filtered.map(asset => <div className={`asset-card ${selectedIds.includes(asset.id) ? 'selected' : ''}`} key={asset.id}>
        <button className="asset-select" onClick={() => toggleAsset(asset.id)} aria-label={`${selectedIds.includes(asset.id) ? 'Убрать' : 'Выбрать'} ${asset.name}`} aria-pressed={selectedIds.includes(asset.id)}><AssetArtwork asset={asset} palette={composition.canvas.palette}/><span className="check-mark">{selectedIds.includes(asset.id) && <Check size={11}/>}</span>{asset.demo && <span className="demo-label">DEMO</span>}</button>
        <div className="asset-card-title"><span>{asset.name}</span><button aria-label={`Добавить ${asset.name} на холст`} title="Добавить на холст" onClick={() => addElement(asset.id)}><Plus size={14}/></button></div>
        <div className="asset-meta"><span>{asset.sizeVariants.join(' / ')}</span><button aria-label={`Настроить ${asset.name}`} onClick={() => setEditing(asset)}><SlidersHorizontal size={11}/></button></div>
      </div>)}</div>
      {!filtered.length && <div className="empty-small">Ничего не найдено.<br/>Попробуйте другой запрос.</div>}
      <div className="library-note"><span className="tiny-dot"/><div><strong>Ваша графика. Новые сочетания.</strong><p>Композиции собираются только из элементов библиотеки.</p></div></div>
    </div>
    <div className="library-footer"><input ref={fileInput} type="file" multiple accept=".svg,image/svg+xml" hidden onChange={e => void upload(e.target.files)}/><button className="button import-button" onClick={() => fileInput.current?.click()}><Upload size={15}/>Импорт SVG</button><p>Файлы SVG · до 2 МБ каждый</p></div>
    {editing && <AssetSettings assetId={editing.id} close={() => setEditing(null)}/>}
  </aside>;
}
