import type { Asset, Role, Size, SvgSource } from '../types';

// Только технические фигуры. Не оригинальная библиотека из Figma.
const shapes = [
  { id: 'demo-cards', name: 'Карточки', tags: ['обучение', 'книга', 'знания', 'развитие'], body: '<rect x="37" y="27" width="118" height="146" rx="12" fill="#7660bb"/><rect x="49" y="17" width="118" height="146" rx="12" fill="#9881d9"/><rect x="65" y="40" width="86" height="66" rx="5" fill="#c1afe9"/><path d="M68 125h67M68 138h45" fill="none" stroke="#382952" stroke-width="5" stroke-linecap="round"/>' },
  { id: 'demo-orbit', name: 'Орбита', tags: ['идеи', 'творчество', 'креативность', 'новые', 'рост'], body: '<circle cx="100" cy="100" r="61" fill="#9881d9"/><circle cx="100" cy="100" r="30" fill="#c1afe9"/><ellipse cx="100" cy="100" rx="89" ry="30" transform="rotate(-35 100 100)" fill="none" stroke="#382952" stroke-width="5"/><circle cx="169" cy="60" r="13" fill="#f5c96c"/>' },
  { id: 'demo-blocks', name: 'Модули', tags: ['команда', 'командная', 'работа', 'пазл', 'вместе'], body: '<rect x="24" y="30" width="74" height="74" rx="13" fill="#9881d9"/><rect x="108" y="30" width="68" height="74" rx="13" fill="#c1afe9"/><rect x="24" y="114" width="74" height="58" rx="13" fill="#7660bb"/><rect x="108" y="114" width="68" height="58" rx="13" fill="#f5c96c"/>' },
  { id: 'demo-grid', name: 'План', tags: ['планирование', 'блокнот', 'задачи', 'план', 'работа'], body: '<rect x="27" y="29" width="146" height="142" rx="16" fill="#c1afe9"/><rect x="27" y="29" width="146" height="38" rx="12" fill="#7660bb"/><path d="M51 93h98M51 119h98M51 145h65M80 80v77M117 80v77" fill="none" stroke="#9881d9" stroke-width="4"/><circle cx="138" cy="145" r="12" fill="#f5c96c"/>' },
  { id: 'demo-arch', name: 'Арка', tags: ['развитие', 'рост', 'новые', 'перспектива', 'обучение'], body: '<path d="M35 172V87a65 65 0 0 1 130 0v85h-39V87a26 26 0 0 0-52 0v85Z" fill="#9881d9"/><path d="M35 172h39v-30H35ZM126 172h39v-30h-39Z" fill="#7660bb"/><circle cx="100" cy="112" r="14" fill="#f5c96c"/>' },
  { id: 'demo-spark', name: 'Акцент', tags: ['идеи', 'креативность', 'творческий', 'творчество', 'процесс'], body: '<path d="m100 17 19 54 55-12-35 43 35 43-55-12-19 54-19-54-55 12 35-43-35-43 55 12Z" fill="#f5c96c"/><circle cx="100" cy="102" r="22" fill="#9881d9"/>' },
];
export const DEMO_ASSETS: Asset[] = shapes.map(shape => {
  const sources: Asset['sources'] = {};
  for (const role of ['main', 'background'] as Role[]) for (const size of ['S', 'L'] as Size[]) {
    const n = size === 'L' ? 400 : 200;
    const source: SvgSource = { svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${n} ${n}"><g transform="scale(${n / 200})">${shape.body}</g></svg>`, viewBox: [0, 0, n, n], aspectRatio: 1 };
    sources[`${role}:${size}`] = source;
  }
  return { id: shape.id, name: shape.name, category: 'Демо-фигуры', tags: shape.tags, keywords: shape.tags, role: 'main', sizeVariants: ['S', 'L'], sources, colorMap: { '#9881d9': 'mainObjectColors', '#7660bb': 'shadows', '#c1afe9': 'mainObjectColors', '#382952': 'outlines', '#f5c96c': 'accents' }, allowedPalettes: ['lavender', 'peach', 'mint'], demo: true, warnings: [] };
});
