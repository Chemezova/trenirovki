// Логика каталога: проверка упражнения по ограничениям и подбор замен. Чистые функции, данные — в catalog-data.js.
import { EXERCISE_META, CONDITIONS, PATTERN_FAMILY, MUSCLES, EQUIPMENT } from './catalog-data.js';

const RANK = { ok: 0, caution: 1, avoid: 2 };

// Какие ограничения действуют сегодня: постоянные из настроек + то, что отмечено в «Как ты сегодня?»
export function activeConditions(settings = {}, wellbeing = {}) {
  const ids = [...(settings.conditions || [])];
  if (wellbeing.critical === 'yes') ids.push('critical-days');
  return [...new Set(ids)].filter((id) => CONDITIONS[id]);
}

// Можно / осторожно / нельзя — и почему. Упражнение, которого нет в каталоге, считается «можно» (known: false).
export function verdict(exId, conditionIds = []) {
  const meta = EXERCISE_META[exId];
  if (!meta) return { level: 'ok', reasons: [], known: false };
  const reasons = [];
  for (const cid of conditionIds) {
    const c = CONDITIONS[cid];
    if (!c) continue;
    for (const rule of c.rules) {
      if (meta.tags.includes(rule.tag)) reasons.push({ condition: cid, conditionName: c.name, tag: rule.tag, level: rule.level, why: rule.why });
    }
  }
  const level = reasons.reduce((worst, r) => (RANK[r.level] > RANK[worst] ? r.level : worst), 'ok');
  return { level, reasons, known: true };
}

const family = (p) => PATTERN_FAMILY[p] || null;

// Замены: упражнения на те же мышцы. Выше — с другим тренажёром и похожим движением; «нельзя» скрываются.
// available — id упражнений, которые доступны сейчас (фаза цикла); exclude — уже стоящие в тренировке.
export function alternatives(exId, { available = Object.keys(EXERCISE_META), exclude = [], conditionIds = [] } = {}) {
  const me = EXERCISE_META[exId];
  if (!me) return { options: [], hidden: 0 };
  const options = [];
  let hidden = 0;
  for (const id of available) {
    if (id === exId || exclude.includes(id)) continue;
    const m = EXERCISE_META[id];
    if (!m) continue;
    const sharedPrimary = m.primary.filter((x) => me.primary.includes(x));
    const sharedSecondary = m.secondary.filter((x) => me.primary.includes(x));
    // Совпадение только по помогающим мышцам считается, если движение похожее (тяга сверху ↔ тяга сидя),
    // иначе приседу предложили бы «птицу-собаку» только потому, что там тоже работают ягодицы
    const similarMove = m.pattern === me.pattern || (!!family(m.pattern) && family(m.pattern) === family(me.pattern));
    if (!sharedPrimary.length && !(sharedSecondary.length && similarMove)) continue;
    const v = verdict(id, conditionIds);
    if (v.level === 'avoid') { hidden++; continue; }
    let score = sharedPrimary.length ? 3 + (sharedPrimary.length >= me.primary.length ? 1 : 0) : 1;
    if (m.pattern === me.pattern) score += 3;
    else if (family(m.pattern) && family(m.pattern) === family(me.pattern)) score += 1;
    const otherMachine = m.equipment[0] !== me.equipment[0];
    if (otherMachine) score += 4;
    if (v.level === 'caution') score -= 3;
    const coverage = sharedPrimary.length / me.primary.length; // какая доля основных мышц упражнения работает и здесь
    options.push({ id, score, level: v.level, reasons: v.reasons, otherMachine, machine: m.equipment[0], coverage, muscles: sharedPrimary.length ? sharedPrimary : sharedSecondary });
  }
  options.sort((a, b) => b.score - a.score || EXERCISE_META[a.id].tags.length - EXERCISE_META[b.id].tags.length || a.id.localeCompare(b.id));
  return { options, hidden };
}

// Аналоги по тренажёру: что делать, если нужный тренажёр занят. Другой тренажёр, те же основные мышцы
// (не менее половины), безопасные первыми. limit — сколько показать.
export function analogMachines(exId, opts = {}) {
  const { limit = 4, ...rest } = opts;
  const { options } = alternatives(exId, rest);
  return options.filter((o) => o.otherMachine && o.coverage >= 0.5).slice(0, limit);
}

export const muscleNames = (ids) => ids.map((id) => (MUSCLES[id] ? MUSCLES[id].name : id));
export const equipmentName = (id) => (EQUIPMENT[id] ? EQUIPMENT[id].name : id);
