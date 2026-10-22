// Подсказка рабочего веса и повторов (раздел 7.2 ТЗ)
import { daysBetween } from './cycle.js';

export function roundToStep(w, step) {
  if (w == null) return null;
  return Math.max(0, +(Math.round(w / step) * step).toFixed(2));
}

const usable = (h) => !h.lightDay && !h.aborted && h.phase !== 'deload' && h.sets.length > 0;
const workWeight = (h) => { const ws = h.sets.map((s) => s.weight).filter((w) => w != null); return ws.length ? Math.max(...ws) : null; };
const minReps = (h) => Math.min(...h.sets.map((s) => s.reps));
const allTop = (h, max) => h.sets.every((s) => s.reps >= max);
const breath = (h) => h.sets.some((s) => s.breathHold);

/**
 * history — сессии с этим упражнением, новые первыми: { date, phase, lightDay, aborted, sets: [{ weight, reps, breathHold }] }
 * mode — 'double' | 'repsThenWeight' | 'repsOnly'
 * Возвращает { kind, weight, targetReps?, reason, lastSets, offerDumbbells? }
 */
export function suggest({ history, range, step, mode, today, topSessions = 1, startWeight = null, forceBodyweight = false, offerDumbbells = false }) {
  const hist = history.filter(usable);
  const lastSets = hist[0] ? hist[0].sets.map((s) => s.reps) : [];

  if (forceBodyweight) {
    return { kind: 'bodyweight', weight: null, targetReps: range.max, lastSets, reason: 'Первая неделя — без гантели, только техника' };
  }

  if (mode === 'repsOnly') {
    const last = hist[0];
    if (!last) return { kind: 'calibration', weight: null, targetReps: range.min, lastSets, reason: 'Первый раз: столько повторов, сколько идёт свободно, без задержки дыхания' };
    if (breath(last)) return { kind: 'down', weight: null, targetReps: Math.max(range.min, minReps(last) - 1), lastSets, reason: 'В прошлый раз было тяжело дышать — меньше повторов' };
    if (offerDumbbells && hist.length >= 2 && hist.slice(0, 2).every((h) => allTop(h, range.max) && !breath(h))) {
      return { kind: 'offer', weight: null, targetReps: range.max, lastSets, offerDumbbells: true, reason: 'Две тренировки подряд на верхней границе — можно взять гантели 2 × 2 кг' };
    }
    if (allTop(last, range.max)) return { kind: 'same', weight: null, targetReps: range.max, lastSets, reason: 'Держим верхнюю границу' };
    return { kind: 'addReps', weight: null, targetReps: Math.min(range.max, minReps(last) + 1), lastSets, reason: 'Добавляем повтор' };
  }

  const weighted = hist.filter((h) => workWeight(h) != null);
  const last = weighted[0];
  if (!last) {
    return { kind: 'calibration', weight: startWeight, targetReps: range.max, lastSets, reason: 'Калибровка: подбери вес, с которым все повторы идут свободно и без задержки дыхания' };
  }
  const w = workWeight(last);
  const sets = last.sets.map((s) => s.reps);
  const down = w - step >= step ? roundToStep(w - step, step) : w;

  if (today && daysBetween(last.date, today) >= 14) {
    return { kind: 'down', weight: down, targetReps: range.max, lastSets: sets, reason: 'После перерыва начинаем легче' };
  }

  if (mode === 'repsThenWeight') {
    if (breath(last)) return { kind: 'down', weight: w, targetReps: Math.max(range.min, minReps(last) - 2), lastSets: sets, reason: 'В прошлый раз было тяжело дышать — тот же вес, меньше повторов' };
    if (allTop(last, range.max)) return { kind: 'up', weight: roundToStep(w + step, step), targetReps: range.min, lastSets: sets, reason: `Все подходы по ${range.max} — добавляем вес, повторы снова с ${range.min}` };
    return { kind: 'addReps', weight: w, targetReps: Math.min(range.max, minReps(last) + 1), lastSets: sets, reason: 'Тот же вес, +1 повтор' };
  }

  // double — двойная прогрессия
  if (breath(last)) return { kind: 'down', weight: down, lastSets: sets, reason: 'В прошлый раз было тяжело дышать — снижаем' };
  const lastN = weighted.slice(0, topSessions);
  if (lastN.length === topSessions && lastN.every((h) => workWeight(h) === w && allTop(h, range.max) && !breath(h))) {
    return { kind: 'up', weight: roundToStep(w + step, step), targetReps: range.min, lastSets: sets, reason: 'Все повторы на верхней границе — +1 шаг' };
  }
  if (last.sets.some((s) => s.reps < range.min)) return { kind: 'addReps', weight: w, lastSets: sets, reason: 'Тот же вес — добрать повторы' };
  const almost = topSessions > 1 && allTop(last, range.max);
  return { kind: 'same', weight: w, lastSets: sets, reason: almost ? 'Ещё одна тренировка на верхней границе — и добавим' : 'Тот же вес' };
}
