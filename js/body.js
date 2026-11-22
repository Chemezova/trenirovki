// Состав тела (анализатор InBody и подобные): чистая логика без доступа к состоянию.
// Записи лежат в хранилище «measurements» с признаком kind: 'body' — так они сами попадают в копию данных.
// Приборы дают разные цифры, поэтому каждая запись помнит свой прибор, а сравнение идёт только внутри одного прибора.

import { fatRange } from './profile.js';

export const BODY_KIND = 'body';
// Вес с анализатора хранится в bodyKg, а не weightKg: weightKg читают график и подсчёты «Вес», туда анализатор (днём, в одежде) не должен попадать.
export const BODY_INTERVAL_DAYS = 28;   // как часто стоит проходить анализ (напоминание)
export const DEVICES = {
  inbody: 'InBody клуба',
  vesna: 'Старый анализатор (клуб «Весна»)',
  other: 'Другой прибор',
};

const dayNum = (d) => Date.UTC(+d.slice(0, 4), +d.slice(5, 7) - 1, +d.slice(8, 10)) / 86400000;
const addDays = (d, n) => new Date((dayNum(d) + n) * 86400000).toISOString().slice(0, 10);
const r1 = (x) => +x.toFixed(1);

// Только записи состава тела, от старых к новым
export function bodyRecords(list) {
  return list.filter((m) => m.kind === BODY_KIND).sort((a, b) => (a.date + (a.at || '')).localeCompare(b.date + (b.at || '')));
}

// Записи одного прибора
export function byDevice(records, device) {
  return records.filter((m) => m.device === device);
}

// Какие приборы есть в записях (в порядке появления)
export function devicesUsed(records) {
  return [...new Set(records.map((m) => m.device))];
}

// Изменение последней записи прибора относительно предыдущей того же прибора. Одной записи мало → null.
export function bodyChange(records, device) {
  const l = byDevice(records, device);
  if (l.length < 2) return null;
  const a = l[l.length - 2];
  const b = l[l.length - 1];
  const d = (k) => (a[k] != null && b[k] != null ? r1(b[k] - a[k]) : null);
  return { from: a.date, to: b.date, days: dayNum(b.date) - dayNum(a.date), fatKg: d('fatKg'), fatPct: d('fatPct'), muscleKg: d('muscleKg'), bodyKg: d('bodyKg') };
}

// Когда пора на следующий анализ: { last, next, daysLeft, due }; записей нет → null
export function bodyDue(records, today, interval = BODY_INTERVAL_DAYS) {
  if (!records.length) return null;
  const last = records[records.length - 1].date;
  const next = addDays(last, interval);
  const daysLeft = dayNum(next) - dayNum(today);
  return { last, next, daysLeft, due: daysLeft <= 0 };
}

// Сколько килограммов жира нужно потерять, чтобы при тех же мышцах дойти до процента target.
// (жир − x) / (вес − x) = target  →  x = (жир − target·вес) / (1 − target). Уже ниже цели → 0.
export function fatToTarget(rec, targetPct) {
  if (!rec || rec.fatKg == null || rec.bodyKg == null) return null;
  const p = targetPct / 100;
  const x = (rec.fatKg - p * rec.bodyKg) / (1 - p);
  return x > 0 ? r1(x) : 0;
}

// Где процент жира относительно ориентира: 'below' / 'in' / 'above'. Ориентир по полу и возрасту — profile.fatRange.
export function fatZone(pct, sex = 'female', age = null) {
  const [lo, hi] = (fatRange(sex, age) || fatRange('female', null)).range;
  return pct < lo ? 'below' : pct > hi ? 'above' : 'in';
}

// Проверка введённой записи: возвращает текст ошибки или null
export function checkBodyRecord(r) {
  if (!r.date) return 'Укажи дату';
  if (!DEVICES[r.device]) return 'Выбери прибор';
  for (const k of ['bodyKg', 'fatKg', 'muscleKg']) if (!(r[k] > 0)) return 'Нужны вес, жир и мышцы в кг';
  if (r.fatKg >= r.bodyKg) return 'Жир не может быть больше веса';
  if (r.fatPct != null && Math.abs(r.fatPct - (r.fatKg / r.bodyKg) * 100) > 2) return 'Процент жира не сходится с кг: проверь цифры';
  return null;
}

// Прошлые анализы старого прибора (клуб «Весна»), перенесены с бланков по просьбе Елены 21.11.2026.
// Объёмы талии и бёдер с бланков (74/101, 75/100, 75/104) лежат в tape*Cm: отдельные поля, чтобы не попасть в график талии и список замеров.
export const HISTORY_SEED = [
  { kind: BODY_KIND, id: 'body-2011-08-08-vesna', date: '2011-08-08', device: 'vesna', bodyKg: 60.0, fatKg: 19.4, fatPct: 32.3, leanKg: 40.6, muscleKg: 18.4, bmrKcal: 1353, tapeWaistCm: 74, tapeHipsCm: 101 },
  { kind: BODY_KIND, id: 'body-2013-04-11-vesna', date: '2013-04-11', device: 'vesna', bodyKg: 60.0, fatKg: 18.8, fatPct: 31.3, leanKg: 41.2, muscleKg: 18.8, bmrKcal: 1361, tapeWaistCm: 75, tapeHipsCm: 100 },
  { kind: BODY_KIND, id: 'body-2015-01-27-vesna', date: '2015-01-27', device: 'vesna', bodyKg: 63.0, fatKg: 20.8, fatPct: 33.0, leanKg: 42.2, muscleKg: 19.3, bmrKcal: 1378, tapeWaistCm: 75, tapeHipsCm: 104 },
  { kind: BODY_KIND, id: 'body-2026-11-21-inbody', date: '2026-11-21', device: 'inbody', bodyKg: 68.3, fatKg: 23.0, fatPct: 33.7, leanKg: 45.3, muscleKg: 24.9, visceral: 9, bmrKcal: 1349 },
];
