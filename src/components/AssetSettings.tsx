import { useState } from 'react';
import { X } from 'lucide-react';
import { useStudio } from '../store/useStudio';
import { sourceColors } from '../services/PaletteService';
import type { ColorRole } from '../types';
export function AssetSettings({ assetId, close }: { assetId: string; close: () => void }) {
  const asset = useStudio(s => s.assets.find(a => a.id === assetId)!);
  const update = useStudio(s => s.updateAsset); const [tags, setTags] = useState(asset.tags.join(', '));
  const [map, setMap] = useState(asset.colorMap);
  return <div className="modal-backdrop" onClick={close}><section className="modal compact" role="dialog" aria-modal="true" aria-labelledby="asset-settings-title" onClick={e => e.stopPropagation()}><div className="modal-heading"><div><span className="eyebrow">БИБЛИОТЕКА</span><h2 id="asset-settings-title">{asset.name}</h2></div><button className="icon-button" onClick={close} aria-label="Закрыть настройки"><X size={20}/></button></div><label className="field-label">Теги для подбора по теме<input value={tags} onChange={e => setTags(e.target.value)} placeholder="книга, обучение"/></label><h3>Карта цветов</h3><p className="muted">Назначьте каждому исходному цвету роль. Неопределённые цвета сохраняются без изменений. Для фоновых версий используются только фоновые оттенки.</p><div className="color-map">{sourceColors(asset).map(color => <label key={color}><span className="color-chip" style={{ background: color }}/><code>{color}</code><select value={map[color] ?? ''} onChange={e => setMap({ ...map, [color]: e.target.value as ColorRole })}><option value="">Сохранить исходный</option><option value="mainObjectColors">Основной цвет</option><option value="accents">Акцент</option><option value="shadows">Тень</option><option value="outlines">Обводка</option><option value="backgroundDecorations">Фоновый декор</option></select></label>)}</div><button className="button primary full" onClick={() => { update(assetId, { tags: tags.split(',').map(t => t.trim()).filter(Boolean), colorMap: Object.fromEntries(Object.entries(map).filter(([,v]) => v)) }); close(); }}>Сохранить настройки</button></section></div>;
}
