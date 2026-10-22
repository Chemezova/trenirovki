// Даты, недели, фазы и слоты цикла (раздел 4 ТЗ)

export const DEFAULT_START = '2026-10-26';

export const PHASES = {
  p1: { name: 'Освоение', reps: { min: 12, max: 15 }, rest: 90, cardioMin: 30, steps: '7–8 тыс.' },
  p2: { name: 'Набор', reps: { min: 10, max: 12 }, rest: 90, cardioMin: 35, steps: '8–9 тыс.' },
  p3: { name: 'Закрепление', reps: { min: 10, max: 12 }, rest: 60, cardioMin: 40, steps: '9–10 тыс.' },
  deload: { name: 'Разгрузка', reps: { min: 10, max: 12 }, rest: 60, cardioMin: 25, steps: 'как получится' },
};
export const PHASE_ORDER = ['p1', 'p2', 'p3', 'deload'];

export const SLOT_WEEKDAY = { A: 1, cardio: 3, B: 5 };
export const SLOT_ORDER = ['A', 'cardio', 'B'];

const WEEKDAYS = ['', 'понедельник', 'вторник', 'среда', 'четверг', 'пятница', 'суббота', 'воскресенье'];
const WEEKDAYS_SHORT = ['', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];
const MONTHS = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];

const pad = (n) => String(n).padStart(2, '0');
const ymd = (s) => { const [y, m, d] = s.split('-').map(Number); return [y, m - 1, d]; };

export function isoDate(d) { return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; }
export function today() { return isoDate(new Date()); }
export function parse(s) { return new Date(...ymd(s)); }
export function addDays(s, n) { const d = parse(s); d.setDate(d.getDate() + n); return isoDate(d); }
export function daysBetween(a, b) { return Math.round((Date.UTC(...ymd(b)) - Date.UTC(...ymd(a))) / 86400000); }
export function weekday(s) { const w = parse(s).getDay(); return w === 0 ? 7 : w; }
export function weekStart(s) { return addDays(s, 1 - weekday(s)); }

// 0 — вводная неделя до старта цикла
export function weekOf(date, start, shifts = []) {
  const raw = Math.floor(daysBetween(start, date) / 7) + 1;
  if (raw < 1) return 0;
  const shifted = shifts.filter((x) => x.fromRawWeek <= raw).reduce((a, x) => a + x.weeks, 0);
  return Math.max(1, raw - shifted);
}

export function phaseOf(week) {
  if (week <= 4) return 'p1';
  if (week <= 8) return 'p2';
  if (week <= 12) return 'p3';
  if (week === 13) return 'deload';
  return 'after';
}

// фаза для тренировки после конца цикла считается как p3
export function trainingPhase(week) { const p = phaseOf(week); return p === 'after' ? 'p3' : p; }

export function setsFor(week, phase) {
  if (phase === 'p1') return week <= 2 ? 2 : 3;
  if (phase === 'deload') return 2;
  return 3;
}

export function checkpoints(start) { return [0, 4, 8, 12].map((n) => ({ checkpoint: n, date: addDays(start, n * 7) })); }

export function checkpointNear(date, start) {
  for (const c of checkpoints(start)) {
    const d = daysBetween(c.date, date);
    if (d >= -3 && d <= 5) return c.checkpoint;
  }
  return null;
}

// Какую тренировку предложить сегодня (7.8)
export function plannedSlot(date, week, doneSlots) {
  if (week === 0) return doneSlots.has('A') ? { slot: null, scheduled: false } : { slot: 'A', scheduled: true, intro: true };
  const wd = weekday(date);
  const todays = SLOT_ORDER.find((s) => SLOT_WEEKDAY[s] === wd);
  if (todays && !doneSlots.has(todays)) return { slot: todays, scheduled: true };
  return { slot: SLOT_ORDER.find((s) => !doneSlots.has(s)) || null, scheduled: false };
}

export function nextScheduled(date, start) {
  for (let i = 1; i <= 7; i++) {
    const d = addDays(date, i);
    if (daysBetween(start, d) < 0) continue;
    const slot = SLOT_ORDER.find((s) => SLOT_WEEKDAY[s] === weekday(d));
    if (slot) return { date: d, slot };
  }
  return { date: start, slot: 'A' };
}

export function fmtDate(s, withWeekday = false) {
  const d = parse(s);
  const base = `${d.getDate()} ${MONTHS[d.getMonth()]}`;
  return withWeekday ? `${WEEKDAYS[weekday(s)]}, ${base}` : base;
}
export function fmtShort(s) { const d = parse(s); return `${WEEKDAYS_SHORT[weekday(s)]} ${pad(d.getDate())}.${pad(d.getMonth() + 1)}`; }
export function capitalize(t) { return t.charAt(0).toUpperCase() + t.slice(1); }
