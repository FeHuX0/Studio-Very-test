import type { Asset, MatchResult, Strategy } from '../types';
const topics: { theme: string; stems: string[]; related: string[]; strategy: Strategy }[] = [
  { theme: 'Обучение и развитие', stems: ['обуч', 'знан', 'навык', 'развити', 'учеб', 'learn', 'education'], related: ['книга', 'блокнот', 'карандаш', 'смартфон', 'знания', 'рост'], strategy: 'triangle' },
  { theme: 'Креативность и новые идеи', stems: ['твор', 'иде', 'креатив', 'вдохнов', 'creative'], related: ['лампа', 'карандаш', 'наушники', 'цветы', 'идеи', 'творчество'], strategy: 'asymmetric' },
  { theme: 'Командная работа', stems: ['команд', 'сотруд', 'вместе', 'team'], related: ['пазл', 'смартфон', 'папка', 'работа', 'команда'], strategy: 'central' },
  { theme: 'Планирование', stems: ['план', 'задач', 'проект', 'организ', 'plan'], related: ['блокнот', 'папка', 'карандаш', 'планирование', 'план'], strategy: 'diagonal' },
];
const tokens = (text: string) => text.toLocaleLowerCase().replace(/ё/g, 'е').split(/[^\p{L}\p{N}]+/u).filter(Boolean);
export function matchTopic(text: string, assets: Asset[]): MatchResult {
  const words = tokens(text);
  const topic = topics.map(t => ({ ...t, score: t.stems.filter(s => words.some(w => w.startsWith(s))).length })).sort((a, b) => b.score - a.score)[0];
  const related = topic?.score ? topic.related : [];
  const ranked = assets.map(asset => {
    const terms = tokens([asset.name, ...asset.tags, ...asset.keywords].join(' '));
    const direct = words.filter(word => terms.some(term => term === word || (word.length > 3 && term.startsWith(word.slice(0, -2))))).length;
    const semantic = related.filter(word => terms.some(term => term.startsWith(word.slice(0, Math.max(3, word.length - 2))))).length;
    return { objectId: asset.id, weight: direct * 3 + semantic, reason: direct ? 'Совпадение по названию или тегам' : 'Связь с темой' };
  }).filter(v => v.weight > 0).sort((a, b) => b.weight - a.weight);
  const explanation = ranked.length ? `По тегам найдены подходящие элементы: ${ranked.length}.` : 'Совпадений в библиотеке нет. Выберите элементы вручную или добавьте теги.';
  return { theme: topic?.score ? topic.theme : text.trim() || 'Свободная композиция', objects: ranked, strategy: topic?.score ? topic.strategy : 'hero', explanation, mode: 'local' };
}
