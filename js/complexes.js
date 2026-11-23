// Домашние комплексы: короткие рутины по таймеру, которые можно делать в любой день дома,
// отдельно или вместе с Ring Fit и видео. Чистая логика без доступа к состоянию.
// review: 'draft' — комплексы составлены как общие, со специалистом не согласованы.
import { homeFocusPlan, planSeconds, FOCUS_AREAS } from './corrective.js';
import { JOINT_WARMUP } from './data.js';
import { EXERCISE_META } from './catalog-data.js';

// Упражнения на коврике собраны в один комплекс: достаёшь коврик один раз.
// noMat — как сделать то же без коврика (на кровати, у стены, стоя).
export const MAT_STEPS = [
  { id: 'dead-bug', name: '«Мёртвый жук»', sec: 60,
    hint: 'Лёжа на спине, руки вверх, ноги согнуты. Медленно опускай противоположные руку и ногу, поясница прижата. На выдохе, 8–10 раз на сторону.',
    noMat: 'Без коврика: то же на кровати или на ковре; стоя — поочерёдно поднимай колено и противоположную руку, спина ровная.' },
  { id: 'bird-dog', name: '«Птица-собака»', sec: 60,
    hint: 'На четвереньках вытяни вперёд руку и назад противоположную ногу, задержись на 2 секунды, дыши свободно. 8–10 раз на сторону.',
    noMat: 'Без коврика: у стены стоя — отведи ногу назад, а противоположную руку вперёд, корпус ровный.' },
  { id: 'glute-bridge', name: 'Ягодичный мостик', sec: 45,
    hint: 'Лёжа на спине, стопы на полу. Подними таз до прямой линии плечи—колени, пауза 2 секунды, медленно вниз. 10–12 раз, дыши свободно.',
    noMat: 'Без коврика: то же на кровати или диване.' },
  { id: 'forearm-plank', name: 'Планка с колен на предплечьях', sec: 30,
    hint: 'Предплечья на полу, корпус одной линией от колен до головы, живот подтянут. Держи 15–20 секунд, дыши свободно. Плохо в пояснице или плечах — пропусти.',
    noMat: 'Без коврика: упор предплечьями в устойчивый стол или подоконник, ноги отставлены.' },
];

export const COMPLEXES = {
  posture: { name: 'Осанка и лопатка', icon: 'yoga', review: 'draft',
    about: 'Лёгкие упражнения для лопаток и верха спины. Движения медленные, без боли; жжение, онемение или прострел — остановись.' },
  core: { name: 'Кор на коврике', icon: 'yoga', review: 'draft', mat: true,
    about: 'Всё, что делается на полу, в одном комплексе: коврик достаёшь один раз. Без коврика — у каждого упражнения есть вариант.' },
  joints: { name: 'Разминка суставов', icon: 'ring', review: 'draft',
    about: 'Мягкая разминка суставов сверху вниз. Подойдёт утром или перед видео и Ring Fit.' },
};
export const COMPLEX_IDS = Object.keys(COMPLEXES);

// Базовые шаги комплекса (без настроек пользователя): [{ id, name, hint, sec, noMat? }]
export function baseSteps(id, settings) {
  if (id === 'posture') return homeFocusPlan(settings).map((x) => ({ ...x, key: x.side ? `${x.id}:${x.side}` : x.id }));
  if (id === 'core') return MAT_STEPS.map((x) => ({ ...x, key: x.id }));
  if (id === 'joints') return JOINT_WARMUP.map((x, i) => ({ id: `joint-${i}`, key: `joint-${i}`, name: x.name, hint: x.hint, sec: x.sec }));
  return [];
}

// Подгонка под человека: settings.complexes[id] = { off: [ключи убранных шагов], sec: { ключ: секунды } }.
// Убрать можно любое упражнение (но хотя бы одно остаётся), время шага — от 10 с до 5 мин.
export function complexPlan(id, settings) {
  const base = baseSteps(id, settings);
  const c = (settings && settings.complexes && settings.complexes[id]) || {};
  const off = new Set(c.off || []);
  const kept = base.filter((x) => !off.has(x.key));
  const list = kept.length ? kept : base.slice(0, 1);
  return list.map((x) => {
    const n = Math.round(Number(c.sec && c.sec[x.key]));
    return n >= 10 && n <= 300 ? { ...x, sec: n } : x;
  });
}

// Включить/выключить шаг; возвращает новый settings.complexes
export function toggleStep(complexes, id, key, base) {
  const cur = (complexes && complexes[id]) || {};
  const off = new Set(cur.off || []);
  if (off.has(key)) off.delete(key);
  else if (base.filter((x) => !off.has(x.key)).length > 1) off.add(key);
  return { ...(complexes || {}), [id]: { ...cur, off: [...off] } };
}
// Поменять время шага на delta секунд (шаг 5 с), в пределах 10–300
export function bumpStep(complexes, id, key, current, delta) {
  const cur = (complexes && complexes[id]) || {};
  const sec = Math.max(10, Math.min(300, current + delta));
  return { ...(complexes || {}), [id]: { ...cur, sec: { ...(cur.sec || {}), [key]: sec } } };
}
export const complexSeconds = (plan) => planSeconds(plan);
export const complexMinutes = (plan) => Math.max(1, Math.round(planSeconds(plan) / 60));
export const complexNote = (id, settings) => {
  if (id === 'posture') return Object.values(FOCUS_AREAS).map((a) => a.note).join(' ');
  return (COMPLEXES[id] || {}).about || '';
};

// Какие из упражнений нужен коврик: из списка id оставляет те, где в каталоге есть коврик
export const needsMat = (exId) => !!EXERCISE_META[exId] && EXERCISE_META[exId].equipment.includes('mat');

// Упражнения на коврике — в конец списка (порядок внутри групп сохраняется), чтобы доставать коврик один раз
export function matLast(ids) {
  return [...ids.filter((id) => !needsMat(id)), ...ids.filter(needsMat)];
}

// Подсказка «без коврика» для упражнения (из комплекса «Кор на коврике»); для остальных — пусто
export function noMatHint(exId) {
  const m = MAT_STEPS.find((x) => x.id === exId);
  return m ? m.noMat : '';
}
