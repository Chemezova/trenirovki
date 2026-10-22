import * as db from './db.js';
import * as cy from './cycle.js';
import * as snd from './sound.js';
import { suggest, roundToStep } from './progression.js';
import {
  EXERCISES, EX_BY_ID, SLOT_NAMES, SLOT_SHORT, STRETCHES, poolPlan, CARDIO_MACHINES, SAFETY, STOP_MAIN, STOP_SECONDARY,
  SYMPTOMS, EXCLUDED, HOME_KINDS, NUTRITION, NUTRITION_NOTES,
} from './data.js';

const $app = document.getElementById('app');
const DEFAULT_SETTINGS = { startDate: cy.DEFAULT_START, shifts: [], voice: true, commuteKm: 4, lastBackupAt: null };

const S = {
  screen: 'today',
  settings: { ...DEFAULT_SETTINGS },
  exSettings: {},
  sessions: [],
  measurements: [],
  activities: [],
  symptoms: [],
  run: null,          // тренировка в процессе (status: 'in_progress')
  overlay: null,      // { type, ... }
  ui: {},             // значения степперов текущего подхода
  form: {},           // формы: замер, дома
  preferSlot: null,   // из ссылки ?start=A
};

// ---------- утилиты ----------
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const uid = () => (crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`);
const nowISO = () => new Date().toISOString();
const num = (v) => { const n = parseFloat(String(v).replace(',', '.')); return Number.isFinite(n) ? n : undefined; };
const plural = (n, [one, few, many]) => { const a = Math.abs(n) % 100, b = a % 10; if (a > 10 && a < 20) return many; if (b > 1 && b < 5) return few; if (b === 1) return one; return many; };
const minutesWord = (m) => `${m} ${plural(m, ['минута', 'минуты', 'минут'])}`;
const mmss = (sec) => { const s = Math.max(0, Math.ceil(sec)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };
const fmtWeight = (w, unit) => (w == null ? 'Без веса' : `${String(w).replace('.', ',')} ${unit === 'plate' ? 'плит.' : 'кг'}`);
const btn = (label, action, { v = '', cls = 'btn-secondary', attrs = '' } = {}) => `<button class="btn ${cls}" data-a="${action}" data-v="${esc(v)}" ${attrs}>${label}</button>`;
const chip = (label, action, v, pressed) => `<button class="chip" data-a="${action}" data-v="${esc(v)}" aria-pressed="${pressed ? 'true' : 'false'}">${label}</button>`;

// ---------- загрузка и сохранение ----------
async function load() {
  const kv = await db.getAll('kv');
  for (const { key, value } of kv) {
    if (key === 'settings') S.settings = { ...DEFAULT_SETTINGS, ...value };
    if (key.startsWith('ex:')) S.exSettings[key.slice(3)] = value;
  }
  const sessions = await db.getAll('sessions');
  S.run = sessions.find((s) => s.status === 'in_progress') || null;
  S.sessions = sessions.filter((s) => s.status !== 'in_progress');
  S.measurements = await db.getAll('measurements');
  S.activities = await db.getAll('activities');
  S.symptoms = await db.getAll('symptoms');
  snd.setVoice(S.settings.voice);

  // Незавершённая тренировка старше 12 часов закрывается как «Частично» (7.13)
  if (S.run && Date.now() - new Date(S.run.checkInAt).getTime() > 12 * 3600 * 1000) {
    S.run.status = S.run.sets.some((x) => !x.isWarmup) ? 'partial' : 'skip';
    S.run.finishedAt = S.run.checkInAt;
    await finalizeRun();
  }
}

const saveSettings = () => db.kvSet('settings', S.settings);
const saveExSettings = (id) => db.kvSet(`ex:${id}`, S.exSettings[id]);
const saveRun = () => (S.run ? db.put('sessions', S.run) : Promise.resolve());

async function finalizeRun() {
  const r = S.run;
  delete r.rest; delete r.timer;
  await db.put('sessions', r);
  S.sessions = S.sessions.filter((s) => s.id !== r.id).concat(r);
  S.run = null;
}

async function addActivity(a) {
  const rec = { id: uid(), cycleId: 'c1', date: cy.today(), ...a };
  await db.put('activities', rec);
  S.activities.push(rec);
  return rec;
}

// ---------- логика тренировки ----------
const phaseIdx = (p) => cy.PHASE_ORDER.indexOf(p);
const exercisesFor = (slot, phase) => EXERCISES.filter((e) => e.day === slot && phaseIdx(phase) >= phaseIdx(e.fromPhase));
const rangeFor = (ex, phase) => ex.reps || cy.PHASES[phase].reps;
const perSide = (ex) => !!((ex.reps && ex.reps.perSide) || ex.perSide);
const unitFor = (ex) => (S.exSettings[ex.id] && S.exSettings[ex.id].unit) || ex.unit;
const stepFor = (ex) => (S.exSettings[ex.id] && S.exSettings[ex.id].weightStep) || ex.weightStep;
const loadTypeFor = (ex) => (S.exSettings[ex.id] && S.exSettings[ex.id].loadTypeOverride) || ex.loadType;
const modeFor = (ex) => (ex.progression === 'repsOnly' && loadTypeFor(ex) === 'dumbbell' ? 'double' : ex.progression);

function setsTarget(r = S.run) {
  const base = cy.setsFor(r.week, r.phase);
  return r.lightDay ? Math.max(2, base - 1) : base;
}
const workSets = (exId, r = S.run) => r.sets.filter((x) => x.exerciseId === exId && !x.isWarmup);
const exComplete = (exId, r = S.run) => workSets(exId, r).length >= setsTarget(r);
const exFinished = (exId, r = S.run) => exComplete(exId, r) || r.skipped.includes(exId);
const currentEx = () => EX_BY_ID[S.run.order[S.run.current]];

function nextExerciseIndex(from) {
  const r = S.run;
  const n = r.order.length;
  for (let k = 1; k <= n; k++) {
    const i = (from + k) % n;
    if (!exFinished(r.order[i])) return i;
  }
  return exFinished(r.order[from]) ? null : from;
}

function historyFor(exId) {
  return S.sessions
    .map((s) => ({ date: s.date, at: s.checkInAt || s.date, phase: s.phase, lightDay: s.lightDay, aborted: s.aborted, sets: (s.sets || []).filter((x) => x.exerciseId === exId && !x.isWarmup) }))
    .filter((h) => h.sets.length)
    .sort((a, b) => b.at.localeCompare(a.at));
}

function suggestionFor(ex) {
  const r = S.run;
  return suggest({
    history: historyFor(ex.id),
    range: rangeFor(ex, r.phase),
    step: stepFor(ex),
    mode: modeFor(ex),
    today: r.date,
    topSessions: ex.topSessions || 1,
    forceBodyweight: !!ex.bodyweightWeek1 && r.week <= 1,
    offerDumbbells: !!ex.offerDumbbells && loadTypeFor(ex) !== 'dumbbell',
  });
}

function ensureInputs() {
  const ex = currentEx();
  const done = workSets(ex.id);
  const key = `${S.run.id}:${ex.id}:${done.length}`;
  if (S.ui.key === key) return;
  let sug = suggestionFor(ex);
  const step = stepFor(ex);
  if (S.run.lightDay && sug.weight != null) {
    sug = { ...sug, weight: sug.weight - step >= step ? roundToStep(sug.weight - step, step) : sug.weight, reason: `Лёгкий день: вес на шаг ниже. ${sug.reason}` };
  }
  const range = rangeFor(ex, S.run.phase);
  const prev = done[done.length - 1];
  const weight = prev ? prev.weight : sug.weight;
  let reps = range.max;
  if (sug.kind === 'up') reps = range.min;
  else if (sug.targetReps != null && sug.kind !== 'same') reps = sug.targetReps;
  else if (sug.lastSets[done.length] != null) reps = sug.lastSets[done.length];
  if (prev) reps = prev.reps;
  S.ui = { key, weight, reps, breath: false, sug };
}

async function startSession(slot, walked) {
  const date = cy.today();
  const week = cy.weekOf(date, S.settings.startDate, S.settings.shifts);
  const phase = cy.trainingPhase(week);
  const r = {
    id: uid(), cycleId: 'c1', slot, day: slot, date, plannedDate: date, week, phase, intro: week === 0,
    status: 'in_progress', statusManual: false, checkInAt: nowISO(), sets: [], lightDay: false, aborted: false,
    stage: 'wellbeing', wellbeing: {}, order: slot === 'cardio' ? [] : exercisesFor(slot, phase).map((e) => e.id),
    skipped: [], current: 0, rest: null, timer: null, note: '',
  };
  if (walked) await addActivity({ kind: 'walk', commute: 'to', distanceKm: S.settings.commuteKm, sessionId: r.id });
  S.run = r;
  S.screen = 'workout';
  S.ui = {};
  await saveRun();
  snd.keepAwake(true);
  render();
}

// ---------- таймеры по меткам времени (7.5) ----------
function mkTimer(kind, segments, extra = {}) {
  return { kind, segments, startAt: Date.now(), pausedAt: null, pausedMs: 0, skipSec: 0, lastSeg: 0, lastMark: 0, warned: false, halfSaid: false, done: false, ...extra };
}
function tState(t, now = Date.now()) {
  const ref = t.pausedAt ?? now;
  const el = (ref - t.startAt - t.pausedMs) / 1000 + t.skipSec;
  let acc = 0;
  for (let i = 0; i < t.segments.length; i++) {
    const sec = t.segments[i].sec;
    if (el < acc + sec) return { idx: i, segEl: el - acc, segRem: acc + sec - el, totalRem: totalSec(t) - el, el, done: false };
    acc += sec;
  }
  return { idx: t.segments.length - 1, segEl: 0, segRem: 0, totalRem: 0, el: acc, done: true };
}
const totalSec = (t) => t.segments.reduce((a, s) => a + s.sec, 0);
function startTimer(key, kind, segments, extra) {
  const t = mkTimer(kind, segments, extra);
  S.run[key] = t;
  const first = segments[0];
  if (first.say) snd.announce(first.say, first.beep || 'short');
  return t;
}

function tick() {
  const r = S.run;
  if (!r) return;
  const now = Date.now();
  let changed = false;
  let rerender = false;
  for (const key of ['rest', 'timer']) {
    const t = r[key];
    if (!t || t.done) continue;
    const st = tState(t, now);
    if (!st.done) {
      const seg = t.segments[st.idx];
      if (st.idx !== t.lastSeg) {
        t.lastSeg = st.idx; t.lastMark = 0; t.halfSaid = false;
        if (seg.say) snd.announce(seg.say, seg.beep || 'short');
        changed = true; rerender = true;
      }
      if (seg.every) {
        const mark = Math.floor(st.segEl / seg.every);
        if (mark > t.lastMark) { t.lastMark = mark; snd.announce(`Прошло ${minutesWord(Math.round((mark * seg.every) / 60))}`, 'short'); changed = true; }
      }
      if (seg.half && !t.halfSaid && st.segEl >= seg.sec / 2) { t.halfSaid = true; snd.announce(`Половина. Осталось ${minutesWord(Math.round(st.segRem / 60))}`, 'short'); changed = true; }
      if (key === 'rest' && !t.warned && st.segRem <= 10 && seg.sec > 20) { t.warned = true; snd.beep('short'); changed = true; }
    } else {
      t.done = true;
      snd.announce(t.endSay || 'Время', 'end');
      onTimerDone(key, t);
      changed = true; rerender = true;
    }
    updateTimerDom(key, st, t);
  }
  if (changed) saveRun();
  if (rerender && S.screen === 'workout') render();
}

function onTimerDone(key, t) {
  const r = S.run;
  if (key === 'rest') r.rest = null;
  if (t.kind === 'stretch') { r.stretchDone = true; r.timer = null; r.stage = 'summary'; }
}

function updateTimerDom(key, st, t) {
  const rem = $app.querySelector(`[data-t="${key}-rem"]`);
  if (rem) rem.textContent = mmss(st.segRem);
  const label = $app.querySelector(`[data-t="${key}-label"]`);
  if (label) label.textContent = t.segments[st.idx].label || '';
  const total = $app.querySelector(`[data-t="${key}-total"]`);
  if (total) total.textContent = `Всего осталось ${mmss(st.totalRem)}`;
}

setInterval(tick, 250);
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') tick(); });

// ---------- экран «Сегодня» ----------
function todayInfo() {
  const date = cy.today();
  const start = S.settings.startDate;
  const week = cy.weekOf(date, start, S.settings.shifts);
  const phase = cy.phaseOf(week);
  const ws = cy.weekStart(date);
  const we = cy.addDays(ws, 6);
  const inWeek = (d) => d >= ws && d <= we;
  const weekSessions = S.sessions.filter((s) => inWeek(s.date) && s.slot);
  const doneSlots = new Set(weekSessions.filter((s) => s.status === 'done' || s.status === 'partial').map((s) => s.slot));
  const plan = cy.plannedSlot(date, week, doneSlots);
  const acts = S.activities.filter((a) => inWeek(a.date));
  return {
    date, start, week, phase, ws, we, weekSessions, doneSlots, plan,
    home: acts.filter((a) => a.kind !== 'walk').length,
    walks: acts.filter((a) => a.kind === 'walk' && !a.commute).length,
    commutes: acts.filter((a) => a.kind === 'walk' && a.commute).length,
  };
}

function weekLabel(week, phase) {
  if (week === 0) return 'Вводная неделя';
  if (phase === 'after') return 'Цикл завершён';
  return `Неделя ${week} из 13 · ${cy.PHASES[phase].name}`;
}

function renderToday() {
  const t = todayInfo();
  const parts = [];
  parts.push(`<header class="page-head"><h1>${cy.capitalize(cy.fmtDate(t.date, true))}</h1><p class="sub">${esc(weekLabel(t.week, t.phase))}${t.week === 0 ? ` · цикл с ${cy.fmtShort(t.start)}` : ''}</p></header>`);

  // баннеры
  const cp = cy.checkpointNear(t.date, t.start);
  const hasMeasure = cp != null && S.measurements.some((m) => m.checkpoint === cp);
  if (cp != null && !hasMeasure) {
    parts.push(`<section class="banner"><p><b>Контрольный замер${cp === 0 ? ' 0' : ` после недели ${cp}`}.</b> Утром, натощак, после туалета.</p>${btn('Записать замер', 'go', { v: 'measure' })}</section>`);
  }
  const lastBackup = S.settings.lastBackupAt;
  const workCount = S.sessions.length + S.measurements.length;
  if (workCount >= 3 && (!lastBackup || cy.daysBetween(lastBackup.slice(0, 10), t.date) > 14)) {
    parts.push(`<section class="banner"><p><b>Сделай копию данных.</b> Всё хранится только на этом телефоне. ${lastBackup ? `Последняя копия — ${cy.fmtDate(lastBackup.slice(0, 10))}.` : 'Копий ещё не было.'}</p>${btn('Сохранить копию', 'export')}</section>`);
  }

  // тренировка
  if (S.run) {
    parts.push(`<section class="card"><h2>Тренировка не закончена</h2><p>${esc(SLOT_NAMES[S.run.slot])}, начата в ${new Date(S.run.checkInAt).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}.</p>${btn('Продолжить тренировку', 'resume', { cls: 'btn-primary' })}</section>`);
  } else if (t.phase === 'after') {
    parts.push(`<section class="card"><h2>Цикл завершён</h2><p>13 недель позади. Новый цикл можно настроить в «Настройках»: дата старта следующего понедельника. Стартовые веса — из последней недели «Закрепления».</p>${btn('Я в клубе', 'checkin', { v: 'A', cls: 'btn-primary' })}</section>`);
  } else {
    const slot = S.preferSlot || t.plan.slot;
    if (t.week === 0 && slot === 'A' && !t.doneSlots.has('A')) {
      parts.push(`<section class="card"><h2>Вводная тренировка</h2><p>Силовая А — подбираем веса. Подходов 2, повторов 12–15, всё должно идти свободно. Неделя 1 цикла начнётся ${cy.fmtDate(t.start)}.</p>${btn('Я в клубе', 'checkin', { v: 'A', cls: 'btn-primary btn-xl' })}</section>`);
    } else if (slot && (t.plan.scheduled || S.preferSlot)) {
      parts.push(`<section class="card"><h2>По плану: ${esc(SLOT_NAMES[slot])}</h2>${slotSummary(slot, t.week)}${btn('Я в клубе', 'checkin', { v: slot, cls: 'btn-primary btn-xl' })}</section>`);
    } else {
      const next = cy.nextScheduled(t.date, t.start);
      parts.push(`<section class="card"><h2>По расписанию сегодня отдых</h2><p>Ближайшая: ${cy.fmtShort(next.date)} — ${esc(SLOT_NAMES[next.slot])}.</p>${slot ? `<p>Если всё же в клубе, предложу: <b>${esc(SLOT_NAMES[slot])}</b>.</p>${btn('Я в клубе', 'checkin', { v: slot })}` : '<p>Все тренировки этой недели сделаны.</p>'}</section>`);
    }
    parts.push(`<p class="center">${btn('Другая тренировка', 'chooser', { cls: 'btn-link' })}</p>`);
  }

  // неделя
  const slotMark = (s) => {
    const sess = t.weekSessions.filter((x) => x.slot === s).sort((a, b) => b.date.localeCompare(a.date))[0];
    if (!sess) return `${SLOT_SHORT[s]} —`;
    return `${SLOT_SHORT[s]} ${sess.status === 'done' ? '✓' : sess.status === 'partial' ? '½' : '—'}`;
  };
  parts.push(`<section class="card"><h2>Эта неделя</h2><p class="week-strip">Клуб: ${cy.SLOT_ORDER.map(slotMark).join(' · ')}</p><p class="week-strip">Дома: ${t.home} из 2 · Прогулки: ${t.walks}${t.commutes ? ` (+ пешком до клуба: ${t.commutes})` : ''}</p></section>`);

  parts.push(`<section class="grid2">${btn('Дома', 'go', { v: 'home' })}${btn('Прогулка', 'go', { v: 'walk' })}${btn('Замер', 'go', { v: 'measure' })}${btn('Справка', 'go', { v: 'help' })}</section>`);
  return parts.join('');
}

function slotSummary(slot, week) {
  const phase = cy.trainingPhase(week);
  const ph = cy.PHASES[phase];
  if (slot === 'cardio') return `<p>Кардио ${ph.cardioMin} мин в зоне 2, бассейн, растяжка.</p>`;
  const exs = exercisesFor(slot, phase);
  return `<p>${cy.setsFor(week, phase)} × ${ph.reps.min}–${ph.reps.max}, ${exs.length} упражнений, бассейн, растяжка.</p>`;
}

// ---------- экран тренировки ----------
function renderWorkout() {
  const r = S.run;
  const head = `<div class="topbar"><div class="topbar-title">${esc(SLOT_NAMES[r.slot])}<span>${esc(weekLabel(r.week, r.phase))}${r.lightDay ? ' · лёгкий день' : ''}</span></div>
    <button class="btn btn-small btn-secondary" data-a="minimize">Свернуть</button>
    <button class="btn btn-small btn-danger" data-a="stop">Стоп-сигналы</button></div>`;
  const body = {
    wellbeing: renderWellbeing, warmup: renderWarmup, exercises: renderExercises, cardio: renderCardio,
    pool: renderPool, stretch: renderStretch, summary: renderSummary,
  }[r.stage]();
  return head + `<main class="workout">${body}</main>`;
}

function renderWellbeing() {
  const w = S.run.wellbeing;
  const row = (label, field, opts) => `<fieldset><legend>${label}</legend><div class="chips">${opts.map(([v, l]) => chip(l, 'wb', `${field}:${v}`, w[field] === v)).join('')}</div></fieldset>`;
  return `<h2>Как ты сегодня?</h2>
    ${row('Сон', 'sleep', [['bad', 'Плохо'], ['ok', 'Нормально'], ['good', 'Хорошо']])}
    ${row('Силы', 'energy', [['low', 'Мало'], ['ok', 'Нормально'], ['high', 'Много']])}
    ${row('Давление в глазах или голове', 'pressure', [['no', 'Нет'], ['yes', 'Есть']])}
    ${btn('Дальше', 'wb-next', { cls: 'btn-primary' })}`;
}

function renderWarmup() {
  const r = S.run;
  const min = r.slot === 'cardio' ? 5 : 10;
  const t = r.timer && r.timer.kind === 'warmup' ? r.timer : null;
  const next = r.slot === 'cardio' ? 'К кардио' : 'К упражнениям';
  if (!t) return `<h2>Разминка</h2><p class="lead">${min} мин эллипс или велотренажёр, спокойно.</p>${btn('Старт разминки', 'warmup-start', { cls: 'btn-primary' })}${btn('Уже размялась', 'warmup-done')}`;
  if (t.done) return `<h2>Разминка окончена</h2>${btn(next, 'warmup-done', { cls: 'btn-primary' })}`;
  return `<h2>Разминка</h2>${timerBlock('timer', t)}${btn(t.pausedAt ? 'Продолжить' : 'Пауза', 'timer-pause')}${btn(next, 'warmup-done', { cls: 'btn-primary' })}`;
}

function timerBlock(key, t, { showTotal = false } = {}) {
  const st = tState(t);
  return `<div class="timer" role="timer" aria-live="off"><div class="timer-label" data-t="${key}-label">${esc(t.segments[st.idx].label || '')}</div>
    <div class="big-num" data-t="${key}-rem">${mmss(st.segRem)}</div>${showTotal ? `<div class="sub" data-t="${key}-total">Всего осталось ${mmss(st.totalRem)}</div>` : ''}</div>`;
}

function renderRest() {
  const t = S.run.rest;
  if (!t) return '';
  return `<section class="rest-panel">${timerBlock('rest', t)}<div class="row2">${btn('+15 с', 'rest-plus')}${btn('Пропустить отдых', 'rest-skip')}</div></section>`;
}

function renderExercises() {
  const r = S.run;
  const allDone = r.order.every((id) => exFinished(id));
  if (allDone) {
    return `${renderRest()}<h2>Упражнения закончены</h2><p>${esc(exerciseSummaryLine())}</p>
      ${btn('К бассейну', 'to-pool', { cls: 'btn-primary' })}${btn('Список упражнений', 'list')}${undoButton()}`;
  }
  ensureInputs();
  const ex = currentEx();
  const range = rangeFor(ex, r.phase);
  const done = workSets(ex.id);
  const target = setsTarget();
  const unit = unitFor(ex);
  const sug = S.ui.sug;
  const exs = S.exSettings[ex.id] || {};
  const pos = r.order.indexOf(ex.id);
  const planOrder = exercisesFor(r.slot, r.phase).map((e) => e.id);
  const canWarmup = planOrder.indexOf(ex.id) < 2 && !r.sets.some((x) => x.exerciseId === ex.id) && sug.weight != null;
  const isMachine = ex.loadType === 'machine' || ex.loadType === 'cable';
  const hist = historyFor(ex.id).slice(0, 3);
  const showWeight = loadTypeFor(ex) !== 'bodyweight' && sug.kind !== 'bodyweight';

  return `${renderRest()}
    <div class="ex-head"><p class="sub">Упражнение ${pos + 1} из ${r.order.length}</p>
    <h2 class="ex-name">${esc(ex.name)}</h2>
    <p class="set-line"><b>Подход ${Math.min(done.length + 1, target)} из ${target}</b> · ${range.min}–${range.max} повторов${perSide(ex) ? ' на сторону' : ''}</p></div>
    ${ex.eyeNote ? `<p class="eye-note">⚠ ${esc(ex.eyeNote)}</p>` : ''}
    <section class="suggest"><div class="sub">Подсказка</div>
      <div class="big-num">${!showWeight ? `${sug.targetReps ?? range.max} повт.` : sug.kind === 'calibration' && sug.weight == null ? '<span class="big-text">Подбери вес</span>' : esc(fmtWeight(sug.weight, unit))}</div>
      <p>${esc(sug.reason)}</p>
      ${sug.offerDumbbells ? btn('Перейти на гантели', 'to-dumbbells') : ''}</section>
    ${hist.length ? `<section class="history"><div class="sub">В прошлый раз</div>${hist.map((h) => `<p>${cy.fmtShort(h.date)}: ${h.sets.map((x) => `${x.weight == null ? '' : `${String(x.weight).replace('.', ',')}×`}${x.reps}`).join(', ')}${h.sets.some((x) => x.breathHold) ? ' · трудно дышать' : ''}${h.lightDay ? ' · лёгкий день' : ''}</p>`).join('')}</section>` : ''}
    ${done.length ? `<p class="sub">Сегодня: ${done.map((x) => `${x.weight == null ? '' : `${String(x.weight).replace('.', ',')}×`}${x.reps}${x.breathHold ? ' (трудно дышать)' : ''}`).join(', ')}</p>` : ''}
    ${showWeight ? `<div class="stepper-block"><div class="stepper-label">Вес <button class="btn-link" data-a="unit">${unit === 'plate' ? 'в плитках · сменить на кг' : 'в кг · сменить на плитки'}</button></div>
      <div class="stepper"><button data-a="w-minus" aria-label="Меньше вес">−</button><div class="val">${esc(fmtWeight(S.ui.weight, unit))}</div><button data-a="w-plus" aria-label="Больше вес">+</button></div></div>` : ''}
    <div class="stepper-block"><div class="stepper-label">Повторы${perSide(ex) ? ' (на сторону)' : ''}</div>
      <div class="stepper"><button data-a="r-minus" aria-label="Меньше повторов">−</button><div class="val">${S.ui.reps}</div><button data-a="r-plus" aria-label="Больше повторов">+</button></div></div>
    <label class="check"><input type="checkbox" data-f="breath" ${S.ui.breath ? 'checked' : ''}> Хотелось задержать дыхание / напрягалось лицо</label>
    ${btn('Подход сделан', 'set-done', { cls: 'btn-primary btn-xl' })}
    ${undoButton()}
    ${canWarmup ? btn(`Разминочный подход: 10 × ${esc(fmtWeight(sug.weight != null ? roundToStep(sug.weight / 2, stepFor(ex)) : null, unit))}`, 'warmup-set') : ''}
    ${isMachine ? `<label class="field">Настройка тренажёра<input type="text" data-f="seat" value="${esc(exs.seat || '')}" placeholder="сиденье 4, валик 2"></label>` : ''}
    <div class="grid2">${btn('Техника', 'tech')}${btn('Список', 'list')}${btn('Отложить в конец', 'postpone')}${btn('Пропустить', 'skip-ex')}</div>`;
}

function undoButton() {
  const last = S.run.sets[S.run.sets.length - 1];
  return last ? btn(`Отменить последний подход (${esc(EX_BY_ID[last.exerciseId].name)})`, 'undo', { cls: 'btn-link' }) : '';
}

function exerciseSummaryLine() {
  const r = S.run;
  const done = r.order.filter((id) => exComplete(id)).length;
  return `Сделано ${done} из ${r.order.length}${r.skipped.length ? `, пропущено ${r.skipped.length}` : ''}.`;
}

function renderCardio() {
  const r = S.run;
  const min = cy.PHASES[r.phase].cardioMin;
  const t = r.timer && r.timer.kind === 'cardio' ? r.timer : null;
  const machine = r.cardioMachine;
  if (!t) {
    return `<h2>Кардио ${min} мин</h2><p class="lead">Зона 2: можно говорить короткими фразами. Если тренажёр показывает пульс с датчиков на рукоятях — ориентир 105–125.</p>
      <fieldset><legend>Тренажёр</legend><div class="chips">${CARDIO_MACHINES.map((m) => chip(m.name, 'machine', m.id, machine === m.id)).join('')}</div></fieldset>
      ${btn('Старт', 'cardio-start', { cls: 'btn-primary' })}${btn('Без кардио — к бассейну', 'cardio-skip', { cls: 'btn-link' })}`;
  }
  if (t.done || r.cardioEnded) {
    return `<h2>Кардио окончено</h2><fieldset><legend>Говорить было</legend><div class="chips">${[['easy', 'Легко'], ['phrases', 'Короткими фразами'], ['hard', 'Трудно']].map(([v, l]) => chip(l, 'talk', v, false)).join('')}</div></fieldset>`;
  }
  return `<h2>Кардио</h2>${timerBlock('timer', t)}${btn(t.pausedAt ? 'Продолжить' : 'Пауза', 'timer-pause', { cls: 'btn-xl btn-secondary' })}${btn('Закончила', 'cardio-end')}`;
}

function renderPool() {
  const r = S.run;
  const plan = poolPlan(r.phase, r.slot);
  const t = r.timer && r.timer.kind === 'pool' ? r.timer : null;
  if (r.poolAsk || (t && t.done)) {
    return `<h2>Как прошёл бассейн?</h2><div class="stack">${btn('Сделала план', 'pool-result', { v: 'done', cls: 'btn-primary' })}${btn('Частично', 'pool-result', { v: 'partial' })}${btn('Не плавала', 'pool-result', { v: 'none' })}</div>`;
  }
  if (!t) {
    return `<h2>Бассейн</h2><p class="big-text">${esc(plan.text)}</p>
      <p>Телефон у бортика, лучше в чехле. В воде — голос и сигналы: высокий двойной — «бодро», низкий — «спокойно». Большая кнопка «Пауза» нажимается мокрой рукой.</p>
      ${btn('Старт таймера', 'pool-start', { cls: 'btn-primary btn-xl' })}${btn('Без таймера', 'pool-ask')}${btn('Не плаваю сегодня', 'pool-result', { v: 'none', cls: 'btn-link' })}`;
  }
  return `${timerBlock('timer', t, { showTotal: true })}
    <button class="btn btn-pause" data-a="timer-pause">${t.pausedAt ? 'ПРОДОЛЖИТЬ' : 'ПАУЗА'}</button>
    ${btn('Закончила', 'pool-ask')}`;
}

function renderStretch() {
  const r = S.run;
  const t = r.timer && r.timer.kind === 'stretch' ? r.timer : null;
  if (!t) {
    return `<h2>Растяжка</h2><ol class="list">${STRETCHES.map((s) => `<li><b>${esc(s.name)}</b> — ${esc(s.hint)}</li>`).join('')}</ol>
      ${btn('Начать растяжку', 'stretch-start', { cls: 'btn-primary' })}${btn('Пропустить растяжку', 'stretch-skip', { cls: 'btn-link' })}`;
  }
  const st = tState(t);
  const pose = STRETCHES[st.idx];
  return `<p class="sub">Поза ${st.idx + 1} из ${STRETCHES.length}</p><h2>${esc(pose.name)}</h2><p class="lead">${esc(pose.hint)}</p>
    ${timerBlock('timer', t)}<div class="row2">${btn(t.pausedAt ? 'Продолжить' : 'Пауза', 'timer-pause')}${btn('Дальше', 'timer-next', { cls: 'btn-primary' })}</div>`;
}

function renderSummary() {
  const r = S.run;
  const minutes = Math.round((Date.now() - new Date(r.checkInAt).getTime()) / 60000);
  const lines = [];
  if (r.slot !== 'cardio') {
    for (const id of r.order) {
      const ex = EX_BY_ID[id];
      const sets = workSets(id);
      if (!sets.length) { lines.push(`<li>${esc(ex.name)}: ${r.skipped.includes(id) ? 'пропущено' : 'не сделано'}</li>`); continue; }
      const prev = historyFor(id)[0];
      const prevW = prev ? Math.max(...prev.sets.map((x) => x.weight ?? 0)) : null;
      const nowW = Math.max(...sets.map((x) => x.weight ?? 0));
      const grew = prev && nowW > prevW ? ` · вес вырос: ${String(prevW).replace('.', ',')} → ${String(nowW).replace('.', ',')}` : '';
      const hard = sets.filter((x) => x.breathHold).length ? ' · было трудно дышать' : '';
      lines.push(`<li>${esc(ex.name)}: ${sets.map((x) => `${x.weight == null ? '' : `${String(x.weight).replace('.', ',')}×`}${x.reps}`).join(', ')}${grew}${hard}</li>`);
    }
  }
  if (r.cardio) lines.push(`<li>Кардио: ${r.cardio.minutes} мин${r.cardio.talkTest === 'hard' ? ' · было трудно говорить — в следующий раз снизь сопротивление' : ''}</li>`);
  if (r.pool) lines.push(`<li>Бассейн: ${{ done: 'план сделан', partial: 'частично', none: 'не плавала' }[r.pool.result]}${r.pool.minutes ? `, ${r.pool.minutes} мин` : ''}</li>`);
  lines.push(`<li>Растяжка: ${r.stretchDone ? 'сделана' : 'пропущена'}</li>`);
  if (r.status === 'in_progress' || !r.summaryStatus) r.summaryStatus = autoStatus(r);
  const back = S.activities.some((a) => a.sessionId === r.id && a.commute === 'from');
  return `<h2>Итог</h2><p>Визит: ${minutes} мин${r.aborted ? ' · прервана по стоп-сигналу' : ''}${r.lightDay ? ' · лёгкий день' : ''}</p>
    <ul class="list">${lines.join('')}</ul>
    <fieldset><legend>Статус визита</legend><div class="chips">${chip('Сделано', 'sum-status', 'done', r.summaryStatus === 'done')}${chip('Частично', 'sum-status', 'partial', r.summaryStatus === 'partial')}</div></fieldset>
    <fieldset><legend>Обратно пешком (~${S.settings.commuteKm} км)?</legend><div class="chips">${chip('Да', 'walk-back', 'yes', back)}${chip('Нет', 'walk-back', 'no', false)}</div></fieldset>
    <label class="field">Заметка<textarea data-f="note" rows="3">${esc(r.note || '')}</textarea></label>
    ${btn('Завершить тренировку', 'finish', { cls: 'btn-primary btn-xl' })}${r.slot !== 'cardio' ? btn('Вернуться к упражнениям', 'stage', { v: 'exercises', cls: 'btn-link' }) : ''}`;
}

function autoStatus(r) {
  if (r.aborted) return 'partial';
  if (r.slot === 'cardio') return r.cardio && r.pool && r.pool.result !== 'none' ? 'done' : 'partial';
  return r.order.every((id) => exComplete(id)) ? 'done' : 'partial';
}

// ---------- остальные экраны ----------
function renderMeasure() {
  const f = S.form;
  if (f.kind !== 'measure') Object.assign(S.form, { kind: 'measure', pm: undefined, date: cy.today() });
  if (S.form.pm === undefined) {
    return `<h1>Замер</h1><p class="lead">Сейчас предменструальные дни?</p><div class="row2">${btn('Нет', 'pm', { v: 'no', cls: 'btn-primary' })}${btn('Да', 'pm', { v: 'yes' })}</div>`;
  }
  if (S.form.pm === 'yes' && !S.form.pmConfirmed) {
    return `<h1>Замер</h1><p class="lead">Цифры в эти дни непоказательные: лучше перенести замер на 3–5 дней.</p>${btn('Перенести', 'go', { v: 'today', cls: 'btn-primary' })}${btn('Всё равно записать', 'pm-confirm')}`;
  }
  const field = (key, label) => `<label class="field">${label}<input type="text" inputmode="decimal" data-f="m-${key}" value="${esc(S.form[key] ?? '')}"></label>`;
  return `<h1>Замер</h1><p class="sub">Утром, натощак, после туалета.</p>
    <label class="field">Дата<input type="date" data-f="m-date" value="${esc(S.form.date)}"></label>
    ${field('weightKg', 'Вес, кг')}${field('waistCm', 'Талия, см')}${field('bellyNavelCm', 'Живот по пупку, см')}${field('hipsCm', 'Бёдра, см')}${field('thighCm', 'Бедро, см')}
    <p class="note">Фото пока снимай камерой телефона: спереди, сбоку, сзади — тот же свет, то же место, та же одежда. Фото в приложении будут в следующей версии.</p>
    ${btn('Сохранить замер', 'measure-save', { cls: 'btn-primary' })}`;
}

function renderHomeLog() {
  if (S.form.kind !== 'home') Object.assign(S.form, { kind: 'home', type: S.form.preset || 'ringfit', minutes: null, km: 3, date: cy.today(), feel: null, breath: false });
  const f = S.form;
  const k = HOME_KINDS.find((x) => x.id === f.type);
  const minutes = f.minutes ?? k.minutes;
  return `<h1>${f.type === 'walk' ? 'Прогулка' : 'Дома'}</h1>
    <fieldset><legend>Что</legend><div class="chips">${HOME_KINDS.map((x) => chip(x.name, 'h-type', x.id, f.type === x.id)).join('')}</div></fieldset>
    ${k.safety ? `<p class="eye-note">${esc(k.safety)}</p>` : ''}
    <div class="stepper-block"><div class="stepper-label">Минуты</div><div class="stepper"><button data-a="h-min" data-v="-5" aria-label="Меньше минут">−</button><div class="val">${minutes}</div><button data-a="h-min" data-v="5" aria-label="Больше минут">+</button></div></div>
    ${f.type === 'walk' ? `<div class="stepper-block"><div class="stepper-label">Километры</div><div class="stepper"><button data-a="h-km" data-v="-0.5" aria-label="Меньше">−</button><div class="val">${String(f.km).replace('.', ',')}</div><button data-a="h-km" data-v="0.5" aria-label="Больше">+</button></div></div>` : `
    <fieldset><legend>Как прошло</legend><div class="chips">${[['easy', 'Легко'], ['ok', 'Нормально'], ['hard', 'Тяжело']].map(([v, l]) => chip(l, 'h-feel', v, f.feel === v)).join('')}</div></fieldset>
    <label class="check"><input type="checkbox" data-f="h-breath" ${f.breath ? 'checked' : ''}> Хотелось задержать дыхание / напрягалось лицо</label>`}
    <label class="field">Дата<input type="date" data-f="h-date" value="${esc(f.date)}"></label>
    ${btn('Сохранить', 'home-save', { cls: 'btn-primary' })}`;
}

const STATUS_RU = { done: 'Сделано', partial: 'Частично', skip: 'Пропуск', in_progress: 'В процессе' };
const KIND_RU = Object.fromEntries(HOME_KINDS.map((k) => [k.id, k.name]));

function renderHistory() {
  const items = [
    ...S.sessions.map((s) => ({ date: s.date, at: s.checkInAt || s.date, html: `<button class="row-btn" data-a="session" data-v="${s.id}"><b>${cy.fmtShort(s.date)} · ${esc(SLOT_NAMES[s.slot] || s.slot)}${s.intro ? ' (вводная)' : ''}</b><span>${STATUS_RU[s.status]}${s.aborted ? ' · прервана' : ''} · ${(s.sets || []).filter((x) => !x.isWarmup).length} подх.</span></button>` })),
    ...S.activities.map((a) => ({ date: a.date, at: a.date, html: `<div class="row-btn"><b>${cy.fmtShort(a.date)} · ${a.commute ? 'Пешком до клуба' : esc(KIND_RU[a.kind])}</b><span>${a.minutes ? `${a.minutes} мин` : ''}${a.distanceKm ? ` ${String(a.distanceKm).replace('.', ',')} км` : ''}</span><button class="btn-link" data-a="del-activity" data-v="${a.id}">Удалить</button></div>` })),
    ...S.measurements.map((m) => ({ date: m.date, at: m.date, html: `<div class="row-btn"><b>${cy.fmtShort(m.date)} · Замер${m.checkpoint != null ? ` (контрольный ${m.checkpoint})` : ''}${m.premenstrual ? ' · непоказательно' : ''}</b><span>${[['weightKg', 'вес'], ['waistCm', 'талия'], ['bellyNavelCm', 'живот'], ['hipsCm', 'бёдра'], ['thighCm', 'бедро']].filter(([k]) => m[k] != null).map(([k, l]) => `${l} ${String(m[k]).replace('.', ',')}`).join(' · ')}</span></div>` })),
  ].sort((a, b) => b.at.localeCompare(a.at));
  return `<h1>История</h1>${items.length ? items.map((i) => i.html).join('') : '<p>Пока пусто.</p>'}`;
}

function renderHelp() {
  return `<h1>Справка</h1>
    <section class="card danger-card"><h2>Стоп-сигналы</h2><p><b>Прекратить тренировку и в тот же день к офтальмологу, если:</b></p><ul class="list">${STOP_MAIN.map((x) => `<li>${esc(x)}</li>`).join('')}</ul><p>${esc(STOP_SECONDARY)}</p></section>
    <section class="card"><h2>Правила</h2><ol class="list">${SAFETY.map((x) => `<li>${esc(x)}</li>`).join('')}</ol></section>
    <section class="card"><h2>Намеренно исключены</h2><p>${esc(EXCLUDED)}</p></section>
    <section class="card"><h2>По фазам</h2><table class="tbl"><tr><th>Фаза</th><th>Подходы × повторы</th><th>Отдых</th><th>Кардио</th><th>Шаги</th></tr>
      ${cy.PHASE_ORDER.map((p) => `<tr><td>${cy.PHASES[p].name}</td><td>${p === 'p1' ? '2–3' : p === 'deload' ? '2' : '3'} × ${cy.PHASES[p].reps.min}–${cy.PHASES[p].reps.max}</td><td>${cy.PHASES[p].rest} с</td><td>${cy.PHASES[p].cardioMin} мин</td><td>${cy.PHASES[p].steps}</td></tr>`).join('')}</table></section>
    <section class="card"><h2>Питание</h2><table class="tbl">${NUTRITION.map(([a, b]) => `<tr><td>${a}</td><td>${b}</td></tr>`).join('')}</table><ul class="list">${NUTRITION_NOTES.map((x) => `<li>${esc(x)}</li>`).join('')}</ul></section>`;
}

function renderSettings() {
  const s = S.settings;
  return `<h1>Настройки</h1>
    <label class="field">Старт цикла (понедельник недели 1)<input type="date" data-f="startDate" value="${esc(s.startDate)}"></label>
    <fieldset><legend>Голосовые подсказки</legend><div class="chips">${chip('Вкл', 'voice', 'on', s.voice)}${chip('Выкл', 'voice', 'off', !s.voice)}</div></fieldset>
    ${btn('Проверить звук и голос', 'test-sound')}
    <p class="note">На iPhone выключи беззвучный режим (переключатель сбоку) и прибавь громкость — иначе сигналов может не быть.${snd.hasRuVoice() ? '' : ' Русский голос в системе пока не найден: будут только сигналы. Голос можно скачать в Настройки → Универсальный доступ → Устный контент → Голоса.'}</p>
    <label class="field">Пешком до клуба, км в одну сторону<input type="text" inputmode="decimal" data-f="commuteKm" value="${esc(String(s.commuteKm).replace('.', ','))}"></label>
    <section class="card"><h2>Копия данных</h2><p>Всё хранится только на этом телефоне. ${s.lastBackupAt ? `Последняя копия: ${cy.fmtDate(s.lastBackupAt.slice(0, 10))}.` : 'Копий ещё не было.'}</p>
      ${btn('Сохранить копию', 'export', { cls: 'btn-primary' })}
      <label class="btn btn-secondary file-btn">Загрузить из копии<input type="file" accept="application/json,.json" data-f="import" hidden></label></section>
    ${btn('Стереть все данные', 'reset', { cls: 'btn-link danger-link' })}
    <p class="note">Версия 0.1 · ${S.sessions.length} тренировок · ${S.measurements.length} замеров</p>`;
}

function renderMain() {
  const screens = { today: renderToday, history: renderHistory, help: renderHelp, settings: renderSettings, measure: renderMeasure, home: renderHomeLog };
  const body = (screens[S.screen] || renderToday)();
  const nav = [['today', 'Сегодня'], ['history', 'История'], ['help', 'Справка'], ['settings', 'Настройки']];
  return `<main class="page">${body}</main><nav class="bottom-nav">${nav.map(([id, l]) => `<button data-a="go" data-v="${id}" ${S.screen === id ? 'aria-current="page"' : ''}>${l}</button>`).join('')}</nav>`;
}

// ---------- оверлеи ----------
function renderOverlay() {
  const o = S.overlay;
  if (!o) return '';
  let inner = '';
  if (o.type === 'stop') {
    inner = `<h2 class="danger-text">Стоп-сигналы</h2><p class="lead"><b>Прекратить тренировку и в тот же день к офтальмологу, если:</b></p><ul class="list big-list">${STOP_MAIN.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>
      <p>${esc(STOP_SECONDARY)}</p><fieldset><legend>Что было (необязательно)</legend><div class="chips">${SYMPTOMS.map((x) => chip(x.name, 'symptom', x.id, (o.symptoms || []).includes(x.id))).join('')}</div></fieldset>
      ${btn('Завершить тренировку', 'stop-finish', { cls: 'btn-danger' })}${btn('Снизить нагрузку и продолжить', 'stop-lighter')}${btn('Закрыть', 'close')}`;
  } else if (o.type === 'pressure') {
    inner = `<h2>Давление в глазах или голове</h2><p>Если есть вспышки, мушки, тень или шторка — тренировку не начинать и в тот же день к офтальмологу.</p><p>Если просто давление — сегодня лёгкий день: на подход меньше и вес на шаг ниже. Если усилится — закончить.</p>
      ${btn('Лёгкий день', 'light', { v: 'yes', cls: 'btn-primary' })}${btn('Не тренироваться сегодня', 'abort-start', { cls: 'btn-danger' })}`;
  } else if (o.type === 'light') {
    inner = `<h2>Лёгкий день?</h2><p>На подход меньше, вес на шаг ниже. Такая тренировка не влияет на подсказки весов.</p>${btn('Да, лёгкий день', 'light', { v: 'yes', cls: 'btn-primary' })}${btn('Нет, как обычно', 'light', { v: 'no' })}`;
  } else if (o.type === 'walked') {
    inner = `<h2>Пришла пешком?</h2><p>Засчитаю прогулку ~${String(S.settings.commuteKm).replace('.', ',')} км.</p><div class="row2">${btn('Да', 'walked', { v: 'yes', cls: 'btn-primary' })}${btn('Нет', 'walked', { v: 'no' })}</div>${o.warn ? `<p class="note">${esc(o.warn)}</p>` : ''}${btn('Отмена', 'close', { cls: 'btn-link' })}`;
  } else if (o.type === 'chooser') {
    inner = `<h2>Какую тренировку делаем?</h2><div class="stack">${cy.SLOT_ORDER.map((s) => btn(SLOT_NAMES[s], 'checkin', { v: s })).join('')}</div>${btn('Отмена', 'close', { cls: 'btn-link' })}`;
  } else if (o.type === 'list') {
    const r = S.run;
    inner = `<h2>Упражнения</h2><div class="stack">${r.order.map((id, i) => {
      const ex = EX_BY_ID[id];
      const n = workSets(id).length;
      const mark = r.skipped.includes(id) ? 'пропущено' : exComplete(id) ? `✓ ${n}/${setsTarget()}` : `${n}/${setsTarget()}`;
      return `<button class="row-btn" data-a="goto-ex" data-v="${i}" ${i === r.current ? 'aria-current="true"' : ''}><b>${i + 1}. ${esc(ex.name)}</b><span>${mark}</span></button>`;
    }).join('')}</div>${btn('Закрыть', 'close')}`;
  } else if (o.type === 'tech') {
    const ex = currentEx();
    inner = `<h2>${esc(ex.name)}</h2>${ex.eyeNote ? `<p class="eye-note">⚠ ${esc(ex.eyeNote)}</p>` : ''}
      <h3>Исходное</h3><p>${esc(ex.setup)}</p><h3>Движение</h3><p>${esc(ex.movement)}</p><h3>Ошибки</h3><p>${esc(ex.mistakes)}</p>
      <p>Выдох на усилии. Темп 2 с на усилие, 2–3 с на возврат. Взгляд прямо.</p>
      <a class="btn btn-secondary" href="https://www.youtube.com/results?search_query=${encodeURIComponent(`${ex.nameEn} technique`)}" target="_blank" rel="noopener">Видео на YouTube</a>${btn('Закрыть', 'close')}`;
  } else if (o.type === 'session') {
    const s = S.sessions.find((x) => x.id === o.id);
    const byEx = {};
    for (const x of s.sets || []) (byEx[x.exerciseId] = byEx[x.exerciseId] || []).push(x);
    inner = `<h2>${cy.fmtShort(s.date)} · ${esc(SLOT_NAMES[s.slot])}</h2>
      <ul class="list">${Object.entries(byEx).map(([id, sets]) => `<li><b>${esc(EX_BY_ID[id] ? EX_BY_ID[id].name : id)}</b>: ${sets.map((x) => `${x.isWarmup ? 'разм. ' : ''}${x.weight == null ? '' : `${String(x.weight).replace('.', ',')}×`}${x.reps}${x.breathHold ? ' (трудно дышать)' : ''}`).join(', ')}</li>`).join('')}
      ${s.cardio ? `<li>Кардио ${s.cardio.minutes} мин</li>` : ''}${s.pool ? `<li>Бассейн: ${s.pool.result}</li>` : ''}</ul>${s.note ? `<p>${esc(s.note)}</p>` : ''}
      <fieldset><legend>Статус</legend><div class="chips">${['done', 'partial', 'skip'].map((st) => chip(STATUS_RU[st], 'sess-status', `${s.id}:${st}`, s.status === st)).join('')}</div></fieldset>
      ${btn('Удалить тренировку', 'sess-del', { v: s.id, cls: 'btn-link danger-link' })}${btn('Закрыть', 'close')}`;
  }
  return `<div class="overlay" role="dialog" aria-modal="true"><div class="sheet">${inner}</div></div>`;
}

// ---------- действия ----------
function go(screen) { S.screen = screen; S.overlay = null; if (screen !== 'measure' && screen !== 'home') S.form = {}; window.scrollTo(0, 0); render(); }

const A = {
  go: (v) => {
    if (v === 'walk') { S.form = { preset: 'walk' }; return go('home'); }
    if (v === 'home') { S.form = { preset: 'ringfit' }; return go('home'); }
    if (v === 'measure') S.form = {};
    go(v);
  },
  close: () => { S.overlay = null; render(); },
  chooser: () => { S.overlay = { type: 'chooser' }; render(); },
  checkin: (slot) => {
    let warn = '';
    if (slot !== 'cardio') {
      const lastStrength = S.sessions.filter((s) => s.slot === 'A' || s.slot === 'B').sort((a, b) => b.checkInAt.localeCompare(a.checkInAt))[0];
      if (lastStrength && Date.now() - new Date(lastStrength.checkInAt).getTime() < 48 * 3600 * 1000) warn = 'Между силовыми лучше 48 часов.';
    }
    S.overlay = { type: 'walked', slot, warn }; render();
  },
  walked: (v) => { snd.unlock(); const slot = S.overlay.slot; S.overlay = null; S.preferSlot = null; startSession(slot, v === 'yes'); },
  resume: () => { snd.unlock(); snd.keepAwake(true); S.screen = 'workout'; render(); },
  minimize: () => { snd.keepAwake(false); S.screen = 'today'; render(); },
  stop: () => { S.overlay = { type: 'stop', symptoms: [] }; render(); },
  symptom: (v) => { const l = S.overlay.symptoms; const i = l.indexOf(v); if (i >= 0) l.splice(i, 1); else l.push(v); render(); },
  'stop-finish': async () => {
    await logSymptoms(S.overlay.symptoms, true);
    const r = S.run; r.aborted = true; r.note = [r.note, 'Прервана по стоп-сигналу'].filter(Boolean).join('. '); r.rest = null; r.timer = null; r.stage = 'summary';
    S.overlay = null; await saveRun(); render();
  },
  'stop-lighter': async () => { await logSymptoms(S.overlay.symptoms, false); S.run.lightDay = true; S.overlay = null; S.ui = {}; await saveRun(); render(); },

  wb: (v) => { const [f, val] = v.split(':'); S.run.wellbeing[f] = val; render(); },
  'wb-next': async () => {
    const w = S.run.wellbeing;
    if (w.pressure === 'yes') { await logSymptoms(['headPressure'], false, 'перед тренировкой'); S.overlay = { type: 'pressure' }; }
    else if (w.sleep === 'bad' || w.energy === 'low') S.overlay = { type: 'light' };
    else S.run.stage = 'warmup';
    await saveRun(); render();
  },
  light: async (v) => { S.run.lightDay = v === 'yes'; S.run.stage = 'warmup'; S.overlay = null; S.ui = {}; await saveRun(); render(); },
  'abort-start': async () => { const r = S.run; r.aborted = true; r.status = 'skip'; r.finishedAt = nowISO(); r.note = 'Не начата: давление в глазах или голове'; S.overlay = null; await finalizeRun(); snd.keepAwake(false); go('today'); },

  'warmup-start': async () => { startTimer('timer', 'warmup', [{ label: 'Разминка', sec: (S.run.slot === 'cardio' ? 5 : 10) * 60, half: true }], { endSay: 'Разминка окончена' }); await saveRun(); render(); },
  'warmup-done': async () => { S.run.timer = null; S.run.stage = S.run.slot === 'cardio' ? 'cardio' : 'exercises'; await saveRun(); render(); },
  'timer-pause': async () => { const t = S.run.timer; if (!t) return; if (t.pausedAt) { t.pausedMs += Date.now() - t.pausedAt; t.pausedAt = null; } else t.pausedAt = Date.now(); await saveRun(); render(); },
  'timer-next': () => { const t = S.run.timer; if (!t) return; t.skipSec += tState(t).segRem + 0.01; tick(); render(); },

  'w-minus': () => { const ex = currentEx(); const step = stepFor(ex); const w = S.ui.weight; S.ui.weight = w == null || w - step <= 0 ? null : roundToStep(w - step, step); render(); },
  'w-plus': () => { const ex = currentEx(); const step = stepFor(ex); S.ui.weight = roundToStep((S.ui.weight ?? 0) + step, step); render(); },
  'r-minus': () => { S.ui.reps = Math.max(1, S.ui.reps - 1); render(); },
  'r-plus': () => { S.ui.reps += 1; render(); },
  unit: async () => { const ex = currentEx(); const cur = unitFor(ex); S.exSettings[ex.id] = { ...(S.exSettings[ex.id] || {}), unit: cur === 'plate' ? 'kg' : 'plate' }; await saveExSettings(ex.id); render(); },
  'to-dumbbells': async () => { const ex = currentEx(); S.exSettings[ex.id] = { ...(S.exSettings[ex.id] || {}), loadTypeOverride: 'dumbbell' }; await saveExSettings(ex.id); S.ui = {}; render(); },
  'set-done': async () => {
    const r = S.run;
    const ex = currentEx();
    const idx = workSets(ex.id).length;
    r.sets.push({ exerciseId: ex.id, setIndex: idx, weight: S.ui.weight, unit: unitFor(ex), reps: S.ui.reps, breathHold: !!S.ui.breath, doneAt: nowISO() });
    const target = setsTarget();
    let nextText;
    if (idx + 1 >= target) {
      const next = nextExerciseIndex(r.current);
      if (next == null) nextText = 'Упражнения закончены';
      else { r.current = next; nextText = `Следующее упражнение — ${EX_BY_ID[r.order[next]].name}`; }
    } else nextText = `Подход ${idx + 2} из ${target}`;
    snd.unlock();
    r.rest = mkTimer('rest', [{ label: 'Отдых', sec: cy.PHASES[r.phase].rest }], { endSay: `Отдых окончен. ${nextText}` });
    S.ui = {};
    await saveRun(); window.scrollTo(0, 0); render();
  },
  'warmup-set': async () => {
    const ex = currentEx();
    const w = S.ui.sug.weight != null ? roundToStep(S.ui.sug.weight / 2, stepFor(ex)) : null;
    S.run.sets.push({ exerciseId: ex.id, setIndex: -1, weight: w, unit: unitFor(ex), reps: 10, breathHold: false, isWarmup: true, doneAt: nowISO() });
    await saveRun(); render();
  },
  undo: async () => {
    const r = S.run;
    const last = r.sets.pop();
    if (!last) return;
    r.rest = null;
    r.skipped = r.skipped.filter((id) => id !== last.exerciseId);
    r.current = r.order.indexOf(last.exerciseId);
    if (r.stage !== 'exercises') r.stage = 'exercises';
    S.ui = {};
    await saveRun(); render();
  },
  'rest-plus': async () => { const t = S.run.rest; if (t) { t.segments[0].sec += 15; t.warned = false; } await saveRun(); render(); },
  'rest-skip': async () => { S.run.rest = null; await saveRun(); render(); },
  list: () => { S.overlay = { type: 'list' }; render(); },
  tech: () => { S.overlay = { type: 'tech' }; render(); },
  'goto-ex': async (v) => { const r = S.run; const i = Number(v); r.current = i; r.skipped = r.skipped.filter((id) => id !== r.order[i]); S.overlay = null; S.ui = {}; await saveRun(); render(); },
  postpone: async () => {
    const r = S.run;
    const [id] = r.order.splice(r.current, 1);
    r.order.push(id);
    const n = nextExerciseIndex(r.current - 1 < 0 ? r.order.length - 1 : r.current - 1);
    r.current = n ?? r.order.length - 1;
    S.ui = {}; await saveRun(); render();
  },
  'skip-ex': async () => {
    const r = S.run;
    r.skipped.push(r.order[r.current]);
    const n = nextExerciseIndex(r.current);
    if (n != null) r.current = n;
    S.ui = {}; await saveRun(); render();
  },
  'to-pool': async () => { S.run.rest = null; S.run.stage = 'pool'; await saveRun(); render(); },

  machine: (v) => { S.run.cardioMachine = v; render(); },
  'cardio-start': async () => {
    snd.unlock();
    const min = cy.PHASES[S.run.phase].cardioMin;
    S.run.cardioMachine = S.run.cardioMachine || 'elliptical';
    startTimer('timer', 'cardio', [{ label: 'Кардио, зона 2', sec: min * 60, half: true, say: `Кардио ${minutesWord(min)}. Можно говорить короткими фразами` }], { endSay: 'Кардио окончено' });
    await saveRun(); render();
  },
  'cardio-end': async () => { S.run.cardioEnded = true; await saveRun(); render(); },
  'cardio-skip': async () => { S.run.timer = null; S.run.stage = 'pool'; await saveRun(); render(); },
  talk: async (v) => {
    const r = S.run;
    const t = r.timer;
    const minutes = t ? Math.round(Math.min(tState(t).el, totalSec(t)) / 60) : 0;
    r.cardio = { minutes, machine: r.cardioMachine, talkTest: v };
    r.timer = null; r.cardioEnded = false; r.stage = 'pool';
    await saveRun(); render();
  },

  'pool-start': async () => {
    snd.unlock();
    const plan = poolPlan(S.run.phase, S.run.slot);
    startTimer('timer', 'pool', plan.segments, { endSay: 'Плавание окончено. Можно выходить' });
    await saveRun(); render();
  },
  'pool-ask': async () => { S.run.poolAsk = true; await saveRun(); render(); },
  'pool-result': async (v) => {
    const r = S.run;
    const t = r.timer && r.timer.kind === 'pool' ? r.timer : null;
    r.pool = { result: v, minutes: t ? Math.round(Math.min(tState(t).el, totalSec(t)) / 60) : undefined };
    r.timer = null; r.poolAsk = false; r.stage = 'stretch';
    await saveRun(); render();
  },

  'stretch-start': async () => {
    snd.unlock();
    startTimer('timer', 'stretch', STRETCHES.map((s) => ({ label: s.name, sec: s.sec, say: `${s.name}. ${s.sec === 30 ? '30 секунд' : s.hint}` })), { endSay: 'Растяжка окончена' });
    await saveRun(); render();
  },
  'stretch-skip': async () => { S.run.timer = null; S.run.stretchDone = false; S.run.stage = 'summary'; await saveRun(); render(); },
  stage: async (v) => { S.run.stage = v; await saveRun(); render(); },

  'sum-status': (v) => { S.run.summaryStatus = v; S.run.statusManual = true; render(); },
  'walk-back': async (v) => {
    const r = S.run;
    const existing = S.activities.find((a) => a.sessionId === r.id && a.commute === 'from');
    if (v === 'yes' && !existing) await addActivity({ kind: 'walk', commute: 'from', distanceKm: S.settings.commuteKm, sessionId: r.id });
    if (v === 'no' && existing) { await db.del('activities', existing.id); S.activities = S.activities.filter((a) => a !== existing); }
    render();
  },
  finish: async () => {
    const r = S.run;
    r.status = r.summaryStatus || autoStatus(r);
    r.finishedAt = nowISO();
    delete r.summaryStatus;
    await finalizeRun();
    snd.keepAwake(false);
    go('today');
  },

  pm: (v) => { S.form.pm = v; render(); },
  'pm-confirm': () => { S.form.pmConfirmed = true; render(); },
  'measure-save': async () => {
    const f = S.form;
    const rec = { id: uid(), cycleId: 'c1', date: f.date, checkpoint: cy.checkpointNear(f.date, S.settings.startDate), premenstrual: f.pm === 'yes' };
    for (const k of ['weightKg', 'waistCm', 'bellyNavelCm', 'hipsCm', 'thighCm']) { const n = num(f[k]); if (n != null) rec[k] = n; }
    await db.put('measurements', rec);
    S.measurements.push(rec);
    go('today');
  },

  'h-type': (v) => { S.form.type = v; S.form.minutes = null; render(); },
  'h-min': (v) => { const k = HOME_KINDS.find((x) => x.id === S.form.type); S.form.minutes = Math.max(5, (S.form.minutes ?? k.minutes) + Number(v)); render(); },
  'h-km': (v) => { S.form.km = Math.max(0.5, +(S.form.km + Number(v)).toFixed(1)); render(); },
  'h-feel': (v) => { S.form.feel = v; render(); },
  'home-save': async () => {
    const f = S.form;
    const k = HOME_KINDS.find((x) => x.id === f.type);
    await addActivity({ kind: f.type, date: f.date, minutes: f.minutes ?? k.minutes, distanceKm: f.type === 'walk' ? f.km : undefined, feel: f.feel || undefined, breathHold: f.breath || undefined });
    go('today');
  },
  'del-activity': async (v) => { if (!confirm('Удалить запись?')) return; await db.del('activities', v); S.activities = S.activities.filter((a) => a.id !== v); render(); },

  session: (v) => { S.overlay = { type: 'session', id: v }; render(); },
  'sess-status': async (v) => { const [id, st] = v.split(':'); const s = S.sessions.find((x) => x.id === id); s.status = st; s.statusManual = true; await db.put('sessions', s); render(); },
  'sess-del': async (v) => { if (!confirm('Удалить тренировку из истории?')) return; await db.del('sessions', v); S.sessions = S.sessions.filter((s) => s.id !== v); S.overlay = null; render(); },

  voice: async (v) => { S.settings.voice = v === 'on'; snd.setVoice(S.settings.voice); await saveSettings(); render(); },
  'test-sound': () => { snd.unlock(); snd.announce('Проверка. Отдых окончен. Подход 2 из 3', 'end'); },
  export: () => doExport(),
  reset: async () => {
    if (!confirm('Стереть все тренировки, замеры и настройки на этом телефоне?')) return;
    if (!confirm('Точно? Восстановить можно будет только из копии.')) return;
    await db.replaceAll({});
    location.reload();
  },
};

async function logSymptoms(ids, stopPressed, note) {
  const list = ids.length ? ids : [stopPressed ? 'other' : 'lighter'];
  for (const kind of list) {
    const rec = { id: uid(), at: nowISO(), kind, sessionId: S.run ? S.run.id : undefined, stopSignalPressed: stopPressed, note };
    await db.put('symptoms', rec);
    S.symptoms.push(rec);
  }
}

async function doExport() {
  const data = await db.exportAll();
  const payload = { schemaVersion: 2, app: 'trenirovki', exportedAt: nowISO(), ...data };
  const name = `trenirovki-${cy.today()}.json`;
  const blob = new Blob([JSON.stringify(payload)], { type: 'application/json' });
  const markDone = async () => { S.settings.lastBackupAt = nowISO(); await saveSettings(); render(); };
  try {
    const file = new File([blob], name, { type: 'application/json' });
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      await navigator.share({ files: [file], title: name });
      return markDone();
    }
  } catch (e) {
    if (e && e.name === 'AbortError') return;
  }
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  markDone();
}

async function doImport(file) {
  try {
    const data = JSON.parse(await file.text());
    if (data.app !== 'trenirovki' || !data.schemaVersion) throw new Error('Это не копия приложения «Тренировки».');
    const count = (k) => (Array.isArray(data[k]) ? data[k].length : 0);
    if (!confirm(`Загрузить копию от ${data.exportedAt ? data.exportedAt.slice(0, 10) : '?'}: ${count('sessions')} тренировок, ${count('measurements')} замеров, ${count('activities')} занятий? Текущие данные будут заменены.`)) return;
    await db.replaceAll(data);
    location.reload();
  } catch (e) {
    alert(`Не получилось загрузить: ${e.message}`);
  }
}

// ---------- события ----------
$app.addEventListener('click', (e) => {
  const el = e.target.closest('[data-a]');
  if (!el) return;
  const fn = A[el.dataset.a];
  if (fn) { e.preventDefault(); fn(el.dataset.v, el); }
});

$app.addEventListener('change', async (e) => {
  const f = e.target.dataset.f;
  if (!f) return;
  const v = e.target.value;
  if (f === 'breath') S.ui.breath = e.target.checked;
  else if (f === 'seat') { const ex = currentEx(); S.exSettings[ex.id] = { ...(S.exSettings[ex.id] || {}), seat: v }; await saveExSettings(ex.id); }
  else if (f === 'note') { S.run.note = v; await saveRun(); }
  else if (f.startsWith('m-')) { const k = f.slice(2); S.form[k] = v; }
  else if (f === 'h-date') S.form.date = v;
  else if (f === 'h-breath') S.form.breath = e.target.checked;
  else if (f === 'startDate' && v) { S.settings.startDate = v; await saveSettings(); render(); }
  else if (f === 'commuteKm') { const n = num(v); if (n != null) { S.settings.commuteKm = n; await saveSettings(); } }
  else if (f === 'import' && e.target.files[0]) doImport(e.target.files[0]);
});

$app.addEventListener('input', (e) => {
  const f = e.target.dataset.f;
  if (f && f.startsWith('m-')) S.form[f.slice(2)] = e.target.value;
});

function render() {
  $app.innerHTML = (S.run && S.screen === 'workout' ? renderWorkout() : renderMain()) + renderOverlay();
  if (S.run && S.screen === 'workout') {
    for (const key of ['rest', 'timer']) if (S.run[key]) updateTimerDom(key, tState(S.run[key]), S.run[key]);
  }
}

// ---------- старт ----------
(async function init() {
  await load();
  const params = new URLSearchParams(location.search);
  const start = params.get('start');
  if (start && SLOT_NAMES[start]) S.preferSlot = start;
  const goTo = params.get('go');
  if (goTo === 'home' || goTo === 'walk') S.form = { preset: goTo === 'walk' ? 'walk' : 'ringfit' };
  S.screen = ['home', 'measure'].includes(goTo) ? goTo : goTo === 'walk' ? 'home' : 'today';
  render();
  db.persist();
  if ('serviceWorker' in navigator && location.hostname !== 'localhost') navigator.serviceWorker.register('./sw.js').catch(() => {});
})();

// для отладки в консоли
window.__S = S;
