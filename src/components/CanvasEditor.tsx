import { useId, useMemo, useRef, useState, type PointerEvent } from 'react';
import { Crosshair, Hand, Maximize2, Minus, MousePointer2, Plus, RotateCcw } from 'lucide-react';
import { useStudio } from '../store/useStudio';
import { PALETTES, FORMATS } from '../data/palettes';
import { elementDimensions, fitElement } from '../services/CompositionEngine';
import { instanceMarkup } from '../services/SvgExportService';
import type { ElementInstance } from '../types';
type Gesture = { pointer: number; kind: 'move' | 'scale' | 'rotate'; id: string; startX: number; startY: number; initial: ElementInstance; centerX: number; centerY: number; startDistance: number; startAngle: number };
export function CanvasEditor() {
  const { composition, assets, selectedElement, selectElement, checkpoint, updateElement } = useStudio();
  const [zoom, setZoom] = useState(1); const [guides, setGuides] = useState(false); const [tool, setTool] = useState<'select' | 'hand'>('select');
  const [pan, setPan] = useState({ x:0, y:0 });
  const panGesture = useRef<{ x:number; y:number; originX:number; originY:number } | null>(null);
  const svgRef = useRef<SVGSVGElement>(null); const gesture = useRef<Gesture | null>(null);
  const sceneId = useId();
  const { width, height, palette, format } = composition.canvas;
  const sorted = useMemo(() => [...composition.elements].sort((a, b) => a.zIndex - b.zIndex), [composition.elements]);
  const clientToSvg = (x: number, y: number) => {
    const svg = svgRef.current!; const point = svg.createSVGPoint(); point.x = x; point.y = y;
    return point.matrixTransform(svg.getScreenCTM()!.inverse());
  };
  function start(event: PointerEvent<SVGGElement>, element: ElementInstance, kind: Gesture['kind']) {
    if (tool === 'hand') return;
    event.stopPropagation(); event.preventDefault(); selectElement(element.id); checkpoint();
    const p = clientToSvg(event.clientX, event.clientY); const cx = element.x * width; const cy = element.y * height;
    gesture.current = { pointer: event.pointerId, kind, id: element.id, startX: p.x, startY: p.y, initial: { ...element }, centerX: cx, centerY: cy, startDistance: Math.max(1, Math.hypot(p.x - cx, p.y - cy)), startAngle: Math.atan2(p.y - cy, p.x - cx) };
    svgRef.current!.setPointerCapture(event.pointerId);
  }
  function move(event: PointerEvent<SVGSVGElement>) {
    const drag = gesture.current; if (!drag || event.pointerId !== drag.pointer) return;
    const p = clientToSvg(event.clientX, event.clientY); let element = { ...drag.initial };
    if (drag.kind === 'move') { element.x += (p.x - drag.startX) / width; element.y += (p.y - drag.startY) / height; }
    if (drag.kind === 'scale') element.scale = Math.max(.04, Math.min(1.5, drag.initial.scale * Math.hypot(p.x - drag.centerX, p.y - drag.centerY) / drag.startDistance));
    if (drag.kind === 'rotate') element.rotation = drag.initial.rotation + (Math.atan2(p.y - drag.centerY, p.x - drag.centerX) - drag.startAngle) * 180 / Math.PI;
    if (event.shiftKey && drag.kind === 'rotate') element.rotation = Math.round(element.rotation / 15) * 15;
    const asset = assets.find(a => a.id === element.objectId)!;
    element = fitElement(asset, element, composition.canvas);
    updateElement(drag.id, element, false);
  }
  function stop() { gesture.current = null; }
  const selected = composition.elements.find(e => e.id === selectedElement);
  return <section className="canvas-area">
    <div className="workspace-heading"><div><span className="workspace-dot"/>Холст <span className="breadcrumb-slash">/</span><span className="muted">{FORMATS[format].name}</span></div><span>{width} × {height} px <span className="svg-pill">SVG</span></span></div>
    <div className={`canvas-viewport ${tool === 'hand' ? 'hand-mode' : ''}`} onPointerDown={event => {
      if (tool !== 'hand' || (event.target as Element).closest('button')) return;
      panGesture.current = { x:event.clientX, y:event.clientY, originX:pan.x, originY:pan.y };
      event.currentTarget.setPointerCapture(event.pointerId);
    }} onPointerMove={event => {
      if (panGesture.current) setPan({ x:panGesture.current.originX+event.clientX-panGesture.current.x, y:panGesture.current.originY+event.clientY-panGesture.current.y });
    }} onPointerUp={() => { panGesture.current = null; }} onPointerCancel={() => { panGesture.current = null; }}>
      <div className="canvas-tools"><button className={`icon-button ${tool === 'select' ? 'active' : ''}`} aria-label="Выбор объектов" title="Выбор объектов" onClick={() => setTool('select')}><MousePointer2 size={17}/></button><button className={`icon-button ${tool === 'hand' ? 'active' : ''}`} aria-label="Перемещение холста" title="Перемещение холста" onClick={() => setTool('hand')}><Hand size={17}/></button><span/><button className={`icon-button ${guides ? 'active' : ''}`} aria-label="Показать направляющие" aria-pressed={guides} onClick={() => setGuides(!guides)}><Crosshair size={17}/></button></div>
      <div className="artboard-shell" style={{ aspectRatio: `${width}/${height}`, width: `${format === 'landscape' ? 89 : format === 'story' ? 40 : format === 'portrait' ? 55 : 66}%`, transform:`translate(${pan.x}px, ${pan.y}px) scale(${zoom})` }}>
        <span className="artboard-label">{useStudio(s => s.title)} <span>01</span></span>
        <svg ref={svgRef} className="artboard" viewBox={`0 0 ${width} ${height}`} aria-label="Холст композиции" role="img" onPointerDown={() => selectElement(null)} onPointerMove={move} onPointerUp={stop} onPointerCancel={stop} onLostPointerCapture={stop} style={{ background: (PALETTES[palette] ?? PALETTES.lavender).background }}>
          {sorted.filter(e => !e.hidden).map(element => {
            const asset = assets.find(a => a.id === element.objectId); if (!asset) return null;
            const dim = elementDimensions(asset, element, composition.canvas); const isSelected = selectedElement === element.id;
            let markup = ''; try { markup = instanceMarkup(asset, element, composition, sceneId); } catch { return null; }
            return <g key={element.id} transform={`translate(${element.x * width} ${element.y * height}) rotate(${element.rotation})`} onPointerDown={e => start(e, element, 'move')} className="canvas-element" data-testid={`canvas-${asset.id}`}>
              <g dangerouslySetInnerHTML={{ __html: markup }} pointerEvents="none"/>
              <rect x={-dim.width/2} y={-dim.height/2} width={dim.width} height={dim.height} fill="transparent" stroke={isSelected ? '#8064d3' : 'transparent'} strokeWidth={2} vectorEffect="non-scaling-stroke"/>
              {isSelected && <g className="selection-handles">{[[-1,-1],[1,-1],[-1,1],[1,1]].map(([x,y]) => <rect key={`${x}${y}`} x={x*dim.width/2-7} y={y*dim.height/2-7} width="14" height="14" fill="white" stroke="#8064d3" strokeWidth="2" style={{ cursor: 'nwse-resize' }} onPointerDown={e => start(e, element, 'scale')}/>)}<path d={`M0 ${-dim.height/2}v-40`} stroke="#8064d3" strokeWidth="2"/><circle cx="0" cy={-dim.height/2-40} r="10" fill="white" stroke="#8064d3" strokeWidth="2" style={{ cursor: 'grab' }} onPointerDown={e => start(e, element, 'rotate')}/></g>}
            </g>;
          })}
          {guides && <g pointerEvents="none" opacity=".4" stroke="#9a83c5" strokeDasharray="8 8" strokeWidth="1.5"><path d={`M${width/2} 0v${height}M0 ${height/2}h${width}M${width/3} 0v${height}M${2*width/3} 0v${height}M0 ${height/3}h${width}M0 ${2*height/3}h${width}`}/></g>}
          {!composition.elements.length && <text x={width/2} y={height/2} textAnchor="middle" fill="#9b8cb5" fontSize="28">Добавьте элементы из библиотеки</text>}
        </svg>
        <span className="artboard-dimension">{width} × {height}</span>
      </div>
      <div className="zoom-control"><button aria-label="Уменьшить масштаб" onClick={() => setZoom(z => Math.max(.5, z-.1))}><Minus size={14}/></button><span>{Math.round(zoom*100)}%</span><button aria-label="Увеличить масштаб" onClick={() => setZoom(z => Math.min(2, z+.1))}><Plus size={14}/></button><i/><button aria-label="Вписать холст" onClick={() => { setZoom(1); setPan({ x:0, y:0 }); setTool('select'); }}><Maximize2 size={14}/></button></div>
    </div>
    <div className="canvas-status"><span><span className="status-dot"/>{composition.elements.filter(e => !e.hidden).length} элементов на холсте</span><span>{selected ? 'Перетащите объект · Shift: поворот по 15°' : 'Выберите элемент, чтобы изменить композицию'}</span><button title="Снять выделение" aria-label="Снять выделение" onClick={() => selectElement(null)}><RotateCcw size={13}/></button></div>
  </section>;
}
