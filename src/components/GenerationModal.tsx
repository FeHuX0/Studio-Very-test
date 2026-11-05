import { useState } from 'react';
import { ArrowRight, Check, Sparkles, WandSparkles, X } from 'lucide-react';
import { useStudio } from '../store/useStudio';
import { PALETTES, PALETTE_IDS, FORMATS } from '../data/palettes';
import { generateCompositions } from '../services/CompositionEngine';
import { matchTopic } from '../services/SemanticMatcher';
import type { FormatId, PaletteId, Size } from '../types';
export function GenerationModal({ close }: { close: () => void }) {
  const state = useStudio(); const [mode, setMode] = useState<'topic'|'selected'>('selected');
  const [topic, setTopic] = useState('Креативность и новые идеи'); const [palette, setPalette] = useState<PaletteId>(state.composition.canvas.palette);
  const [format, setFormat] = useState<FormatId>(state.composition.canvas.format); const [count, setCount] = useState<3|6>(3);
  const [density, setDensity] = useState(.6); const [size, setSize] = useState<Size | 'auto'>('auto'); const [seed, setSeed] = useState(Math.floor(Date.now()/1000)%1000000);
  const [error, setError] = useState(''); const [busy, setBusy] = useState(false); const match = matchTopic(topic, state.assets);
  function generate() {
    setBusy(true); setError('');
    setTimeout(() => {
      try {
        if (mode === 'selected' && !state.selectedIds.length) throw new Error('Выберите хотя бы один элемент в библиотеке.');
        if (mode === 'topic' && !topic.trim()) throw new Error('Введите тему композиции.');
        const variants = generateCompositions({ assets: state.assets, selectedIds: mode === 'selected' ? state.selectedIds : undefined, topic: mode === 'topic' ? topic : '', palette, format, count, density, size, seed });
        state.setVariants(variants); state.notify(`Готово: ${count} вариантов. Выберите композицию и продолжите в редакторе.`); close();
      } catch (e) { setError((e as Error).message); setBusy(false); }
    }, 50);
  }
  return <div className="modal-backdrop" onClick={close}><section className="modal generation-modal" role="dialog" aria-modal="true" aria-labelledby="generation-title" onClick={e => e.stopPropagation()}><div className="modal-heading"><div><span className="eyebrow"><WandSparkles size={13}/>НОВАЯ КОМПОЗИЦИЯ</span><h2 id="generation-title">Начнём с идеи</h2><p>Знакомые элементы. Совершенно новые сочетания.</p></div><button className="icon-button" aria-label="Закрыть генератор" onClick={close}><X size={20}/></button></div>
      <div className="segmented"><button className={mode === 'topic' ? 'active' : ''} onClick={() => setMode('topic')}>По теме</button><button className={mode === 'selected' ? 'active' : ''} onClick={() => setMode('selected')}>Из выбранных элементов <span>{state.selectedIds.length}</span></button></div>
      {mode === 'topic' ? <div className="topic-field"><label htmlFor="topic">О чём ваша иллюстрация?</label><textarea id="topic" value={topic} onChange={e => setTopic(e.target.value)} placeholder="Например, обучение и развитие" maxLength={500}/><div className="topic-chips">{['Обучение и развитие','Командная работа','Планирование'].map(t => <button key={t} onClick={() => setTopic(t)}>{t}</button>)}</div><p className="match-explanation">{match.explanation}</p></div> : <div className="selected-summary"><Sparkles size={22}/><div><strong>{state.selectedIds.length} элементов для вашей истории</strong><p>{state.assets.filter(a => state.selectedIds.includes(a.id)).map(a => a.name).join(' · ') || 'Выберите элементы в левой панели.'}</p></div></div>}
      <div className="generation-options"><label>Палитра<div className="palette-picker">{PALETTE_IDS.map(id => <button key={id} className={palette === id ? 'selected' : ''} onClick={() => setPalette(id)} style={{ background: PALETTES[id].backgroundDecorations[0] }} aria-label={`Палитра ${PALETTES[id].name}`}>{palette === id && <Check size={14}/>}</button>)}<span>{PALETTES[palette].name}</span></div></label><label>Формат<select value={format} onChange={e => setFormat(e.target.value as FormatId)}>{Object.entries(FORMATS).map(([id,f]) => <option key={id} value={id}>{f.name} · {f.width}×{f.height}</option>)}</select></label><label>Количество вариантов<div className="segmented small"><button className={count===3?'active':''} onClick={() => setCount(3)}>3 варианта</button><button className={count===6?'active':''} onClick={() => setCount(6)}>6 вариантов</button></div></label><label>Размер исходников<select value={size} onChange={e => setSize(e.target.value as Size|'auto')}><option value="auto">Автоматически</option><option value="S">S · компактный</option><option value="L">L · детальный</option></select></label></div>
      <div className="density-row"><label>Фоновый декор<input type="range" min="0" max="1" step=".1" value={density} onChange={e => setDensity(Number(e.target.value))}/></label><label>Seed<input aria-label="Seed генерации" type="number" min="0" max="4294967295" value={seed} onChange={e => setSeed(Math.max(0, Math.min(4294967295, Number(e.target.value))))}/></label></div>
      {error && <p role="alert" className="error-message">{error}</p>}
      <div className="modal-bottom"><span><span className="status-dot"/>Локальный алгоритм · без API-ключей</span><button className="button primary" onClick={generate} disabled={busy}><WandSparkles size={16}/>{busy ? 'Собираем…' : 'Сгенерировать'}<ArrowRight size={16}/></button></div>
    </section></div>;
}
