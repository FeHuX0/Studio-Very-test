import type { Asset, MatchResult, Strategy } from '../types';
const topics: { theme: string; stems: string[]; related: string[]; strategy: Strategy }[] = [
  { theme: 'Обучение и развитие', stems: ['обуч', 'знан', 'навык', 'развити', 'учеб', 'книг', 'образов', 'learn', 'education'], related: ['книга', 'блокнот', 'карандаш', 'смартфон', 'знания', 'рост', 'карточки', 'ноутбук'], strategy: 'triangle' },
  { theme: 'Креативность и новые идеи', stems: ['твор', 'иде', 'креатив', 'вдохнов', 'инсайт', 'дизайн', 'creative'], related: ['лампа', 'карандаш', 'наушники', 'цветы', 'идеи', 'творчество', 'орбита', 'акцент'], strategy: 'asymmetric' },
  { theme: 'Командная работа', stems: ['команд', 'сотруд', 'вместе', 'общен', 'диалог', 'чат', 'team'], related: ['пазл', 'смартфон', 'папка', 'работа', 'команда', 'диалог', 'модули'], strategy: 'central' },
  { theme: 'Планирование', stems: ['план', 'задач', 'проект', 'организ', 'дедлайн', 'врем', 'расписан', 'plan'], related: ['блокнот', 'папка', 'карандаш', 'планирование', 'план', 'часы', 'цель'], strategy: 'diagonal' },
  { theme: 'Запуск и стремительный рост', stems: ['запуск', 'старт', 'рост', 'прорыв', 'аналит', 'финанс', 'успех', 'побед'], related: ['ракета', 'график', 'цель', 'кубок', 'рост', 'достижение'], strategy: 'hero' },
  { theme: 'Безопасность и стратегия', stems: ['безопасн', 'защит', 'надежн', 'стратег', 'компас', 'ориент'], related: ['щит', 'компас', 'папка', 'цель', 'защита', 'навигация'], strategy: 'decorative' },
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

export function matchComponentsByNames(query: string, assets: Asset[]): Asset[] {
  const parts = query
    .split(/[,;\n]+/)
    .map(part => tokens(part))
    .filter(part => part.length > 0);
  if (!parts.length) return [];
  const matched: Asset[] = [];
  const seen = new Set<string>();
  for (const partWords of parts) {
    const scored = assets
      .map(asset => {
        const nameTokens = tokens(asset.name);
        const tagTokens = tokens([...asset.tags, ...asset.keywords].join(' '));
        const exactName = partWords.filter(w => nameTokens.some(n => n === w || n.startsWith(w) || (w.length > 3 && n.startsWith(w.slice(0, -1))))).length;
        const tagHit = partWords.filter(w => tagTokens.some(t => t === w || (w.length > 3 && t.startsWith(w.slice(0, -1))))).length;
        return { asset, score: exactName * 5 + tagHit * 2 };
      })
      .filter(item => item.score > 0)
      .sort((a, b) => b.score - a.score);
    for (const candidate of scored) {
      if (!seen.has(candidate.asset.id)) {
        seen.add(candidate.asset.id);
        matched.push(candidate.asset);
        break;
      }
    }
  }
  return matched;
}
