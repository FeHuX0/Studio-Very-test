import { useRef, useState } from 'react';
import { ArrowDown, ArrowUp, Check, ChevronDown, Copy, Eye, EyeOff, Layers3, Plus, RotateCw, Settings2, Trash2, Upload } from 'lucide-react';
import { useStudio } from '../store/useStudio';
import { PALETTES, PALETTE_IDS, FORMATS, parseUploadedPalette, registerCustomPalette } from '../data/palettes';
import { autoMapAssetColors, availableRoles, sourceFor, sourceColors } from '../services/PaletteService';
import type { FormatId, Role, Size } from '../types';
import { AssetArtwork } from './Artwork';
export function InspectorPanel() {
  const state = useStudio();
  const { composition, assets, selectedElement } = state;
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [customName, setCustomName] = useState('Ocean');
  const [customBg, setCustomBg] = useState('#eef6ff');
  const [customMain, setCustomMain] = useState('#4c6ef5');
  const [customAccent, setCustomAccent] = useState('#f59f00');
  const [customShadow, setCustomShadow] = useState('#364fc7');
  const [customOutline, setCustomOutline] = useState('#1e293b');
  const paletteFileRef = useRef<HTMLInputElement>(null);
  const element = composition.elements.find(e => e.id === selectedElement);
  const asset = element && assets.find(a => a.id === element.objectId);

  function autoMapAllAssets() {
    for (const item of state.assets) {
      if (!item.demo && Object.keys(item.colorMap).length === 0) {
        state.updateAsset(item.id, { colorMap: autoMapAssetColors(item) });
      }
    }
  }

  function applyCustomPalette() {
    const id = `custom-${customName.trim().toLowerCase().replace(/[^a-zа-я0-9]+/gi, '-') || 'palette'}`;
    const registered = registerCustomPalette({
      id,
      name: customName.trim() || 'Custom',
      label: customName.trim() || 'Custom',
      background: customBg,
      backgroundDecorations: ['#dbe4ff', '#bac8ff'],
      mainObjectColors: [customMain, '#748ffc', '#91a7ff'],
      accents: [customAccent],
      shadows: [customShadow],
      outlines: [customOutline],
    });
    autoMapAllAssets();
    state.setPalette(registered);
    setPaletteOpen(false);
    state.notify(`Палитра «${customName.trim() || 'Custom'}» загружена, композиция автоматически перекрашена.`);
  }

  async function uploadPaletteFile(file: File | undefined) {
    if (!file) return;
    try {
      const parsed = parseUploadedPalette(await file.text(), file.name);
      const id = registerCustomPalette(parsed);
      autoMapAllAssets();
      state.setPalette(id);
      setPaletteOpen(false);
      state.notify(`Палитра «${parsed.name}» загружена из файла и применена к композиции.`);
    } catch (err) {
      state.notify((err as Error).message);
    }
    if (paletteFileRef.current) paletteFileRef.current.value = '';
  }

  return <aside className="inspector-panel">
    <div className="panel-heading"><div><Settings2 size={17}/><h2>Настройки</h2></div></div>
    <div className="inspector-scroll">
      <section className="inspector-section">
        <h3><span>Цветовая палитра</span><span className="small-badge">{PALETTE_IDS.length}</span></h3>
        <div className="palette-list">{PALETTE_IDS.map(id => {
          const pal = PALETTES[id] ?? PALETTES.lavender;
          return <button className={`palette-option ${composition.canvas.palette === id ? 'selected' : ''}`} key={id} onClick={() => state.setPalette(id)} aria-pressed={composition.canvas.palette === id}><span className="palette-colors">{[pal.backgroundDecorations[0], pal.mainObjectColors[0], pal.shadows[0]].map((c, idx) => <i key={`${id}-${idx}`} style={{ background: c }}/>)}</span><span>{pal.name}</span>{composition.canvas.palette === id && <Check size={14}/>}</button>;
        })}</div>
        <div style={{ display: 'flex', gap: '6px', marginTop: '8px' }}>
          <button type="button" className="button" style={{ flex: 1, minHeight: '30px', padding: '6px 10px', fontSize: '11px' }} onClick={() => setPaletteOpen(!paletteOpen)}><Plus size={13}/>Загрузить палитру</button>
          <input ref={paletteFileRef} type="file" accept=".json,.svg,application/json,image/svg+xml" hidden onChange={e => void uploadPaletteFile(e.target.files?.[0])}/>
          <button type="button" className="button" title="Импорт палитры из SVG или JSON" aria-label="Импорт палитры из файла" style={{ minHeight: '30px', padding: '6px 9px' }} onClick={() => paletteFileRef.current?.click()}><Upload size={13}/></button>
        </div>
        {paletteOpen && <div className="import-options" style={{ marginTop: '8px', borderRadius: '6px', border: '1px solid #ece8f1' }}>
          <strong>Новая цветовая палитра</strong>
          <label>Название<input value={customName} onChange={e => setCustomName(e.target.value)} placeholder="Ocean"/></label>
          <div className="two-fields" style={{ marginTop: '8px' }}>
            <label>Фон<input type="color" value={customBg} onChange={e => setCustomBg(e.target.value)} style={{ height: '30px', padding: '2px' }}/></label>
            <label>Основной<input type="color" value={customMain} onChange={e => setCustomMain(e.target.value)} style={{ height: '30px', padding: '2px' }}/></label>
            <label>Акцент<input type="color" value={customAccent} onChange={e => setCustomAccent(e.target.value)} style={{ height: '30px', padding: '2px' }}/></label>
            <label>Тень / контур<input type="color" value={customShadow} onChange={e => { setCustomShadow(e.target.value); setCustomOutline(e.target.value); }} style={{ height: '30px', padding: '2px' }}/></label>
          </div>
          <button type="button" className="button primary full" style={{ marginTop: '10px', minHeight: '30px', padding: '6px 10px', fontSize: '11px' }} onClick={applyCustomPalette}>Применить и перекрасить</button>
        </div>}
      </section>
      <section className="inspector-section"><h3>Формат холста</h3><div className="format-grid">{Object.entries(FORMATS).map(([id, f]) => <button key={id} className={`format-option ${composition.canvas.format === id ? 'selected' : ''}`} onClick={() => state.setFormat(id as FormatId)} aria-pressed={composition.canvas.format === id}><span className={`format-shape ${id}`}/><strong>{f.name}</strong><small>{f.width} × {f.height}</small></button>)}</div></section>
      <section className="inspector-section element-inspector"><h3>{asset ? asset.name : 'Параметры объекта'}<RotateCw size={14}/></h3>{element && asset ? <>
        <div className="two-fields"><label>X, %<input type="number" min="0" max="100" step="1" value={Math.round(element.x*100)} onChange={e => state.updateElement(element.id, { x: Math.max(0, Math.min(1, Number(e.target.value)/100)) })}/></label><label>Y, %<input type="number" min="0" max="100" step="1" value={Math.round(element.y*100)} onChange={e => state.updateElement(element.id, { y: Math.max(0, Math.min(1, Number(e.target.value)/100)) })}/></label></div>
        <div className="two-fields"><label>Масштаб, %<input type="number" min="4" max="150" value={Math.round(element.scale*100)} onChange={e => state.updateElement(element.id, { scale: Math.max(.04, Math.min(1.5, Number(e.target.value)/100)) })}/></label><label>Поворот, °<input type="number" min="-360" max="360" value={Math.round(element.rotation)} onChange={e => state.updateElement(element.id, { rotation: Math.max(-360, Math.min(360, Number(e.target.value))) })}/></label></div>
        <div className="two-fields"><label>Роль<select value={element.role} onChange={e => state.updateElement(element.id, { role: e.target.value as Role })}>{availableRoles(asset).map(role => <option key={role} value={role}>{role === 'main' ? 'Главный' : 'Фоновый'}</option>)}</select></label><label>Исходник<select value={element.size} onChange={e => state.updateElement(element.id, { size: e.target.value as Size })}>{(['S','L'] as Size[]).filter(size => sourceFor(asset, element.role, size)).map(size => <option key={size} value={size}>{size}{!asset.sources[`${element.role}:${size}`] ? ' (резерв)' : ''}</option>)}</select></label></div>
        {!asset.demo && sourceColors(asset).some(color => !asset.colorMap[color]) && <p className="warning-inline">Неопределённые цвета оригинала сохранены. <button type="button" className="text-button" style={{ textDecoration: 'underline', display: 'inline' }} onClick={() => state.updateAsset(asset.id, { colorMap: autoMapAssetColors(asset) })}>Назначить карту автоматически</button></p>}
        <div className="object-actions"><button title="Дублировать" aria-label="Дублировать объект" onClick={state.duplicate}><Copy size={15}/></button><button title="На слой выше" aria-label="На слой выше" onClick={() => state.layer(1)}><ArrowUp size={15}/></button><button title="На слой ниже" aria-label="На слой ниже" onClick={() => state.layer(-1)}><ArrowDown size={15}/></button><button title="Удалить" aria-label="Удалить объект" onClick={state.remove}><Trash2 size={15}/></button></div>
      </> : <div className="object-empty"><MouseSymbol/><p>Выберите объект на холсте,<br/>чтобы настроить его</p></div>}</section>
      <section className="inspector-section layers-section"><h3><span><Layers3 size={15}/>Слои</span><span className="small-badge">{composition.elements.length}</span></h3><div className="layer-list">{[...composition.elements].sort((a,b) => b.zIndex-a.zIndex).map(e => {
        const a = assets.find(v => v.id === e.objectId); if (!a) return null;
        return <div key={e.id} className={`layer-item ${selectedElement === e.id ? 'selected' : ''} ${e.hidden ? 'is-hidden' : ''}`}><button className="layer-select" onClick={() => state.selectElement(e.id)}><AssetArtwork asset={a} palette={composition.canvas.palette}/><span>{a.name}<small>{e.role === 'main' ? 'Главный объект' : 'Фоновый объект'}</small></span></button><button className="visibility-button" aria-label={`${e.hidden ? 'Показать' : 'Скрыть'} слой ${a.name}`} onClick={() => state.updateElement(e.id, { hidden: !e.hidden })}>{e.hidden ? <EyeOff size={13}/> : <Eye size={13}/>}</button></div>;
      })}</div><div className="background-layer"><span style={{ background: (PALETTES[composition.canvas.palette] ?? PALETTES.lavender).background }}/><span>Фон холста</span><ChevronDown size={12}/></div></section>
    </div>
    <div className="inspector-footer"><span className="status-dot"/>Вектор на каждом этапе</div>
  </aside>;
}
function MouseSymbol() { return <svg width="28" height="28" viewBox="0 0 28 28" fill="none"><path d="m8 4 14 13-8 1-4 7-2-21Z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round"/></svg>; }
