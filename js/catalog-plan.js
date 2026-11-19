// Каталог: как упражнения сочетаются, баланс сета и баланс за недели. Только чистые функции.
// Данные — в catalog-data.js, проверка ограничений — в catalog.js.
import { EXERCISE_META, MUSCLES, MUSCLE_GROUPS, GROUP_ACC, PATTERN_ROLE, ANTAGONIST_PATTERNS } from './catalog-data.js';
import { verdict } from './catalog.js';
import { daysBetween } from './cycle.js';

// Сколько отдыхать, если упражнения идут парой разных мышц (вместо обычных 60–90 с)
export const PAIR_REST = '45–60 с';
// Если обычный отдых уже короткий (60 с и меньше), сокращать нужно меньше
export const pairRestText = (baseRest = 90) => (baseRest > 60 ? PAIR_REST : '30–45 с');
export const PAIR_REST_CARE = 'Короткий отдых сильнее учащает пульс и давление. Если появилось давление в глазах, тяжесть в голове или хочется задержать дыхание — отдыхай полностью, как в программе. Пока не уверена — спроси офтальмолога.';

const meta = (id) => EXERCISE_META[id] || null;
export const roleOf = (id) => { const m = meta(id); return m ? PATTERN_ROLE[m.pattern] || 'other' : 'other'; };
export const regionOf = (id) => { const r = roleOf(id); return r === 'pull' || r === 'push' ? 'upper' : r; };
export const groupsOf = (id) => { const m = meta(id); return m ? [...new Set(m.primary.map((x) => MUSCLES[x] && MUSCLES[x].group).filter(Boolean))] : []; };
export const mainGroup = (id) => groupsOf(id)[0] || null;
// «Тяга» для баланса — это спина и задние дельты (не бицепс), «жим» — грудь и дельты (не трицепс)
const BACK_MUSCLES = ['lats', 'mid-back', 'rear-delts', 'spinal-extensors'];
const PRESS_MUSCLES = ['chest', 'front-delts', 'side-delts'];
export const isBack = (id) => !!meta(id) && meta(id).primary.some((x) => BACK_MUSCLES.includes(x));
export const isPress = (id) => !!meta(id) && meta(id).primary.some((x) => PRESS_MUSCLES.includes(x));
const names = (ids) => ids.map((x) => (MUSCLES[x] ? MUSCLES[x].name.toLowerCase() : x)).join(', ');
const antagonists = (pa, pb) => ANTAGONIST_PATTERNS.some(([x, y]) => (x === pa && y === pb) || (x === pb && y === pa));

// Как два упражнения, идущие подряд, сочетаются.
// kind: same — одни и те же мышцы; antagonist — противоположные; alternate — верх и низ тела; core — кор между другими;
// overlap — общие помогающие мышцы; ok — разные мышцы. rest: 'short' — можно сократить отдых, 'normal' — как обычно.
export function pairNote(aId, bId, { baseRest = 90 } = {}) {
  const a = meta(aId), b = meta(bId);
  if (!a || !b) return null;
  const R = pairRestText(baseRest);
  const shared = a.primary.filter((x) => b.primary.includes(x));
  let kind, rest, text;
  if (shared.length) {
    kind = 'same'; rest = 'normal';
    text = `Работают одни и те же мышцы (${names(shared)}). Лучше не ставить рядом: вторая будет работать с уставшими мышцами. Если рядом — отдых как обычно.`;
  } else if (antagonists(a.pattern, b.pattern)) {
    kind = 'antagonist'; rest = 'short';
    text = `Противоположные мышцы: пока одна работает, другая отдыхает. Хорошая пара, отдых между ними можно сократить до ${R}.`;
  } else if (regionOf(aId) === 'core' || regionOf(bId) === 'core') {
    kind = 'core'; rest = 'short';
    text = `Кор мало утомляет другие мышцы: пара получается лёгкой, отдых можно сократить до ${R}.`;
  } else if (regionOf(aId) !== regionOf(bId)) {
    kind = 'alternate'; rest = 'short';
    text = `Верх и низ тела: пока работает одна часть, другая отдыхает. Отдых между ними можно сократить до ${R}.`;
  } else {
    const common = [...a.secondary.filter((x) => b.primary.includes(x)), ...b.secondary.filter((x) => a.primary.includes(x))];
    if (common.length) {
      kind = 'overlap'; rest = 'normal';
      text = `Помогающие мышцы общие (${names([...new Set(common)])}), они устанут. Отдых как обычно.`;
    } else {
      kind = 'ok'; rest = 'normal';
      text = 'Разные мышцы, можно подряд. Отдых как обычно.';
    }
  }
  const extra = [];
  if (a.equipment[0] === 'dumbbells' && b.equipment[0] === 'dumbbells') extra.push('В обоих гантели: не нужно менять место. Следи, чтобы хват не устал, на лёгком весе это обычно не мешает.');
  if (b.tags.includes('balance_demand') && regionOf(aId) === 'lower' && kind !== 'alternate') extra.push('Упражнение на баланс лучше делать свежей: усталые ноги хуже держат равновесие.');
  return { kind, rest, text, extra, care: rest === 'short' ? PAIR_REST_CARE : null };
}

// Кого поставить в пару к упражнению: противоположные мышцы и другая часть тела — первыми
export function pairsFor(exId, { available = Object.keys(EXERCISE_META), exclude = [], conditionIds = [], limit = 4, baseRest = 90 } = {}) {
  if (!meta(exId)) return [];
  const rank = { antagonist: 0, alternate: 1, core: 2 };
  const list = [];
  for (const id of available) {
    if (id === exId || exclude.includes(id) || !meta(id)) continue;
    const note = pairNote(exId, id, { baseRest });
    if (!note || !(note.kind in rank)) continue;
    const v = verdict(id, conditionIds);
    if (v.level === 'avoid') continue;
    list.push({ id, kind: note.kind, level: v.level, note });
  }
  list.sort((x, y) => rank[x.kind] - rank[y.kind] || (x.level === 'caution') - (y.level === 'caution') || meta(x.id).tags.length - meta(y.id).tags.length || x.id.localeCompare(y.id));
  // не больше двух упражнений на одну мышцу в списке, чтобы выбор был разнообразным
  const seen = {}; const out = [];
  for (const x of list) {
    const key = meta(x.id).primary[0];
    seen[key] = (seen[key] || 0) + 1;
    if (seen[key] <= 1) out.push(x);
    if (out.length >= limit) break;
  }
  return out;
}

// Чем дополнить сет. target: 'lower' | 'pull' | 'push' | 'core' | 'hamstrings'. Разные тренажёры — первыми.
export function suggestFor(target, { available = Object.keys(EXERCISE_META), exclude = [], conditionIds = [], limit = 3 } = {}) {
  const fits = (id) => {
    const m = meta(id);
    if (!m) return false;
    if (target === 'hamstrings') return m.primary.includes('hamstrings');
    if (target === 'core') return regionOf(id) === 'core';
    if (target === 'pull') return isBack(id);
    if (target === 'push') return isPress(id);
    return roleOf(id) === target;
  };
  const list = available.filter((id) => !exclude.includes(id) && fits(id)).map((id) => ({ id, level: verdict(id, conditionIds).level }))
    .filter((x) => x.level !== 'avoid')
    .sort((x, y) => (x.level === 'caution') - (y.level === 'caution') || meta(x.id).tags.length - meta(y.id).tags.length || x.id.localeCompare(y.id));
  const seenEq = new Set(); const out = [];
  for (const x of list) { const e = meta(x.id).equipment[0]; if (!seenEq.has(e)) { seenEq.add(e); out.push(x.id); } if (out.length >= limit) break; }
  for (const x of list) { if (out.length >= limit) break; if (!out.includes(x.id)) out.push(x.id); }
  return out;
}

const SETS_DEFAULT = 3;
const WORK_SEC = 45;

// Разбор собранного сета: что добавить, что убрать, как поставить рядом
export function setAnalysis(ids, { available, conditionIds = [], sets = SETS_DEFAULT, restSec = 90 } = {}) {
  const list = ids.filter(meta);
  const n = list.length;
  const role = { lower: 0, pull: 0, push: 0, core: 0 };
  const groupN = {};
  const muscleN = {};
  for (const id of list) {
    const r = roleOf(id);
    if (r === 'lower' || r === 'core') role[r]++;
    if (isBack(id)) role.pull++;
    if (isPress(id)) role.push++;
    for (const g of groupsOf(id)) groupN[g] = (groupN[g] || 0) + 1 / groupsOf(id).length;
    for (const mu of meta(id).primary) muscleN[mu] = (muscleN[mu] || 0) + 1;
  }
  const issues = [];
  const opt = { available, exclude: list, conditionIds };
  const add = (id, severity, text, suggestTarget) => issues.push({ type: 'add', id, severity, text, suggest: suggestFor(suggestTarget, opt) });

  if (n >= 3) {
    if (!role.lower) add('no-lower', 'important', 'В сете нет ног и ягодиц. Это самые большие мышцы тела, на них уходит больше всего энергии. Добавь одно-два упражнения.', 'lower');
    if (!role.pull) add('no-pull', 'important', 'Нет тяги (спина и задние дельты). Без неё осанка и плечи остаются без баланса. Добавь тягу.', 'pull');
    if (role.push - role.pull >= 2 && role.pull) add('push-over-pull', 'important', 'Жимов заметно больше, чем тяг. Добавь тягу, чтобы плечи не уходили вперёд.', 'pull');
    if (!role.push && n >= 4) add('no-push', 'hint', 'Нет упражнений для груди и плеч. Можно добавить одно лёгкое.', 'push');
    if (!role.core && n >= 4) add('no-core', 'hint', 'Нет упражнения на кор. Одно спокойное упражнение на кор хорошо ставить в середину.', 'core');
    if ((muscleN.quads || 0) >= 2 && !muscleN.hamstrings) add('no-hams', 'important', 'Передняя поверхность бедра есть, а задней нет. Добавь сгибание ног, чтобы бёдра развивались ровно.', 'hamstrings');
  }
  // лишнее: слишком много на одну группу, три упражнения на одну мышцу, почти одинаковые упражнения
  if (n >= 4) {
    for (const [g, c] of Object.entries(groupN)) {
      if (c / n > 0.5) {
        const same = list.filter((id) => mainGroup(id) === g);
        const drop = same[same.length - 1];
        issues.push({ type: 'remove', id: 'too-much-' + g, severity: 'important', remove: drop, text: `Слишком много на ${GROUP_ACC[g]}: ${Math.round(c)} из ${n} упражнений. Убери одно, например последнее из них.`, dropId: drop });
      }
    }
  }
  for (const [mu, c] of Object.entries(muscleN)) {
    if (c >= 3 && n >= 4) {
      const same = list.filter((id) => meta(id).primary.includes(mu));
      issues.push({ type: 'remove', id: 'dup-' + mu, severity: 'hint', text: `На мышцу «${MUSCLES[mu].name.toLowerCase()}» уже ${c} упражнения. Хватит двух.`, dropId: same[same.length - 1] });
    }
  }
  for (let i = 0; i < list.length; i++) {
    for (let j = i + 1; j < list.length; j++) {
      const a = meta(list[i]), b = meta(list[j]);
      if (a.pattern === b.pattern && a.primary.join() === b.primary.join() && a.equipment[0] === b.equipment[0]) {
        issues.push({ type: 'remove', id: `twin-${list[i]}-${list[j]}`, severity: 'hint', text: 'Два почти одинаковых упражнения на одном тренажёре. Одно можно убрать.', dropId: list[j] });
      }
    }
  }
  // осторожно / нельзя по ограничениям
  for (const id of list) {
    const v = verdict(id, conditionIds);
    if (v.level !== 'ok') issues.push({ type: 'care', id: 'care-' + id, severity: v.level === 'avoid' ? 'important' : 'hint', dropId: id, text: `${v.level === 'avoid' ? 'Нельзя при твоих ограничениях' : 'Осторожно'}: ${v.reasons.map((r) => r.why).join('; ')}.` });
  }
  const pairs = [];
  for (let i = 0; i + 1 < list.length; i++) pairs.push({ a: list[i], b: list[i + 1], note: pairNote(list[i], list[i + 1], { baseRest: restSec }) });
  const minutes = Math.round(n * sets * (WORK_SEC + restSec) / 60);
  const order = { important: 0, hint: 1 };
  issues.sort((x, y) => order[x.severity] - order[y.severity]);
  return { count: n, role, groups: groupN, pairs, issues, minutes, balanced: n >= 3 && !issues.some((x) => x.severity === 'important') };
}

// Баланс за последние дни по сделанным подходам. sessions — как в S.sessions; today — 'ГГГГ-ММ-ДД'.
export function historyBalance(sessions, today, { days = 14 } = {}) {
  const inRange = sessions.filter((s) => s.date && daysBetween(s.date, today) >= 0 && daysBetween(s.date, today) < days)
    .filter((s) => (s.sets || []).some((x) => !x.isWarmup && meta(x.exerciseId)))
    .sort((a, b) => a.date.localeCompare(b.date));
  const shareOf = (sets) => {
    const g = {}; let total = 0;
    for (const x of sets) {
      if (x.isWarmup || !meta(x.exerciseId)) continue;
      const gs = groupsOf(x.exerciseId);
      for (const k of gs) g[k] = (g[k] || 0) + 1 / gs.length;
      total++;
    }
    return { counts: g, total };
  };
  const all = shareOf(inRange.flatMap((s) => s.sets));
  const shares = {};
  for (const k of Object.keys(MUSCLE_GROUPS)) shares[k] = all.total ? (all.counts[k] || 0) / all.total : 0;
  const per = inRange.map((s) => { const r = shareOf(s.sets); const sh = {}; for (const k of Object.keys(MUSCLE_GROUPS)) sh[k] = r.total ? (r.counts[k] || 0) / r.total : 0; return { date: s.date, total: r.total, shares: sh, counts: r.counts }; });
  const warnings = [];
  const pct = (x) => Math.round(x * 100);
  if (all.total >= 12 && inRange.length >= 2) {
    for (const [g, sh] of Object.entries(shares)) {
      if (sh >= 0.45) warnings.push({ type: 'overload', group: g, text: `За ${days} дней на ${GROUP_ACC[g]} пришлось ${pct(sh)}% подходов. Для баланса добавь другие группы мышц, особенно те, что реже.` });
    }
  }
  if (per.length >= 3) {
    const last3 = per.slice(-3);
    for (const g of Object.keys(MUSCLE_GROUPS)) {
      if (last3.every((p) => p.shares[g] >= 0.4)) warnings.push({ type: 'streak', group: g, text: `Три тренировки подряд упор на ${GROUP_ACC[g]}. Мышцам нужно около 48 часов на восстановление, а росту — разнообразие. Следующую тренировку лучше на другие группы.` });
    }
  }
  for (let i = 1; i < per.length; i++) {
    const a = per[i - 1], b = per[i];
    if (daysBetween(a.date, b.date) > 1) continue;
    for (const g of Object.keys(MUSCLE_GROUPS)) {
      if ((a.counts[g] || 0) >= 4 && (b.counts[g] || 0) >= 4) {
        if (!warnings.some((w) => w.type === 'streak' && w.group === g)) warnings.push({ type: 'rest48', group: g, text: `${a.date.slice(8)}.${a.date.slice(5, 7)} и ${b.date.slice(8)}.${b.date.slice(5, 7)}: на ${GROUP_ACC[g]} два дня подряд. Лучше дать им хотя бы 48 часов отдыха.` });
      }
    }
  }
  if (inRange.length >= 2 && all.total >= 12) {
    const lacking = ['legs', 'glutes', 'back', 'chest', 'shoulders', 'core'].filter((g) => shares[g] < 0.05);
    if (lacking.length === 1) warnings.push({ type: 'missing', group: lacking[0], text: `За ${days} дней почти не было нагрузки на ${GROUP_ACC[lacking[0]]}. Добавь одно-два упражнения.` });
    else if (lacking.length > 1) warnings.push({ type: 'missing', group: lacking[0], groups: lacking, text: `За ${days} дней почти не было нагрузки на: ${lacking.map((g) => GROUP_ACC[g]).join(', ')}. Добавь по одному-два упражнения на каждую.` });
  }
  return { days, sessions: inRange.length, total: all.total, shares, perSession: per, warnings };
}

// «Мой сет» → тренировка: убираем повторы, неизвестные и ещё не открытые в этой фазе упражнения.
// available — id, доступные сейчас (programs.availableExerciseIds). Порядок сохраняется; dropped — что не вошло.
export function workoutFromSet(ids = [], available = []) {
  const seen = new Set();
  const order = [];
  const dropped = [];
  for (const id of ids) {
    if (seen.has(id)) continue;
    seen.add(id);
    if (EXERCISE_META[id] && available.includes(id)) order.push(id);
    else dropped.push(id);
  }
  return { order, dropped };
}
