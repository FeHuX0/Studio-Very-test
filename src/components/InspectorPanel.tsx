import { ArrowDown, ArrowUp, Check, ChevronDown, Copy, Eye, EyeOff, Layers3, RotateCw, Settings2, Trash2 } from 'lucide-react';
import { useStudio } from '../store/useStudio';
import { PALETTES, PALETTE_IDS, FORMATS } from '../data/palettes';
import { availableRoles, sourceFor, sourceColors } from '../services/PaletteService';
import type { FormatId, Role, Size } from '../types';
import { AssetArtwork } from './Artwork';
export function InspectorPanel() {
  const state = useStudio();
  const { composition, assets, selectedElement } = state;
  const element = composition.elements.find(e => e.id === selectedElement);
  const asset = element && assets.find(a => a.id === element.objectId);
  return <aside className="inspector-panel">
    <div className="panel-heading"><div><Settings2 size={17}/><h2>Настройки</h2></div></div>
    <div className="inspector-scroll">
      <section className="inspector-section"><h3>Цветовая палитра<span className="small-badge">3</span></h3><div className="palette-list">{PALETTE_IDS.map(id => <button className={`palette-option ${composition.canvas.palette === id ? 'selected' : ''}`} key={id} onClick={() => state.setPalette(id)} aria-pressed={composition.canvas.palette === id}><span className="palette-colors">{[PALETTES[id].backgroundDecorations[0], PALETTES[id].mainObjectColors[0], PALETTES[id].shadows[0]].map(c => <i key={c} style={{ background: c }}/>)}</span><span>{PALETTES[id].name}</span>{composition.canvas.palette === id && <Check size={14}/>}</button>)}</div></section>
      <section className="inspector-section"><h3>Формат холста</h3><div className="format-grid">{Object.entries(FORMATS).map(([id, f]) => <button key={id} className={`format-option ${composition.canvas.format === id ? 'selected' : ''}`} onClick={() => state.setFormat(id as FormatId)} aria-pressed={composition.canvas.format === id}><span className={`format-shape ${id}`}/><strong>{f.name}</strong><small>{f.width} × {f.height}</small></button>)}</div></section>
      <section className="inspector-section element-inspector"><h3>{asset ? asset.name : 'Параметры объекта'}<RotateCw size={14}/></h3>{element && asset ? <>
        <div className="two-fields"><label>X, %<input type="number" min="0" max="100" step="1" value={Math.round(element.x*100)} onChange={e => state.updateElement(element.id, { x: Math.max(0, Math.min(1, Number(e.target.value)/100)) })}/></label><label>Y, %<input type="number" min="0" max="100" step="1" value={Math.round(element.y*100)} onChange={e => state.updateElement(element.id, { y: Math.max(0, Math.min(1, Number(e.target.value)/100)) })}/></label></div>
        <div className="two-fields"><label>Масштаб, %<input type="number" min="4" max="150" value={Math.round(element.scale*100)} onChange={e => state.updateElement(element.id, { scale: Math.max(.04, Math.min(1.5, Number(e.target.value)/100)) })}/></label><label>Поворот, °<input type="number" min="-360" max="360" value={Math.round(element.rotation)} onChange={e => state.updateElement(element.id, { rotation: Math.max(-360, Math.min(360, Number(e.target.value))) })}/></label></div>
        <div className="two-fields"><label>Роль<select value={element.role} onChange={e => state.updateElement(element.id, { role: e.target.value as Role })}>{availableRoles(asset).map(role => <option key={role} value={role}>{role === 'main' ? 'Главный' : 'Фоновый'}</option>)}</select></label><label>Исходник<select value={element.size} onChange={e => state.updateElement(element.id, { size: e.target.value as Size })}>{(['S','L'] as Size[]).filter(size => sourceFor(asset, element.role, size)).map(size => <option key={size} value={size}>{size}{!asset.sources[`${element.role}:${size}`] ? ' (резерв)' : ''}</option>)}</select></label></div>
        {!asset.demo && sourceColors(asset).some(color => !asset.colorMap[color]) && <p className="warning-inline">Неопределённые цвета оригинала сохранены. Для полной перекраски задайте карту цветов в библиотеке.</p>}
        <div className="object-actions"><button title="Дублировать" aria-label="Дублировать объект" onClick={state.duplicate}><Copy size={15}/></button><button title="На слой выше" aria-label="На слой выше" onClick={() => state.layer(1)}><ArrowUp size={15}/></button><button title="На слой ниже" aria-label="На слой ниже" onClick={() => state.layer(-1)}><ArrowDown size={15}/></button><button title="Удалить" aria-label="Удалить объект" onClick={state.remove}><Trash2 size={15}/></button></div>
      </> : <div className="object-empty"><MouseSymbol/><p>Выберите объект на холсте,<br/>чтобы настроить его</p></div>}</section>
      <section className="inspector-section layers-section"><h3><span><Layers3 size={15}/>Слои</span><span className="small-badge">{composition.elements.length}</span></h3><div className="layer-list">{[...composition.elements].sort((a,b) => b.zIndex-a.zIndex).map(e => {
        const a = assets.find(v => v.id === e.objectId); if (!a) return null;
        return <div key={e.id} className={`layer-item ${selectedElement === e.id ? 'selected' : ''} ${e.hidden ? 'is-hidden' : ''}`}><button className="layer-select" onClick={() => state.selectElement(e.id)}><AssetArtwork asset={a} palette={composition.canvas.palette}/><span>{a.name}<small>{e.role === 'main' ? 'Главный объект' : 'Фоновый объект'}</small></span></button><button className="visibility-button" aria-label={`${e.hidden ? 'Показать' : 'Скрыть'} слой ${a.name}`} onClick={() => state.updateElement(e.id, { hidden: !e.hidden })}>{e.hidden ? <EyeOff size={13}/> : <Eye size={13}/>}</button></div>;
      })}</div><div className="background-layer"><span style={{ background: PALETTES[composition.canvas.palette].background }}/><span>Фон холста</span><ChevronDown size={12}/></div></section>
    </div>
    <div className="inspector-footer"><span className="status-dot"/>Вектор на каждом этапе</div>
  </aside>;
}
function MouseSymbol() { return <svg width="28" height="28" viewBox="0 0 28 28" fill="none"><path d="m8 4 14 13-8 1-4 7-2-21Z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round"/></svg>; }
