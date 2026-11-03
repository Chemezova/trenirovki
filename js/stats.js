// Подсчёты для дашборда, календаря и графиков
import { S } from './state.js';
import * as cy from './cycle.js';

export const STEPS_PER_KM = 1350;
const HOME_KINDS = ['ringfit', 'yoga', 'circuit', 'video', 'other'];

export const sessionsOn = (date) => S.sessions.filter((s) => s.date === date && (s.status === 'done' || s.status === 'partial'));
export const activitiesOn = (date) => S.activities.filter((a) => a.date === date);

// Шаги и километры пересчитываются друг в друга по одной мерке
export const stepsToKm = (steps) => +(steps / STEPS_PER_KM).toFixed(2);
export const kmToSteps = (km) => Math.round(km * STEPS_PER_KM);

const walkKm = (a) => a.distanceKm || (a.steps ? stepsToKm(a.steps) : a.minutes ? (a.minutes / 60) * 4.5 : 0);
export const walkSteps = (a) => a.steps || kmToSteps(walkKm(a));

export function estKm(date) {
  return activitiesOn(date).filter((a) => a.kind === 'walk').reduce((t, a) => t + walkKm(a), 0);
}
export function estSteps(date) {
  return activitiesOn(date).filter((a) => a.kind === 'walk').reduce((t, a) => t + walkSteps(a), 0);
}
export function dayKm(date) {
  const h = S.health[date];
  if (h && h.km != null) return h.km;
  if (h && h.steps) return h.steps / STEPS_PER_KM;
  return estKm(date);
}
export function kmSource(date) {
  const h = S.health[date];
  if (!h) return 'оценка по прогулкам';
  return h.source === 'manual' ? 'вручную' : 'из Здоровья';
}
export function daySteps(date) {
  const h = S.health[date];
  if (h && h.steps) return h.steps;
  if (h && h.km != null) return kmToSteps(h.km);
  return estSteps(date);
}

function sessionMinutes(s) {
  if (s.retro || !s.finishedAt) return 150;
  const m = (new Date(s.finishedAt) - new Date(s.checkInAt)) / 60000;
  return Math.max(30, Math.min(240, m));
}

export function dayMinutes(date) {
  let m = 0;
  for (const s of sessionsOn(date)) m += sessionMinutes(s);
  for (const a of activitiesOn(date)) m += a.minutes || (a.distanceKm ? a.distanceKm * 13 : 0);
  return Math.round(m);
}
export const homeMinutesOn = (date) => activitiesOn(date).filter((a) => HOME_KINDS.includes(a.kind)).reduce((t, a) => t + (a.minutes || 0), 0);
// Минуты бассейна в одной тренировке: плавание + аквааэробика; день клуба, отмеченный задним числом, — 45 мин
export function sessionPoolMin(s) {
  const swim = s.pool && s.pool.result !== 'none' ? s.pool.minutes || 25 : s.retro && s.gymKind !== 'gym' ? 45 : 0;
  return swim + (s.aqua ? s.aqua.minutes || 0 : 0);
}
// Бассейн за день: из тренировок плюс отдельные отметки «Бассейн»
export function swimMinutesOn(date) {
  return sessionsOn(date).reduce((t, s) => t + sessionPoolMin(s), 0)
    + activitiesOn(date).filter((a) => a.kind === 'pool').reduce((t, a) => t + (a.minutes || 30), 0);
}
export const gymOn = (date) => sessionsOn(date).some((s) => s.slot && s.slot !== 'pool');

export function level(m) {
  if (m <= 0) return 0;
  if (m < 30) return 1;
  if (m < 60) return 2;
  if (m < 120) return 3;
  if (m < 180) return 4;
  return 5;
}

export function sumRange(fn, from, to) {
  let t = 0;
  for (let d = from; d <= to; d = cy.addDays(d, 1)) t += fn(d);
  return t;
}

export function clubVisitDates() {
  const set = new Set(S.sessions.filter((s) => s.status === 'done' || s.status === 'partial').map((s) => s.date));
  for (const a of S.activities) if (a.kind === 'class' || a.kind === 'pool') set.add(a.date);
  return [...set].sort();
}

export function weights() {
  return S.measurements.filter((m) => m.weightKg != null).sort((a, b) => (a.date + (a.at || '')).localeCompare(b.date + (b.at || '')));
}

export function weightLoss() {
  const w = weights();
  if (!w.length) return null;
  const start = w[0].weightKg;
  const cur = w[w.length - 1].weightKg;
  return { start, cur, lost: +(start - cur).toFixed(1), last: w[w.length - 1].date, first: w[0].date };
}

export function expectedLoss(date) {
  const d = cy.daysBetween(S.settings.startDate, date);
  return Math.max(0, Math.min(1, d / 91)) * S.settings.goalLossKg;
}

// Разбивка занятий по типам за период: сколько раз и сколько минут
export const TYPE_ROWS = [
  ['gym', 'Зал (силовая)', 'dumbbell'],
  ['cardio', 'Кардио в клубе', 'heart'],
  ['pool', 'Бассейн', 'swim'],
  ['class', 'Групповые занятия', 'group'],
  ['walk', 'Прогулки', 'walk'],
  ['ringfit', 'Ring Fit', 'ring'],
  ['yoga', 'Йога', 'yoga'],
  ['circuit', 'Видео-тренировки', 'video'],
  ['other', 'Другое', 'plus'],
];

export function typeBreakdown(from, to) {
  const r = Object.fromEntries(TYPE_ROWS.map(([id]) => [id, { count: 0, minutes: 0, km: 0, steps: 0 }]));
  const add = (id, minutes, km = 0) => { r[id].count += 1; r[id].minutes += Math.round(minutes || 0); r[id].km += km; };
  for (const s of S.sessions) {
    if (s.date < from || s.date > to || !(s.status === 'done' || s.status === 'partial')) continue;
    const pool = sessionPoolMin(s);
    const cardio = (s.cardio ? s.cardio.minutes || 0 : 0) + (s.finisherCardio ? s.finisherCardio.minutes || 0 : 0);
    if (pool) add('pool', pool);
    if (s.finisherCardio) add('cardio', s.finisherCardio.minutes);
    if (s.slot === 'cardio' && (cardio || s.retro)) add('cardio', cardio || 40);
    if (s.slot && s.slot !== 'cardio' && s.slot !== 'pool') add('gym', Math.max(20, sessionMinutes(s) - pool - cardio));
  }
  for (const a of S.activities) {
    if (a.date < from || a.date > to) continue;
    if (a.kind === 'walk') {
      r.walk.steps += walkSteps(a);
      if (a.commute) { r.walk.km += a.distanceKm || 0; r.walk.minutes += Math.round((a.distanceKm || 0) * 13); r.walk.commutes = (r.walk.commutes || 0) + 1; }
      else add('walk', a.minutes || (a.distanceKm || 0) * 13, walkKm(a));
    } else if (a.kind === 'video') add('circuit', a.minutes);
    else if (r[a.kind]) add(a.kind, a.minutes);
    else add('other', a.minutes);
  }
  return TYPE_ROWS.map(([id, name, icon]) => ({ id, name, icon, ...r[id] }));
}

// «TR;2026-10-23;8123;5,4» — строка из Команды iPhone; без префикса тоже принимается
export function parseHealth(text) {
  const out = {};
  for (const line of String(text).split(/[\r\n]+/)) {
    // история по дням: «S;2026-10-20;8123» — шаги, «K;2026-10-20;5,4» — км
    const sk = line.trim().match(/^(?:TR;)?([SK]);\s*(\d{4}-\d{2}-\d{2})[^;]*;\s*([\d\s.,]+)/i);
    if (sk) {
      const v = parseFloat(sk[3].replace(/\s/g, '').replace(',', '.'));
      if (!Number.isFinite(v)) continue;
      const rec = out[sk[2]] || (out[sk[2]] = { source: 'health' });
      if (sk[1].toUpperCase() === 'S') rec.steps = Math.round(v); else rec.km = +v.toFixed(2);
      continue;
    }
    const m = line.trim().match(/^(?:TR;)?(\d{4}-\d{2}-\d{2});\s*([\d\s]+)(?:;\s*([\d.,]+))?/);
    if (!m) continue;
    const steps = parseInt(m[2].replace(/\s/g, ''), 10);
    const km = m[3] != null ? parseFloat(m[3].replace(',', '.')) : undefined;
    out[m[1]] = { steps: Number.isFinite(steps) ? steps : undefined, km: Number.isFinite(km) ? +km.toFixed(2) : undefined, source: 'health' };
  }
  return out;
}
