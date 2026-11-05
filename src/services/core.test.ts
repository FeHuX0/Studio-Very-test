import { beforeEach, describe, expect, it, vi } from 'vitest';
vi.mock('./storage', () => {
  const data = new Map<string,string>();
  return { indexedStorage: { getItem: async (k:string)=>data.get(k) ?? null, setItem: async(k:string,v:string)=>{data.set(k,v);}, removeItem: async(k:string)=>{data.delete(k);} } };
});
import { DEMO_ASSETS } from '../data/demo';
import { FORMATS, PALETTES } from '../data/palettes';
import type { Asset, GenerationOptions } from '../types';
import { adaptFormat, elementDimensions, generateCompositions, seededRandom } from './CompositionEngine';
import { importSvg, mergeAssets, parseSvg } from './SvgImportService';
import { coloredSvg } from './PaletteService';
import { exportProject, exportSvg, importProject } from './SvgExportService';
import { matchTopic } from './SemanticMatcher';
import { useStudio } from '../store/useStudio';

const options: GenerationOptions = { assets: DEMO_ASSETS, selectedIds: DEMO_ASSETS.slice(0,4).map(a => a.id), palette:'lavender', format:'square', count:6, seed:1234, density:.5, size:'auto' };
const svg = (body: string, box='0 0 200 100') => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${box}">${body}</svg>`;

describe('CompositionEngine', () => {
  it('reproduces the complete generation for the same seed', () => {
    expect(generateCompositions(options)).toEqual(generateCompositions(options));
    const a = seededRandom(4), b = seededRandom(4);
    expect(Array.from({length:10},a)).toEqual(Array.from({length:10},b));
  });
  it('uses six distinct strategies and changes arrangements', () => {
    const variants = generateCompositions(options);
    expect(new Set(variants.map(c => c.strategy)).size).toBe(6);
    const layouts = variants.map(c => JSON.stringify(c.elements.map(e => [e.x,e.y,e.rotation])));
    expect(new Set(layouts).size).toBe(6);
    expect(variants.every(c => c.score > 40 && c.score <= 100)).toBe(true);
  });
  it.each(Object.keys(FORMATS) as (keyof typeof FORMATS)[])('fits rotated objects in %s and preserves proportions', format => {
    const wide = importSvg(svg('<rect width="200" height="100" fill="#abc"/>'), 'wide.svg');
    const variants = generateCompositions({...options, assets:[wide], selectedIds:[wide.id], format});
    for (const c of variants) for (const e of c.elements) {
      const dim = elementDimensions(wide,e,c.canvas);
      expect(dim.width/dim.height).toBeCloseTo(2);
      expect(e.x*c.canvas.width-dim.boxWidth/2).toBeGreaterThanOrEqual(0);
      expect(e.x*c.canvas.width+dim.boxWidth/2).toBeLessThanOrEqual(c.canvas.width);
      expect(e.y*c.canvas.height-dim.boxHeight/2).toBeGreaterThanOrEqual(0);
      expect(e.y*c.canvas.height+dim.boxHeight/2).toBeLessThanOrEqual(c.canvas.height);
    }
  });
  it('never invents asset references and adapts to another format', () => {
    const c = generateCompositions(options)[0];
    expect(c.elements.every(e => DEMO_ASSETS.some(a => a.id===e.objectId))).toBe(true);
    const next = adaptFormat(c,DEMO_ASSETS,'story');
    expect(next.canvas.height).toBe(1920);
    expect(next.elements.map(e=>e.scale)).toEqual(c.elements.map(e=>e.scale));
  });
  it('reports unavailable elements instead of generating fake ones', () => {
    expect(() => generateCompositions({...options, assets:[]})).toThrow();
    expect(() => generateCompositions({...options, selectedIds:[], topic:'несуществующее'})).toThrow();
  });
});
describe('SemanticMatcher', () => {
  it('works without API and chooses existing education and creative assets', () => {
    const education = matchTopic('Обучение и развитие',DEMO_ASSETS);
    expect(education.mode).toBe('local'); expect(education.objects.some(a=>a.objectId==='demo-cards')).toBe(true);
    const creative = matchTopic('Креативность и новые идеи',DEMO_ASSETS);
    expect(creative.objects.some(a=>a.objectId==='demo-orbit')).toBe(true);
    expect(matchTopic('Обучение',[]).objects).toEqual([]);
  });
});
describe('SVG intake security', () => {
  it('derives accurate dimensions and registers source versions', () => {
    const a = importSvg(svg('<rect width="200" height="100"/>'),'книга__main__S.svg');
    const b = importSvg(svg('<rect width="200" height="100"/>'),'книга__background__L.svg');
    const merged = mergeAssets([a],[b]); expect(merged).toHaveLength(1);
    expect(merged[0].sources['main:S']?.aspectRatio).toBe(2);
    expect(merged[0].sources['background:L']).toBeDefined();
  });
  it.each([
    '<script>alert(1)</script>', '<foreignObject/>', '<image href="data:image/png;base64,test"/>',
    '<rect onclick="alert(1)"/>', '<use href="https://evil.test/a.svg#x"/>',
    '<rect fill="url(https://evil.test/a.svg#x)"/>', '<style>@import url(https://evil.test)</style>',
    '<rect style="fill: u\\72l(https://evil.test)"/>', '<rect style="position: fixed"/>',
    '<animate attributeName="href" to="javascript:alert(1)"/>', '<rect fill="url(#missing)"/>',
    '<path id="same"/><path id="same"/>', '<use href="javascript:alert(1)"/>',
  ])('rejects unsafe or invalid content: %s', body => expect(()=>parseSvg(svg(body))).toThrow());
  it('rejects malformed XML, invalid viewBox, oversized payloads and DTD', () => {
    expect(()=>parseSvg('<svg>')).toThrow();
    expect(()=>parseSvg(svg('','0 0 NaN 100'))).toThrow();
    expect(()=>parseSvg(svg('','0 0 -1 100'))).toThrow();
    expect(()=>parseSvg('<!DOCTYPE svg>'+svg(''))).toThrow();
    expect(()=>parseSvg(' '.repeat(2*1024*1024+1))).toThrow();
  });
  it('normalizes safe inline presentation styles and local references', () => {
    const source = parseSvg(svg('<defs><linearGradient id="g"><stop offset="0" stop-color="#123"/></linearGradient></defs><rect style="fill: url(#g); opacity: 0.5" width="200" height="100"/>'));
    expect(source.svg).toContain('fill="url(#g)"'); expect(source.svg).not.toContain('style=');
  });
});
describe('PaletteService', () => {
  it.each(Object.keys(PALETTES) as (keyof typeof PALETTES)[])('keeps foreground and background inks separate in %s', id => {
    const palette = PALETTES[id];
    const fg = [...palette.mainObjectColors,...palette.accents,...palette.shadows,...palette.outlines];
    expect(palette.backgroundDecorations.every(c=>!fg.includes(c as never))).toBe(true);
    const text = coloredSvg(DEMO_ASSETS[0],'background','L',id,'bg');
    const document = new DOMParser().parseFromString(text,'image/svg+xml');
    const colors = [...document.querySelectorAll('[fill],[stroke]')].flatMap(n=>[n.getAttribute('fill'),n.getAttribute('stroke')]).filter(c=>c && c!=='none');
    expect(colors.every(c=>palette.backgroundDecorations.includes(c as never))).toBe(true);
  });
  it('preserves unknown colors and uses explicit semantic mapping only', () => {
    const a=importSvg(svg('<rect fill="#123456" width="100" height="80"/>'),'a.svg');
    expect(coloredSvg(a,'main','L','mint','a')).toContain('#123456');
    expect(a.warnings.length).toBeGreaterThan(0);
    const inherited = importSvg(svg('<rect fill="constructor" width="100" height="80"/>'),'inherited.svg');
    expect(() => coloredSvg(inherited,'main','L','mint','safe')).not.toThrow();
  });
});
describe('SvgExportService and project files', () => {
  it('exports a standalone vector document with exact size and no raster resources', () => {
    const c=generateCompositions(options)[0]; const output=exportSvg(c,DEMO_ASSETS);
    const document=new DOMParser().parseFromString(output,'image/svg+xml');
    expect(document.querySelector('parsererror')).toBeNull();
    expect(document.documentElement.getAttribute('width')).toBe('1080');
    expect(document.documentElement.getAttribute('viewBox')).toBe('0 0 1080 1080');
    expect(document.querySelectorAll('image,canvas,foreignObject,script')).toHaveLength(0);
    expect(output).not.toMatch(/base64|file:\/\//i);
    expect(document.documentElement.children.length).toBe(c.elements.length+1);
  });
  it('namespaces ids and gradient, mask, clipPath and use references for duplicate instances', () => {
    const body='<defs><linearGradient id="g"><stop stop-color="#abc"/></linearGradient><clipPath id="c"><rect width="50" height="50"/></clipPath><mask id="m"><rect width="50" height="50" fill="white"/></mask><path id="p" d="M0 0h50v50Z"/></defs><use href="#p" fill="url(#g)" clip-path="url(#c)" mask="url(#m)"/>';
    const a=importSvg(svg(body),'refs.svg'); const c=generateCompositions({...options, assets:[a],selectedIds:[a.id]})[0];
    c.elements.push({...c.elements[0],id:'duplicate'});
    const output=exportSvg(c,[a]); const doc=new DOMParser().parseFromString(output,'image/svg+xml');
    const ids=[...doc.querySelectorAll('[id]')].map(n=>n.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(output).toContain('url(#duplicate-g)'); expect(output).toContain('href="#duplicate-p"');
    expect(output).toContain('url(#duplicate-m)'); expect(output).toContain('url(#duplicate-c)');
  });
  it('roundtrips projects while revalidating all embedded SVGs', () => {
    const c=generateCompositions(options)[0]; const text=exportProject('Тест',c,DEMO_ASSETS);
    const p=importProject(text); expect(p.composition).toEqual(c); expect(p.title).toBe('Тест');
    const bad=JSON.parse(text); bad.assets[0].sources['main:L'].svg=svg('<script/>');
    expect(()=>importProject(JSON.stringify(bad))).toThrow();
    const missing=JSON.parse(text); missing.composition.elements[0].objectId='missing';
    expect(()=>importProject(JSON.stringify(missing))).toThrow();
    const malformed=JSON.parse(text); malformed.composition.elements[0].scale=null;
    expect(()=>importProject(JSON.stringify(malformed))).toThrow();
  });
  it('excludes hidden layers', () => {
    const c=generateCompositions(options)[0]; c.elements.forEach(e=>e.hidden=true);
    const document=new DOMParser().parseFromString(exportSvg(c,DEMO_ASSETS),'image/svg+xml');
    expect(document.documentElement.children).toHaveLength(1);
  });
});
describe('editor history', () => {
  beforeEach(()=>useStudio.setState({composition:generateCompositions(options)[0],assets:DEMO_ASSETS,past:[],future:[],selectedElement:null}));
  it('undoes and redoes edits without modifying source SVG', () => {
    const first=useStudio.getState().composition; const library=JSON.stringify(useStudio.getState().assets);
    useStudio.getState().updateElement(first.elements[0].id,{x:.6});
    useStudio.getState().undo(); expect(useStudio.getState().composition).toEqual(first);
    useStudio.getState().redo(); expect(useStudio.getState().composition.elements[0].x).toBe(.6);
    expect(JSON.stringify(useStudio.getState().assets)).toBe(library);
  });
  it('groups a drag into one checkpoint and supports duplicate and delete', () => {
    const s=useStudio.getState(); const e=s.composition.elements[0]; const initial=s.composition;
    s.checkpoint(); s.updateElement(e.id,{x:.6},false); s.updateElement(e.id,{x:.7},false);
    expect(useStudio.getState().past).toHaveLength(1); s.undo(); expect(useStudio.getState().composition).toEqual(initial);
    s.selectElement(e.id); s.duplicate(); expect(useStudio.getState().composition.elements.length).toBe(initial.elements.length+1);
    s.remove(); expect(useStudio.getState().composition.elements.length).toBe(initial.elements.length);
  });
});
