import { useState } from 'react';
import { ArrowRight, Check, Search, Sparkles, WandSparkles, X } from 'lucide-react';
import { useStudio } from '../store/useStudio';
import { PALETTES, PALETTE_IDS, FORMATS } from '../data/palettes';
import { generateCompositions } from '../services/CompositionEngine';
import { matchComponentsByNames, matchTopic } from '../services/SemanticMatcher';
import type { FormatId, PaletteId, Size } from '../types';
export function GenerationModal({ close }: { close: () => void }) {
  const state = useStudio(); const [mode, setMode] = useState<'topic'|'selected'>('selected');
  const [topic, setTopic] = useState('Креативность и новые идеи');
  const [componentNames, setComponentNames] = useState('');
  const [palette, setPalette] = useState<PaletteId>(state.composition.canvas.palette);
  const [format, setFormat] = useState<FormatId>(state.composition.canvas.format); const [count, setCount] = useState<3|6>(3);
  const [density, setDensity] = useState(.6); const [size, setSize] = useState<Size | 'auto'>('auto'); const [seed, setSeed] = useState(Math.floor(Date.now()/1000)%1000000);
  const [error, setError] = useState(''); const [busy, setBusy] = useState(false);
  const match = matchTopic(topic, state.assets);
  const namedMatches = componentNames.trim() ? matchComponentsByNames(componentNames, state.assets) : [];
  function applyNamedComponents() {
    if (!namedMatches.length) {
      setError('По введённым названиям компоненты не найдены. Проверьте названия или выберите их ниже.');
      return;
    }
    setError('');
    state.setSelectedIds(namedMatches.map(a => a.id));
  }
  function generate() {
    setBusy(true); setError('');
    setTimeout(() => {
      try {
        let chosenIds = state.selectedIds;
        if (mode === 'selected' && componentNames.trim()) {
          const matched = matchComponentsByNames(componentNames, state.assets);
          if (!matched.length) throw new Error('По введённым названиям не найдены компоненты в библиотеке.');
          chosenIds = matched.map(a => a.id);
          state.setSelectedIds(chosenIds);
        }
        if (mode === 'selected' && !chosenIds.length) throw new Error('Выберите хотя бы один элемент или введите названия компонентов.');
        if (mode === 'topic' && !topic.trim()) throw new Error('Введите тему или метафору композиции.');
        const variants = generateCompositions({ assets: state.assets, selectedIds: mode === 'selected' ? chosenIds : undefined, topic: mode === 'topic' ? topic : '', palette, format, count, density, size, seed });
        state.setVariants(variants); state.notify(`Готово: ${count} вариантов. Выберите композицию и продолжите в редакторе.`); close();
      } catch (e) { setError((e as Error).message); setBusy(false); }
    }, 50);
  }
  const activeSelectedAssets = state.assets.filter(a => state.selectedIds.includes(a.id));
  const matchedTopicNames = match.objects.slice(0, 5).map(o => state.assets.find(a => a.id === o.objectId)?.name).filter(Boolean);
  return <div className="modal-backdrop" onClick={close}><section className="modal generation-modal" role="dialog" aria-modal="true" aria-labelledby="generation-title" onClick={e => e.stopPropagation()}><div className="modal-heading"><div><span className="eyebrow"><WandSparkles size={13}/>НОВАЯ КОМПОЗИЦИЯ</span><h2 id="generation-title">Начнём с идеи</h2><p>Знакомые элементы. Совершенно новые сочетания.</p></div><button className="icon-button" aria-label="Закрыть генератор" onClick={close}><X size={20}/></button></div>
      <div className="segmented"><button className={mode === 'topic' ? 'active' : ''} onClick={() => setMode('topic')}>По теме</button><button className={mode === 'selected' ? 'active' : ''} onClick={() => setMode('selected')}>Из выбранных элементов <span>{state.selectedIds.length}</span></button></div>
      {mode === 'topic' ? <div className="topic-field"><label htmlFor="topic">О чём ваша иллюстрация?</label><textarea id="topic" value={topic} onChange={e => setTopic(e.target.value)} placeholder="Введите метафору или заголовок, например: Обучение и развитие" maxLength={500}/><div className="topic-chips">{['Обучение и развитие','Креативность и новые идеи','Командная работа','Планирование','Запуск и стремительный рост','Безопасность и стратегия'].map(t => <button key={t} onClick={() => setTopic(t)}>{t}</button>)}</div><p className="match-explanation">{match.explanation}{matchedTopicNames.length ? ` (${matchedTopicNames.join(', ')})` : ''}</p></div> : <div className="topic-field"><label htmlFor="component-names">Впишите названия нужных компонентов или выберите из библиотеки</label><div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}><input id="component-names" value={componentNames} onChange={e => setComponentNames(e.target.value)} placeholder="Например: Книга, Лампа идеи, Карандаш" style={{ flex: 1, border: '1px solid #e3d8ef', borderRadius: '7px', padding: '10px 12px', fontSize: '12px', background: '#fdfbff', color: '#7c658f' }}/><button type="button" className="button" onClick={applyNamedComponents}><Search size={14}/>Найти</button></div>{componentNames.trim() && <p className="match-explanation">{namedMatches.length ? `Найдены компоненты (${namedMatches.length}): ${namedMatches.map(a => a.name).join(' · ')}` : 'Совпадений по названиям не найдено.'}</p>}<div className="topic-chips" style={{ marginTop: '10px' }}>{state.assets.slice(0, 12).map(a => <button key={a.id} type="button" onClick={() => state.toggleAsset(a.id)} style={state.selectedIds.includes(a.id) ? { background: '#f0ecf9', borderColor: '#b9a2e4', color: '#684fb3', fontWeight: 600 } : undefined}>{state.selectedIds.includes(a.id) ? '✓ ' : '+ '}{a.name}</button>)}</div><div className="selected-summary" style={{ margin: '12px 0 0', padding: '14px 16px' }}><Sparkles size={20}/><div><strong>{state.selectedIds.length} элементов для вашей истории</strong><p>{activeSelectedAssets.map(a => a.name).join(' · ') || 'Выберите элементы кликом или введите их названия через запятую.'}</p></div></div></div>}
      <div className="generation-options"><label>Палитра<div className="palette-picker">{PALETTE_IDS.map(id => <button key={id} className={palette === id ? 'selected' : ''} onClick={() => setPalette(id)} style={{ background: PALETTES[id]?.backgroundDecorations[0] ?? '#e1d9f2' }} aria-label={`Палитра ${PALETTES[id]?.name ?? id}`}>{palette === id && <Check size={14}/>}</button>)}<span>{PALETTES[palette]?.name ?? palette}</span></div></label><label>Формат<select value={format} onChange={e => setFormat(e.target.value as FormatId)}>{Object.entries(FORMATS).map(([id,f]) => <option key={id} value={id}>{f.name} · {f.width}×{f.height}</option>)}</select></label><label>Количество вариантов<div className="segmented small"><button className={count===3?'active':''} onClick={() => setCount(3)}>3 варианта</button><button className={count===6?'active':''} onClick={() => setCount(6)}>6 вариантов</button></div></label><label>Размер исходников<select value={size} onChange={e => setSize(e.target.value as Size|'auto')}><option value="auto">Автоматически</option><option value="S">S · компактный</option><option value="L">L · детальный</option></select></label></div>
      <div className="density-row"><label>Фоновый декор<input type="range" min="0" max="1" step=".1" value={density} onChange={e => setDensity(Number(e.target.value))}/></label><label>Seed<input aria-label="Seed генерации" type="number" min="0" max="4294967295" value={seed} onChange={e => setSeed(Math.max(0, Math.min(4294967295, Number(e.target.value))))}/></label></div>
      {error && <p role="alert" className="error-message">{error}</p>}
      <div className="modal-bottom"><span><span className="status-dot"/>Локальный алгоритм · из {state.assets.length} SVG-компонентов</span><button className="button primary" onClick={generate} disabled={busy}><WandSparkles size={16}/>{busy ? 'Собираем…' : 'Сгенерировать'}<ArrowRight size={16}/></button></div>
    </section></div>;
}
