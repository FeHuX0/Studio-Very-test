import { Download, RefreshCw, Sparkles } from 'lucide-react';
import { useStudio } from '../store/useStudio';
import { CompositionArtwork } from './Artwork';
import { downloadFile, exportSvg } from '../services/SvgExportService';
import { generateCompositions } from '../services/CompositionEngine';
export function VariantsPanel({ openGenerator }: { openGenerator: () => void }) {
  const { variants, composition, assets, commit, setVariants, notify } = useStudio();
  function regenerate(index: number) {
    try {
      const old = variants[index];
      const selectedIds = [...new Set(old.elements.filter(e => e.role === 'main').map(e => e.objectId))];
      const next = generateCompositions({ assets, selectedIds: selectedIds.length ? selectedIds : [...new Set(old.elements.map(e => e.objectId))], palette: old.canvas.palette, format: old.canvas.format, count: 6, seed: old.seed + 1637, density: .5, size: 'auto' }).find(c => c.strategy === old.strategy)!;
      const updated = variants.map((v,i) => i === index ? next : v); setVariants(updated,index);
    } catch (e) { notify((e as Error).message); }
  }
  return <section className="variants-panel"><div className="variants-heading"><div><Sparkles size={16}/><h2>Варианты композиции</h2><span className="count">{variants.length}</span><p>Одна идея — разное настроение</p></div><button className="text-button" onClick={openGenerator}><RefreshCw size={13}/>Новые варианты</button></div>
    <div className="variants-grid">{variants.map((variant,index) => <article key={variant.id} className={`variant-card ${composition.id === variant.id ? 'selected' : ''}`}><button className="variant-preview" onClick={() => commit(variant)} aria-label={`Открыть вариант ${index+1}: ${variant.name}`}><CompositionArtwork composition={variant} assets={assets}/><span className="variant-number">{String(index+1).padStart(2,'0')}</span>{composition.id === variant.id && <span className="variant-current">В редакторе</span>}</button><div className="variant-info"><button onClick={() => commit(variant)}><strong>{variant.name}</strong><span>{variant.elements.length} элементов · SVG</span></button><div><button aria-label={`Перегенерировать вариант ${index+1}`} onClick={() => regenerate(index)}><RefreshCw size={13}/></button><button aria-label={`Экспортировать вариант ${index+1}`} onClick={() => { try { downloadFile(exportSvg(variant,assets),`forma-${index+1}.svg`,'image/svg+xml'); } catch (e) { notify((e as Error).message); } }}><Download size={14}/></button></div></div></article>)}<button className="add-variant" onClick={openGenerator}><span>+</span><strong>А что, если иначе?</strong><small>Создать ещё варианты</small></button></div>
  </section>;
}
