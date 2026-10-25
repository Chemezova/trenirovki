// План недели: дни зала, домашние дни, групповые занятия клуба
import * as cy from './cycle.js';

export const DEFAULT_GYM_WEEKDAYS = [2, 4, 7];
export const GYM_WINDOW = { start: '11:30', end: '15:30' };

// Финиш после силовой: бассейн по умолчанию или равноценная замена
export const FINISHERS = {
  pool: { name: 'Бассейн', short: 'бассейн', icon: 'swim', hint: 'по плану фазы, ~30 мин' },
  walk: { name: 'Пешком из клуба', short: 'пешком домой', icon: 'walk', hint: 'минимум 3 км, ~40 мин в бодром темпе' },
  class: { name: 'Групповое занятие', short: 'групповое', icon: 'group', hint: 'пилатес, стрейч, антиэйдж, Зумба Голд — одно на выбор' },
  cardio: { name: 'Кардио на тренажёре', short: 'кардио 20 мин', icon: 'heart', hint: '20 мин в зоне 2: эллипс или велотренажёр' },
};
export const WALK_MIN_KM = 3;

export const GYM_KINDS = {
  full: { name: 'Зал + бассейн', hours: '3–3,5 ч', min: 195 },
  gym: { name: 'Только зал', hours: '1,5–2 ч', min: 105 },
  pool: { name: 'Только бассейн', hours: '1,5–2 ч', min: 105 },
};

export const HOME_ITEMS = [
  { kind: 'walk', name: 'Прогулка', hint: '1–1,5 ч', min: 75, km: 5, icon: 'walk' },
  { kind: 'video', name: 'Видео-тренировка или йога', hint: '30 мин', min: 30, icon: 'video', choices: [['circuit', 'Видео'], ['yoga', 'Йога']] },
  { kind: 'ringfit', name: 'Ring Fit', hint: '15 мин', min: 15, icon: 'ring' },
];
export const HOME_MINUTES = 120;

export const CANCEL_REASONS = [['illness', 'Болею'], ['work', 'Работа'], ['travel', 'Поездка'], ['tired', 'Нет сил'], ['other', 'Другое']];

// Оценка групповых занятий с точки зрения плана и ограничений по глазам
export const CLASS_INFO = {
  'Пилатес': { stars: 3, level: 'ok', note: 'Кор без задержки дыхания. Предупреди инструктора, пропускай позы головой вниз.' },
  'Антиэйдж': { stars: 3, level: 'ok', note: 'Мягкая силовая и подвижность — ровно под твою цель.' },
  'Стрейч': { stars: 2, level: 'ok', note: 'Гибкость и восстановление. Без глубоких наклонов и перевёрнутых поз.' },
  'МФР': { stars: 2, level: 'ok', note: 'Восстановление после силовой. Хорошо в день отдыха от зала.' },
  'Зумба Голд': { stars: 2, level: 'ok', note: 'Лёгкое кардио без прыжков — можно вместо бассейна.' },
  'Йога база': { stars: 1, level: 'care', note: 'Только пропуская «собаку», наклоны вперёд и перевёрнутые позы.' },
  'Бодискульпт': { stars: 1, level: 'care', note: 'Силовая аэробика: без прыжков, планки и наклонов головой вниз.' },
  'Пресс, ягодицы, ноги': { stars: 0, level: 'no', note: 'Много планок и мостов — лучше Пилатес.' },
  'Hot Iron 1': { stars: 0, level: 'no', note: 'Штанга: приседы и тяги в наклоне — против плана.' },
  'Zumba': { stars: 0, level: 'no', note: 'Прыжки и рывки. Если идти — только без прыжков.' },
  'Танцы Insidemove': { stars: 0, level: 'no', note: 'Ударная нагрузка. Только в спокойном темпе.' },
};

const MON_FRI = [['11:00', 'Танцы Insidemove'], ['12:00', 'Zumba'], ['13:00', 'Hot Iron 1'], ['13:00', 'Пилатес'], ['15:00', 'Бодискульпт']];
export const CLASS_SCHEDULE = {
  1: MON_FRI,
  2: [['13:00', 'Антиэйдж'], ['14:00', 'Йога база'], ['14:00', 'Пресс, ягодицы, ноги']],
  3: [['12:00', 'Зумба Голд'], ['13:00', 'Hot Iron 1'], ['14:00', 'МФР'], ['15:00', 'Бодискульпт']],
  4: [['12:00', 'Стрейч'], ['13:00', 'Антиэйдж'], ['14:00', 'Йога база'], ['14:00', 'Пресс, ягодицы, ноги']],
  5: MON_FRI,
  6: [['13:00', 'Пилатес'], ['14:00', 'Zumba'], ['16:00', 'Стрейч']],
  7: [['12:00', 'Стрейч'], ['14:00', 'МФР']],
};
export const CLASS_MIN = 55;

export function classesFor(date) {
  return (CLASS_SCHEDULE[cy.weekday(date)] || []).map(([time, name]) => ({ id: `${time}|${name}`, time, name, ...(CLASS_INFO[name] || { stars: 1, level: 'care', note: '' }) }));
}
export const classById = (date, id) => classesFor(date).find((c) => c.id === id) || null;

export function effective(date, plan) {
  const o = plan.days[date] || {};
  const type = o.type || (DEFAULT_GYM_WEEKDAYS.includes(cy.weekday(date)) ? 'gym' : 'home');
  return { date, type, gymKind: o.gymKind || 'full', classId: o.classId || null, cancelled: o.cancelled || null, program: o.program || null, finisher: o.finisher || 'pool' };
}

export const weekDates = (ws) => Array.from({ length: 7 }, (_, i) => cy.addDays(ws, i));

const SLOT_SEQ = ['A', 'cardio', 'B', 'cardio', 'A', 'cardio', 'B'];
const SLOT_SEQ_2 = ['A', 'B'];

const BASE_SLOTS = ['A', 'cardio', 'B'];
const STRENGTH = ['A', 'B'];
const isBase = (s) => BASE_SLOTS.includes(s);

/**
 * Какая программа выпадает на день клуба.
 * Очередь недели А → кардио → Б раздаётся по сделанному, а не по позиции дня:
 * сделанная тренировка забирает свою программу, пропущенный прошедший день ничего не забирает,
 * оставшиеся программы по порядку достаются сегодняшнему и будущим дням клуба.
 * ctx: { today, sessions } — sessions с полями date, slot, status.
 */
export function slotFor(date, plan, startDate, ctx = {}) {
  const day = effective(date, plan);
  if (day.type !== 'gym' || day.cancelled) return null;
  if (day.gymKind === 'pool') return 'pool';
  if (day.program) return day.program;
  const today = ctx.today || cy.today();
  const ws = cy.weekStart(date);
  const dates = weekDates(ws);
  const done = (ctx.sessions || []).filter((s) => s.date >= ws && s.date <= dates[6] && (s.status === 'done' || s.status === 'partial'));
  const doneOn = (d) => done.find((s) => s.date === d);
  const own = doneOn(date);
  if (own) return own.slot;

  const gyms = dates.map((d) => effective(d, plan)).filter((d) => d.type === 'gym' && !d.cancelled && d.gymKind !== 'pool' && !d.program);
  const week = cy.weekOf(date, startDate);
  let queue;
  if (week === 0) queue = ['A', ...Array(7).fill('cardio')];
  else if (gyms.length === 2) queue = [...SLOT_SEQ_2];
  else queue = [...SLOT_SEQ];

  // сделанное за неделю убирает свою программу из очереди; микс заменяет ближайшую силовую
  for (const s of done) {
    const i = isBase(s.slot) ? queue.indexOf(s.slot) : s.slot === 'pool' ? -1 : queue.findIndex((q) => STRENGTH.includes(q));
    if (i >= 0) queue.splice(i, 1);
  }
  // дни программ-миксов, поставленных вручную, тоже забирают силовую
  for (const d of dates.map((x) => effective(x, plan))) {
    if (d.type === 'gym' && !d.cancelled && d.program && !isBase(d.program) && d.program !== 'pool' && !doneOn(d.date)) {
      const i = queue.findIndex((q) => STRENGTH.includes(q));
      if (i >= 0) queue.splice(i, 1);
    }
  }
  // раздаём оставшееся сегодняшнему и будущим дням без сделанной тренировки
  const open = gyms.filter((d) => d.date >= today && !doneOn(d.date));
  const i = open.findIndex((d) => d.date === date);
  if (i < 0) return queue[0] || 'cardio'; // прошедший пропущенный день: что предлагалось бы первым
  return queue[i] || 'cardio';
}

export function swapDays(a, b, plan) {
  const ea = effective(a, plan);
  const eb = effective(b, plan);
  plan.days[a] = { ...(plan.days[a] || {}), type: eb.type, gymKind: eb.gymKind, cancelled: null };
  plan.days[b] = { ...(plan.days[b] || {}), type: ea.type, gymKind: ea.gymKind, cancelled: null };
}

export function setDay(date, plan, patch) {
  plan.days[date] = { ...(plan.days[date] || {}), ...patch };
}

export function plannedMinutes(date, plan) {
  const d = effective(date, plan);
  if (d.cancelled) return 0;
  return (d.type === 'gym' ? GYM_KINDS[d.gymKind].min : HOME_MINUTES) + (d.classId ? CLASS_MIN : 0);
}

export function plannedHours(date, plan) {
  const d = effective(date, plan);
  if (d.cancelled) return '—';
  const base = d.type === 'gym' ? GYM_KINDS[d.gymKind].hours : '≈2 ч';
  return d.classId ? `${base} + 1 ч` : base;
}

// Что делаем и зачем — по фазам
export const PHASE_WHY = {
  intro: { what: 'Вводная тренировка: подбираем рабочие веса, запоминаем настройки тренажёров.', why: 'Старт без перегруза — тело и глаза привыкают к нагрузке.' },
  p1: { what: '2–3 подхода по 12–15 повторов, отдых 90 с. Кардио 30 мин в зоне 2, бассейн спокойно.', why: 'Осваиваем технику и дыхание: выдох на усилии, без задержки. Связки и мышцы адаптируются.' },
  p2: { what: '3 подхода по 10–12, новые упражнения, интервалы в бассейне 4 × (2+1), кардио 35 мин.', why: 'Набираем силу: мышцы — главный союзник в снижении жира после 45.' },
  p3: { what: '3 × 10–12, отдых 60 с, бассейн 6 × (2+1), кардио 40 мин, шаги 9–10 тыс.', why: 'Закрепляем: больше плотности и расхода энергии при той же безопасной технике.' },
  deload: { what: '2 подхода, вес последней недели, лёгкое плавание.', why: 'Разгрузка: организм восстанавливается, а результат закрепляется.' },
  after: { what: 'Цикл завершён — время итогового замера и плана на следующий.', why: 'Новый цикл стартует с текущих рабочих весов.' },
};
export const MEASURE_HOW = 'Замеры раз в 4 недели: утром, натощак, после туалета — вес, талия, живот по пупку, бёдра, бедро. Вес в графике — средняя за неделю, поэтому дневные колебания не страшны.';
