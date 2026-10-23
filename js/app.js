import * as db from './db.js';
import * as cy from './cycle.js';
import * as snd from './sound.js';
import * as P from './plan.js';
import * as ST from './stats.js';
import { S, DEFAULT_SETTINGS } from './state.js';
import { suggest, roundToStep } from './progression.js';
import { esc, dec, btn, chip, icon } from './ui.js';
import * as V from './views.js';
import {
  EXERCISES, EX_BY_ID, STRETCHES, poolPlan, CARDIO_MACHINES, STOP_MAIN, STOP_SECONDARY, SYMPTOMS, HOME_KINDS, TABLE_PROMPT,
} from './data.js';

const $app = document.getElementById('app');
const SLOT_NAMES = { A: 'Силовая А', B: 'Силовая Б', cardio: 'Кардио + бассейн', pool: 'Бассейн' };

// ---------- утилиты ----------
const uid = () => (crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`);
const nowISO = () => new Date().toISOString();
const num = (v) => { const n = parseFloat(String(v).replace(',', '.')); return Number.isFinite(n) ? n : undefined; };
const plural = (n, [one, few, many]) => { const a = Math.abs(n) % 100, b = a % 10; if (a > 10 && a < 20) return many; if (b > 1 && b < 5) return few; if (b === 1) return one; return many; };
const minutesWord = (m) => `${m} ${plural(m, ['минута', 'минуты', 'минут'])}`;
const mmss = (sec) => { const s = Math.max(0, Math.ceil(sec)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };
const fmtWeight = (w, unit) => (w == null ? 'Без веса' : `${dec(w)} ${unit === 'plate' ? 'плит.' : 'кг'}`);
const setText = (x) => `${x.weight == null ? '' : `${dec(x.weight)}×`}${x.reps}`;

// ---------- загрузка и сохранение ----------
async function load() {
  const kv = await db.getAll('kv');
  for (const { key, value } of kv) {
    if (key === 'settings') S.settings = { ...DEFAULT_SETTINGS, ...value };
    else if (key === 'plan') S.plan = { days: {}, ...value };
    else if (key === 'health') S.health = value || {};
    else if (key === 'videos') S.videos = value || [];
    else if (key.startsWith('ex:')) S.exSettings[key.slice(3)] = value;
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
const savePlan = () => db.kvSet('plan', S.plan);
const saveHealth = () => db.kvSet('health', S.health);
const saveVideos = () => db.kvSet('videos', S.videos);
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
async function removeActivity(rec) {
  await db.del('activities', rec.id);
  S.activities = S.activities.filter((a) => a.id !== rec.id);
}

// ---------- логика тренировки ----------
const phaseIdx = (p) => cy.PHASE_ORDER.indexOf(p);
const exercisesFor = (slot, phase) => EXERCISES.filter((e) => e.day === slot && phaseIdx(phase) >= phaseIdx(e.fromPhase));
const rangeFor = (ex, phase) => ex.reps || cy.PHASES[phase].reps;
const perSide = (ex) => !!((ex.reps && ex.reps.perSide) || ex.perSide);
const exSet = (ex) => S.exSettings[ex.id] || {};
const unitFor = (ex) => exSet(ex).unit || ex.unit;
const stepFor = (ex) => exSet(ex).weightStep || ex.weightStep;
const loadTypeFor = (ex) => exSet(ex).loadTypeOverride || ex.loadType;
const modeFor = (ex) => (ex.progression === 'repsOnly' && loadTypeFor(ex) === 'dumbbell' ? 'double' : ex.progression);
const hasPool = (r) => r.gymKind !== 'gym';

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
  return null;
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
  let reps = range.max;
  if (sug.kind === 'up') reps = range.min;
  else if (sug.targetReps != null && sug.kind !== 'same') reps = sug.targetReps;
  else if (sug.lastSets[done.length] != null) reps = sug.lastSets[done.length];
  if (prev) reps = prev.reps;
  S.ui = { key, weight: prev ? prev.weight : sug.weight, reps, breath: false, sug };
}

async function startSession(slot, walked, gymKind = 'full') {
  const date = cy.today();
  const week = cy.weekOf(date, S.settings.startDate, S.settings.shifts);
  const phase = cy.trainingPhase(week);
  const r = {
    id: uid(), cycleId: 'c1', slot, day: slot, date, plannedDate: date, week, phase, intro: week === 0, gymKind,
    status: 'in_progress', statusManual: false, checkInAt: nowISO(), sets: [], lightDay: false, aborted: false,
    stage: 'wellbeing', wellbeing: {}, order: slot === 'A' || slot === 'B' ? exercisesFor(slot, phase).map((e) => e.id) : [],
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
const totalSec = (t) => t.segments.reduce((a, s) => a + s.sec, 0);
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
function startTimer(key, kind, segments, extra) {
  S.run[key] = mkTimer(kind, segments, extra);
  if (segments[0].say) snd.announce(segments[0].say, segments[0].beep || 'short');
}

let lastClock = '';
function tick() {
  const clock = V.clockText();
  if (clock !== lastClock) {
    lastClock = clock;
    $app.querySelectorAll('[data-clock]').forEach((el) => { el.textContent = clock; });
  }
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
      if (key === 'rest') r.rest = null;
      if (t.kind === 'stretch') { r.stretchDone = true; r.timer = null; r.stage = 'summary'; }
      changed = true; rerender = true;
    }
    if (S.screen === 'workout') updateTimerDom(key, st, t);
  }
  if (changed) saveRun();
  if (rerender && S.screen === 'workout') render();
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
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') { tick(); if (S.screen !== 'workout') render(); } });

// ---------- экран тренировки ----------
function renderWorkout() {
  const r = S.run;
  const head = `<div class="topbar"><div class="topbar-title">${esc(SLOT_NAMES[r.slot])}<span>${esc(V.weekLabel(r.week, r.phase))}${r.lightDay ? ' · лёгкий день' : ''}</span></div>
    <button class="btn btn-small btn-secondary" data-a="minimize">Свернуть</button>
    ${r.stage !== 'summary' ? '<button class="btn btn-small btn-primary" data-a="end-early">Завершить</button>' : ''}
    <button class="stop-btn" data-a="stop" aria-label="Стоп-сигналы">!</button></div>`;
  const body = {
    wellbeing: renderWellbeing, warmup: renderWarmup, exercises: renderExercises, cardio: renderCardio,
    pool: renderPool, stretch: renderStretch, summary: renderSummary,
  }[r.stage]();
  return head + `<main class="workout">${body}</main>`;
}

function renderWellbeing() {
  const w = S.run.wellbeing;
  const row = (label, field, opts) => `<fieldset><legend>${label}</legend><div class="chips">${opts.map(([v, l]) => chip(l, 'wb', `${field}:${v}`, w[field] === v)).join('')}</div></fieldset>`;
  return `<h2 style="margin-top:14px">Как ты сегодня?</h2>
    ${row('Сон', 'sleep', [['bad', 'Плохо'], ['ok', 'Нормально'], ['good', 'Хорошо']])}
    ${row('Силы', 'energy', [['low', 'Мало'], ['ok', 'Нормально'], ['high', 'Много']])}
    ${row('Давление в глазах или голове', 'pressure', [['no', 'Нет'], ['yes', 'Есть']])}
    ${btn('Дальше', 'wb-next', { cls: 'btn-primary btn-xl' })}`;
}

function renderWarmup() {
  const r = S.run;
  const min = r.slot === 'cardio' ? 5 : 10;
  const t = r.timer && r.timer.kind === 'warmup' ? r.timer : null;
  const next = r.slot === 'cardio' ? 'К кардио' : 'К упражнениям';
  if (!t) return `<h2 style="margin-top:14px">Разминка</h2><p class="lead">${min} мин эллипс или велотренажёр, спокойно.</p>${btn('Старт разминки', 'warmup-start', { cls: 'btn-primary btn-xl' })}${btn('Уже размялась', 'warmup-done')}`;
  if (t.done) return `<h2 style="margin-top:14px">Разминка окончена</h2>${btn(next, 'warmup-done', { cls: 'btn-primary btn-xl' })}`;
  return `<h2 style="margin-top:14px">Разминка</h2>${timerBlock('timer', t)}${btn(t.pausedAt ? 'Продолжить' : 'Пауза', 'timer-pause')}${btn(next, 'warmup-done', { cls: 'btn-primary' })}`;
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
  if (r.order.every((id) => exFinished(id))) {
    return `${renderRest()}<h2 style="margin-top:14px">Упражнения закончены</h2><p>${esc(exerciseSummaryLine())}</p>
      ${btn(hasPool(r) ? 'К бассейну' : 'К растяжке', 'to-pool', { cls: 'btn-primary btn-xl' })}${btn('Список упражнений', 'list')}${undoButton()}`;
  }
  ensureInputs();
  const ex = currentEx();
  const range = rangeFor(ex, r.phase);
  const done = workSets(ex.id);
  const target = setsTarget();
  const unit = unitFor(ex);
  const sug = S.ui.sug;
  const pos = r.order.indexOf(ex.id);
  const planOrder = exercisesFor(r.slot, r.phase).map((e) => e.id);
  const canWarmup = planOrder.indexOf(ex.id) < 2 && !r.sets.some((x) => x.exerciseId === ex.id) && sug.weight != null;
  const isMachine = ex.loadType === 'machine' || ex.loadType === 'cable';
  const hist = historyFor(ex.id).slice(0, 3);
  const showWeight = loadTypeFor(ex) !== 'bodyweight' && sug.kind !== 'bodyweight';
  const bigSug = !showWeight ? `${sug.targetReps ?? range.max} повт.` : sug.kind === 'calibration' && sug.weight == null ? '<span class="big-text">Подбери вес</span>' : esc(fmtWeight(sug.weight, unit));

  return `${renderRest()}
    <p class="sub" style="margin-top:12px">Упражнение ${pos + 1} из ${r.order.length}</p>
    <h2 class="ex-name">${esc(ex.name)}</h2>
    <p class="set-line"><b>Подход ${Math.min(done.length + 1, target)} из ${target}</b> · ${range.min}–${range.max} повторов${perSide(ex) ? ' на сторону' : ''}</p>
    ${ex.eyeNote ? `<p class="eye-note">${esc(ex.eyeNote)}</p>` : ''}
    <section class="suggest"><div class="sub">Подсказка</div><div class="big-num">${bigSug}</div><p>${esc(sug.reason)}</p>
      ${sug.offerDumbbells ? btn('Перейти на гантели', 'to-dumbbells') : ''}</section>
    ${hist.length ? `<section class="history"><div class="sub">В прошлый раз</div>${hist.map((h) => `<p>${cy.fmtShort(h.date)}: ${h.sets.map(setText).join(', ')}${h.sets.some((x) => x.breathHold) ? ' · трудно дышать' : ''}${h.lightDay ? ' · лёгкий день' : ''}</p>`).join('')}</section>` : ''}
    ${done.length ? `<p class="sub">Сегодня: ${done.map((x) => `${setText(x)}${x.breathHold ? ' (трудно дышать)' : ''}`).join(', ')}</p>` : ''}
    ${showWeight ? `<div class="stepper-block"><div class="stepper-label">Вес <button class="btn-link" data-a="unit">${unit === 'plate' ? 'в плитках · сменить на кг' : 'в кг · сменить на плитки'}</button></div>
      <div class="stepper"><button data-a="w-minus" aria-label="Меньше вес">−</button><div class="val">${esc(fmtWeight(S.ui.weight, unit))}</div><button data-a="w-plus" aria-label="Больше вес">+</button></div></div>` : ''}
    <div class="stepper-block"><div class="stepper-label">Повторы${perSide(ex) ? ' (на сторону)' : ''}</div>
      <div class="stepper"><button data-a="r-minus" aria-label="Меньше повторов">−</button><div class="val">${S.ui.reps}</div><button data-a="r-plus" aria-label="Больше повторов">+</button></div></div>
    <label class="check"><input type="checkbox" data-f="breath" ${S.ui.breath ? 'checked' : ''}> Хотелось задержать дыхание / напрягалось лицо</label>
    ${btn('Подход сделан', 'set-done', { cls: 'btn-primary btn-xl' })}
    ${undoButton()}
    ${canWarmup ? btn(`Разминочный подход: 10 × ${esc(fmtWeight(roundToStep(sug.weight / 2, stepFor(ex)), unit))}`, 'warmup-set') : ''}
    ${isMachine ? `<label class="field">Настройка тренажёра<input type="text" data-f="seat" value="${esc(exSet(ex).seat || '')}" placeholder="сиденье 4, валик 2"></label>` : ''}
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
  if (!t) {
    return `<h2 style="margin-top:14px">Кардио ${min} мин</h2><p class="lead">Зона 2: можно говорить короткими фразами. Если тренажёр показывает пульс — ориентир 105–125.</p>
      <fieldset><legend>Тренажёр</legend><div class="chips">${CARDIO_MACHINES.map((m) => chip(m.name, 'machine', m.id, r.cardioMachine === m.id)).join('')}</div></fieldset>
      ${btn('Старт', 'cardio-start', { cls: 'btn-primary btn-xl' })}${btn(hasPool(r) ? 'Без кардио — к бассейну' : 'Без кардио — к растяжке', 'cardio-skip', { cls: 'btn-link' })}`;
  }
  if (t.done || r.cardioEnded) {
    return `<h2 style="margin-top:14px">Кардио окончено</h2><fieldset><legend>Говорить было</legend><div class="chips">${[['easy', 'Легко'], ['phrases', 'Короткими фразами'], ['hard', 'Трудно']].map(([v, l]) => chip(l, 'talk', v, false)).join('')}</div></fieldset>`;
  }
  return `<h2 style="margin-top:14px">Кардио</h2>${timerBlock('timer', t)}${btn(t.pausedAt ? 'Продолжить' : 'Пауза', 'timer-pause', { cls: 'btn-xl btn-secondary' })}${btn('Закончила', 'cardio-end')}`;
}

function renderPool() {
  const r = S.run;
  const plan = poolPlan(r.phase, r.slot === 'pool' ? 'cardio' : r.slot);
  const t = r.timer && r.timer.kind === 'pool' ? r.timer : null;
  if (r.poolAsk || (t && t.done)) {
    return `<h2 style="margin-top:14px">Как прошёл бассейн?</h2><div class="stack">${btn('Сделала план', 'pool-result', { v: 'done', cls: 'btn-primary' })}${btn('Частично', 'pool-result', { v: 'partial' })}${btn('Не плавала', 'pool-result', { v: 'none' })}</div>`;
  }
  if (!t) {
    return `<h2 style="margin-top:14px">Бассейн</h2><p class="big-text">${esc(plan.text)}</p>
      <p>Телефон у бортика, лучше в чехле. В воде — голос и сигналы: высокий двойной — «бодро», низкий — «спокойно». Большая кнопка «Пауза» нажимается мокрой рукой.</p>
      ${btn('Старт таймера', 'pool-start', { cls: 'btn-primary btn-xl' })}${btn('Без таймера', 'pool-ask')}${btn('Не плаваю сегодня', 'pool-result', { v: 'none', cls: 'btn-link' })}`;
  }
  return `${timerBlock('timer', t, { showTotal: true })}<button class="btn btn-pause" data-a="timer-pause">${t.pausedAt ? 'ПРОДОЛЖИТЬ' : 'ПАУЗА'}</button>${btn('Закончила', 'pool-ask')}`;
}

function renderStretch() {
  const r = S.run;
  const t = r.timer && r.timer.kind === 'stretch' ? r.timer : null;
  if (!t) {
    return `<h2 style="margin-top:14px">Растяжка</h2><ol class="list">${STRETCHES.map((s) => `<li><b>${esc(s.name)}</b> — ${esc(s.hint)}</li>`).join('')}</ol>
      ${btn('Начать растяжку', 'stretch-start', { cls: 'btn-primary btn-xl' })}${btn('Пропустить растяжку', 'stretch-skip', { cls: 'btn-link' })}`;
  }
  const st = tState(t);
  const pose = STRETCHES[st.idx];
  return `<p class="sub" style="margin-top:12px">Поза ${st.idx + 1} из ${STRETCHES.length}</p><h2>${esc(pose.name)}</h2><p class="lead">${esc(pose.hint)}</p>
    ${timerBlock('timer', t)}<div class="row2">${btn(t.pausedAt ? 'Продолжить' : 'Пауза', 'timer-pause')}${btn('Дальше', 'timer-next', { cls: 'btn-primary' })}</div>`;
}

function autoStatus(r) {
  if (r.aborted) return 'partial';
  if (r.slot === 'pool') return r.pool && r.pool.result !== 'none' ? 'done' : 'partial';
  if (r.slot === 'cardio') return r.cardio && (!hasPool(r) || (r.pool && r.pool.result !== 'none')) ? 'done' : 'partial';
  return r.order.every((id) => exComplete(id)) ? 'done' : 'partial';
}

function renderSummary() {
  const r = S.run;
  const minutes = Math.round((Date.now() - new Date(r.checkInAt).getTime()) / 60000);
  const lines = [];
  for (const id of r.order) {
    const ex = EX_BY_ID[id];
    const sets = workSets(id);
    if (!sets.length) { lines.push(`<li>${esc(ex.name)}: ${r.skipped.includes(id) ? 'пропущено' : 'не сделано'}</li>`); continue; }
    const prev = historyFor(id)[0];
    const prevW = prev ? Math.max(...prev.sets.map((x) => x.weight ?? 0)) : null;
    const nowW = Math.max(...sets.map((x) => x.weight ?? 0));
    const grew = prev && nowW > prevW ? ` · вес вырос: ${dec(prevW)} → ${dec(nowW)}` : '';
    const hard = sets.some((x) => x.breathHold) ? ' · было трудно дышать' : '';
    lines.push(`<li>${esc(ex.name)}: ${sets.map(setText).join(', ')}${grew}${hard}</li>`);
  }
  if (r.cardio) lines.push(`<li>Кардио: ${r.cardio.minutes} мин${r.cardio.talkTest === 'hard' ? ' · было трудно говорить — в следующий раз снизь сопротивление' : ''}</li>`);
  if (r.pool) lines.push(`<li>Бассейн: ${{ done: 'план сделан', partial: 'частично', none: 'не плавала' }[r.pool.result]}${r.pool.minutes ? `, ${r.pool.minutes} мин` : ''}</li>`);
  lines.push(`<li>Растяжка: ${r.stretchDone ? 'сделана' : 'пропущена'}</li>`);
  if (!r.summaryStatus) r.summaryStatus = autoStatus(r);
  const back = S.activities.some((a) => a.sessionId === r.id && a.commute === 'from');
  return `<h2 style="margin-top:14px">Итог</h2><p>Визит: ${minutes} мин${r.aborted ? ' · прервана по стоп-сигналу' : ''}${r.lightDay ? ' · лёгкий день' : ''}</p>
    <ul class="list">${lines.join('')}</ul>
    <fieldset><legend>Статус визита</legend><div class="chips">${chip('Сделано', 'sum-status', 'done', r.summaryStatus === 'done')}${chip('Частично', 'sum-status', 'partial', r.summaryStatus === 'partial')}</div></fieldset>
    <fieldset><legend>Обратно пешком (~${dec(S.settings.commuteKm)} км)?</legend><div class="chips">${chip('Да', 'walk-back', 'yes', back)}${chip('Нет', 'walk-back', 'no', false)}</div></fieldset>
    <label class="field">Заметка<textarea data-f="note" rows="3">${esc(r.note || '')}</textarea></label>
    ${btn('Завершить тренировку', 'finish', { cls: 'btn-primary btn-xl' })}${r.order.length ? btn('Вернуться к упражнениям', 'stage', { v: 'exercises', cls: 'btn-link' }) : ''}
    ${btn('Не засчитывать — удалить эту тренировку', 'discard-run', { cls: 'btn-link danger-link' })}`;
}

// ---------- формы ----------
function backHeader(title) {
  return `<header class="page-title"><button class="icon-btn" data-a="go" data-v="back" aria-label="Назад">${icon('back')}</button><h1>${esc(title)}</h1></header>`;
}

function renderMeasure() {
  if (S.form.kind !== 'measure') S.form = { kind: 'measure', pm: undefined, date: cy.today() };
  const f = S.form;
  if (f.pm === undefined) {
    return `${backHeader('Замер')}<section class="card"><p class="lead">Сейчас предменструальные дни?</p><div class="row2">${btn('Нет', 'pm', { v: 'no', cls: 'btn-primary' })}${btn('Да', 'pm', { v: 'yes' })}</div></section>`;
  }
  if (f.pm === 'yes' && !f.pmConfirmed) {
    return `${backHeader('Замер')}<section class="card"><p class="lead">Цифры в эти дни непоказательные: лучше перенести замер на 3–5 дней.</p>${btn('Перенести', 'go', { v: 'back', cls: 'btn-primary' })}${btn('Всё равно записать', 'pm-confirm')}</section>`;
  }
  const field = (key, label) => `<label class="field">${label}<input type="text" inputmode="decimal" data-f="m-${key}" value="${esc(f[key] ?? '')}"></label>`;
  return `${backHeader('Замер')}<section class="card"><p class="sub">Утром, натощак, после туалета.</p>
    <label class="field">Дата<input type="date" data-f="m-date" value="${esc(f.date)}"></label>
    ${field('weightKg', 'Вес, кг')}${field('waistCm', 'Талия, см')}${field('bellyNavelCm', 'Живот по пупку, см')}${field('hipsCm', 'Бёдра, см')}${field('thighCm', 'Бедро, см')}
    <p class="note">Фото пока снимай камерой телефона: спереди, сбоку, сзади — тот же свет, то же место, та же одежда.</p>
    ${btn('Сохранить замер', 'measure-save', { cls: 'btn-primary btn-xl' })}</section>`;
}

function renderHomeLog() {
  if (S.form.kind !== 'home') S.form = { kind: 'home', type: S.form.preset || 'walk', minutes: null, km: 5, date: S.form.date || cy.today(), feel: null, breath: false };
  const f = S.form;
  const k = HOME_KINDS.find((x) => x.id === f.type);
  const minutes = f.minutes ?? (f.type === 'walk' ? 75 : k.minutes);
  return `${backHeader('Активность')}<section class="card">
    <fieldset><legend>Что</legend><div class="chips">${HOME_KINDS.map((x) => chip(x.name, 'h-type', x.id, f.type === x.id)).join('')}</div></fieldset>
    ${k.safety ? `<p class="eye-note">${esc(k.safety)}</p>` : ''}
    <div class="stepper-block"><div class="stepper-label">Минуты</div><div class="stepper"><button data-a="h-min" data-v="-5" aria-label="Меньше минут">−</button><div class="val">${minutes}</div><button data-a="h-min" data-v="5" aria-label="Больше минут">+</button></div></div>
    ${f.type === 'walk' ? `<div class="stepper-block"><div class="stepper-label">Километры</div><div class="stepper"><button data-a="h-km" data-v="-0.5" aria-label="Меньше">−</button><div class="val">${dec(f.km)}</div><button data-a="h-km" data-v="0.5" aria-label="Больше">+</button></div></div>` : `
    <fieldset><legend>Как прошло</legend><div class="chips">${[['easy', 'Легко'], ['ok', 'Нормально'], ['hard', 'Тяжело']].map(([v, l]) => chip(l, 'h-feel', v, f.feel === v)).join('')}</div></fieldset>
    <label class="check"><input type="checkbox" data-f="h-breath" ${f.breath ? 'checked' : ''}> Хотелось задержать дыхание / напрягалось лицо</label>`}
    <label class="field">Дата<input type="date" data-f="h-date" value="${esc(f.date)}" min="${cy.addDays(cy.today(), -7)}" max="${cy.today()}"></label>
    ${btn('Сохранить', 'home-save', { cls: 'btn-primary btn-xl' })}</section>`;
}

// ---------- оверлеи ----------
function renderOverlay() {
  const o = S.overlay;
  if (!o) return '';
  let inner = '';
  if (o.type === 'day') inner = V.renderDaySheet(o.date);
  else if (o.type === 'move') inner = V.renderMoveSheet(o.date);
  else if (o.type === 'cancel') inner = V.renderCancelSheet(o.date);
  else if (o.type === 'video') inner = V.renderVideoSheet(o.id);
  else if (o.type === 'act') {
    const name = { walk: 'Прогулка', ringfit: 'Ring Fit', circuit: 'Видео-тренировка', yoga: 'Йога', video: 'Видео-тренировка', other: 'Активность' }[o.kind] || 'Активность';
    inner = `<div class="sheet-head"><h2>${esc(name)} · ${esc(cy.fmtDate(o.date))}</h2><button class="icon-btn" data-a="act-back" aria-label="Закрыть">${icon('x')}</button></div>
      ${['circuit', 'yoga'].includes(o.kind) ? `<div class="chips">${chip('Видео', 'act-kind', 'circuit', o.kind === 'circuit')}${chip('Йога', 'act-kind', 'yoga', o.kind === 'yoga')}</div>` : ''}
      <div class="stepper-block"><div class="stepper-label">Минуты</div><div class="stepper"><button data-a="act-min" data-v="-5" aria-label="Меньше минут">−</button><input class="val" type="text" inputmode="numeric" data-f="act-minutes" value="${o.minutes}"><button data-a="act-min" data-v="5" aria-label="Больше минут">+</button></div></div>
      ${o.kind === 'walk' ? `<div class="stepper-block"><div class="stepper-label">Километры</div><div class="stepper"><button data-a="act-km" data-v="-0.5" aria-label="Меньше км">−</button><input class="val" type="text" inputmode="decimal" data-f="act-kmval" value="${dec(o.km)}"><button data-a="act-km" data-v="0.5" aria-label="Больше км">+</button></div></div>` : ''}
      ${btn('Сохранить', 'act-save', { cls: 'btn-primary btn-xl' })}
      ${o.id ? btn('Убрать отметку', 'act-del', { cls: 'btn-link danger-link' }) : btn('Отмена', 'act-back', { cls: 'btn-link' })}`;
  }
  else if (o.type === 'videoPick') inner = V.renderVideoPick(o.date, o.kind);
  else if (o.type === 'weight') {
    inner = `<div class="sheet-head"><h2>Вес сегодня</h2><button class="icon-btn" data-a="close" aria-label="Закрыть">${icon('x')}</button></div>
      <p class="sub">Утром, натощак. В графике считается средняя за неделю.</p>
      <div class="stepper"><button data-a="wt" data-v="-0.1" aria-label="Меньше">−</button><div class="val">${dec(o.value)} кг</div><button data-a="wt" data-v="0.1" aria-label="Больше">+</button></div>
      <div class="row2">${btn('−1 кг', 'wt', { v: '-1' })}${btn('+1 кг', 'wt', { v: '1' })}</div>
      <label class="check"><input type="checkbox" data-f="wt-pm" ${o.pm ? 'checked' : ''}> Предменструальные дни</label>
      ${btn('Сохранить', 'wt-save', { cls: 'btn-primary btn-xl' })}`;
  } else if (o.type === 'stop') {
    inner = `<h2 class="danger-text">Стоп-сигналы</h2><p class="lead"><b>Прекратить тренировку и в тот же день к офтальмологу, если:</b></p><ul class="list big-list">${STOP_MAIN.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>
      <p>${esc(STOP_SECONDARY)}</p><fieldset><legend>Что было (необязательно)</legend><div class="chips">${SYMPTOMS.map((x) => chip(x.name, 'symptom', x.id, (o.symptoms || []).includes(x.id))).join('')}</div></fieldset>
      ${btn('Завершить тренировку', 'stop-finish', { cls: 'btn-danger' })}${btn('Снизить нагрузку и продолжить', 'stop-lighter')}${btn('Закрыть', 'close')}`;
  } else if (o.type === 'pressure') {
    inner = `<h2>Давление в глазах или голове</h2><p>Если есть вспышки, мушки, тень или шторка — тренировку не начинать и в тот же день к офтальмологу.</p><p>Если просто давление — сегодня лёгкий день: на подход меньше и вес на шаг ниже. Если усилится — закончить.</p>
      ${btn('Лёгкий день', 'light', { v: 'yes', cls: 'btn-primary' })}${btn('Не тренироваться сегодня', 'abort-start', { cls: 'btn-danger' })}`;
  } else if (o.type === 'light') {
    inner = `<h2>Лёгкий день?</h2><p>На подход меньше, вес на шаг ниже. Такая тренировка не влияет на подсказки весов.</p>${btn('Да, лёгкий день', 'light', { v: 'yes', cls: 'btn-primary' })}${btn('Нет, как обычно', 'light', { v: 'no' })}`;
  } else if (o.type === 'walked') {
    inner = `<h2>Пришла пешком?</h2><p>Засчитаю прогулку ~${dec(S.settings.commuteKm)} км.</p><div class="row2">${btn('Да', 'walked', { v: 'yes', cls: 'btn-primary' })}${btn('Нет', 'walked', { v: 'no' })}</div>${o.warn ? `<p class="note">${esc(o.warn)}</p>` : ''}${btn('Отмена', 'close', { cls: 'btn-link' })}`;
  } else if (o.type === 'list') {
    const r = S.run;
    inner = `<h2>Упражнения</h2><div class="stack">${r.order.map((id, i) => {
      const n = workSets(id).length;
      const mark = r.skipped.includes(id) ? 'пропущено' : exComplete(id) ? `✓ ${n}/${setsTarget()}` : `${n}/${setsTarget()}`;
      return `<button class="row-btn" data-a="goto-ex" data-v="${i}" ${i === r.current ? 'aria-current="true"' : ''}><b>${i + 1}. ${esc(EX_BY_ID[id].name)}</b><span>${mark}</span></button>`;
    }).join('')}</div>${btn('Закрыть', 'close')}`;
  } else if (o.type === 'tech') {
    const ex = currentEx();
    inner = `<h2>${esc(ex.name)}</h2>${ex.eyeNote ? `<p class="eye-note">${esc(ex.eyeNote)}</p>` : ''}
      <h3>Исходное</h3><p>${esc(ex.setup)}</p><h3>Движение</h3><p>${esc(ex.movement)}</p><h3>Ошибки</h3><p>${esc(ex.mistakes)}</p>
      <p>Выдох на усилии. Темп 2 с на усилие, 2–3 с на возврат. Взгляд прямо.</p>
      <a class="btn btn-secondary" href="https://www.youtube.com/results?search_query=${encodeURIComponent(`${ex.nameEn} technique`)}" target="_blank" rel="noopener">Видео на YouTube</a>${btn('Закрыть', 'close')}`;
  }
  return `<div class="overlay" data-a="overlay-bg"><div class="sheet" role="dialog" aria-modal="true">${inner}</div></div>`;
}

// ---------- навигация ----------
const TABS = [['home', 'Главная', 'home'], ['calendar', 'План', 'calendar'], ['goals', 'Цели', 'chart']];
let prevScreen = 'home';
function go(screen) {
  if (screen === 'back') screen = prevScreen || 'home';
  else if (['home', 'calendar', 'goals'].includes(S.screen)) prevScreen = S.screen;
  S.screen = screen;
  S.overlay = null;
  if (!['measure', 'homeLog', 'videoForm', 'videoImport'].includes(screen)) S.form = {};
  window.scrollTo(0, 0);
  render();
}

function renderMain() {
  const screens = {
    home: V.renderHome, calendar: V.renderCalendar, goals: V.renderGoals, settings: V.renderSettings, measure: renderMeasure, homeLog: renderHomeLog,
    videos: V.renderVideos, videoForm: V.renderVideoForm, videoImport: V.renderVideoImport,
  };
  const body = (screens[S.screen] || V.renderHome)();
  const active = TABS.some(([id]) => id === S.screen) ? S.screen : prevScreen;
  return `<main class="page">${body}</main><nav class="bottom-nav">${TABS.map(([id, l, ic]) => `<button data-a="tab" data-v="${id}" ${active === id ? 'aria-current="page"' : ''}>${icon(ic, { size: 24 })}${l}</button>`).join('')}</nav>`;
}

// ---------- действия ----------
const refresh = () => render();
const splitV = (v) => { const i = v.indexOf('|'); return [v.slice(0, i), v.slice(i + 1)]; };

const A = {
  tab: (v) => { prevScreen = v; go(v); },
  go: (v) => {
    if (v === 'measure') S.form = {};
    go(v);
  },
  close: () => { S.overlay = null; render(); },
  'overlay-bg': (v, el, e) => { if (e.target === el) A.close(); },
  day: (v) => { S.overlay = { type: 'day', date: v }; render(); },

  // план дня
  'day-type': async (v) => { const [d, type] = splitV(v); P.setDay(d, S.plan, { type }); await savePlan(); refresh(); },
  'gym-kind': async (v) => { const [d, k] = splitV(v); P.setDay(d, S.plan, { gymKind: k }); await savePlan(); refresh(); },
  'day-move': (v) => { S.overlay = { type: 'move', date: v }; render(); },
  'move-to': async (v) => { const [a, b] = splitV(v); P.swapDays(a, b, S.plan); await savePlan(); S.overlay = { type: 'day', date: b }; render(); },
  'day-cancel': (v) => { S.overlay = { type: 'cancel', date: v }; render(); },
  'cancel-reason': async (v) => { const [d, reason] = splitV(v); P.setDay(d, S.plan, { cancelled: reason }); await savePlan(); S.overlay = { type: 'day', date: d }; render(); },
  'day-restore': async (v) => { P.setDay(v, S.plan, { cancelled: null }); await savePlan(); refresh(); },
  cls: async (v) => {
    const [d, id] = splitV(v);
    const cur = P.effective(d, S.plan).classId;
    P.setDay(d, S.plan, { classId: cur === id ? null : id });
    await savePlan(); refresh();
  },
  'cls-done': async (v) => {
    const [d, id] = splitV(v);
    const ex = S.activities.find((a) => a.date === d && a.kind === 'class' && a.classId === id);
    if (ex) await removeActivity(ex);
    else await addActivity({ kind: 'class', classId: id, date: d, minutes: P.CLASS_MIN });
    refresh();
  },
  // отметка активности: окошко с минутами и км
  'h-toggle': (v) => {
    const [d, kind] = splitV(v);
    const group = ['circuit', 'yoga', 'video'].includes(kind) ? ['circuit', 'yoga', 'video'] : [kind];
    const ex = S.activities.find((a) => a.date === d && group.includes(a.kind) && !a.commute);
    const item = P.HOME_ITEMS.find((i) => i.kind === kind) || P.HOME_ITEMS.find((i) => i.kind === 'video');
    S.overlay = {
      type: 'act', date: d, kind: ex ? ex.kind : kind, id: ex ? ex.id : null,
      minutes: ex ? ex.minutes ?? item.min : item.min, km: ex ? ex.distanceKm ?? item.km : item.km,
      back: S.overlay && S.overlay.type === 'day' ? S.overlay.date : null,
    };
    render();
  },
  'act-min': (v) => { S.overlay.minutes = Math.max(5, (S.overlay.minutes || 0) + Number(v)); render(); },
  'act-km': (v) => { S.overlay.km = Math.max(0, +((S.overlay.km || 0) + Number(v)).toFixed(1)); render(); },
  'act-save': async () => {
    const o = S.overlay;
    const rec = { kind: o.kind, date: o.date, minutes: o.minutes, distanceKm: o.kind === 'walk' ? o.km : undefined };
    if (o.id) {
      const ex = S.activities.find((a) => a.id === o.id);
      Object.assign(ex, rec);
      await db.put('activities', ex);
    } else await addActivity(rec);
    S.overlay = o.back ? { type: 'day', date: o.back } : null;
    refresh();
  },
  'act-del': async () => {
    const o = S.overlay;
    const ex = S.activities.find((a) => a.id === o.id);
    if (ex) await removeActivity(ex);
    S.overlay = o.back ? { type: 'day', date: o.back } : null;
    refresh();
  },
  'act-kind': (v) => { S.overlay.kind = v; render(); },
  'act-back': () => { const o = S.overlay; S.overlay = o.back ? { type: 'day', date: o.back } : null; render(); },
  'gym-start': (v) => {
    const d = P.effective(v, S.plan);
    const slot = P.slotFor(v, S.plan, S.settings.startDate) || 'A';
    A.checkin(slot, d.gymKind);
  },
  checkin: (slot, gymKind = 'full') => {
    let warn = '';
    if (slot === 'A' || slot === 'B') {
      const last = S.sessions.filter((s) => (s.slot === 'A' || s.slot === 'B') && !s.retro).sort((a, b) => b.checkInAt.localeCompare(a.checkInAt))[0];
      if (last && Date.now() - new Date(last.checkInAt).getTime() < 48 * 3600 * 1000) warn = 'Между силовыми лучше 48 часов.';
    }
    S.overlay = { type: 'walked', slot, gymKind, warn }; render();
  },
  'gym-retro': async (v) => {
    const sess = S.sessions.find((s) => s.date === v && s.retro);
    if (sess) { await db.del('sessions', sess.id); S.sessions = S.sessions.filter((s) => s !== sess); return refresh(); }
    const slot = P.slotFor(v, S.plan, S.settings.startDate) || 'A';
    const week = cy.weekOf(v, S.settings.startDate);
    const rec = { id: uid(), cycleId: 'c1', slot, day: slot, date: v, plannedDate: v, week, phase: cy.trainingPhase(week), status: 'done', retro: true, checkInAt: `${v}T12:00:00`, sets: [], gymKind: P.effective(v, S.plan).gymKind };
    await db.put('sessions', rec); S.sessions.push(rec); refresh();
  },
  'km-edit': async (v) => {
    const cur = dec(ST.dayKm(v));
    const val = prompt('Сколько км прошла за день?', cur);
    if (val == null) return;
    const n = num(val);
    if (n == null) return;
    S.health[v] = { ...(S.health[v] || {}), km: n, steps: Math.round(n * ST.STEPS_PER_KM), source: 'manual' };
    await saveHealth(); refresh();
  },
  'health-paste': async () => {
    let text = '';
    try { text = await navigator.clipboard.readText(); } catch (e) { /* нет доступа к буферу */ }
    if (!text || !/\d{4}-\d{2}-\d{2}/.test(text)) text = prompt('Вставь строку из Команды «Тренировки: шаги»') || '';
    const parsed = ST.parseHealth(text);
    const dates = Object.keys(parsed);
    if (!dates.length) { alert('Не нашла данных о шагах. Ожидаю строку вида TR;2026-10-23;8123;5,4'); return; }
    for (const d of dates) if (!(S.health[d] && S.health[d].source === 'manual')) S.health[d] = parsed[d];
    await saveHealth();
    alert(`Шаги загружены: ${dates.map((d) => `${cy.fmtShort(d)} — ${(parsed[d].steps || 0).toLocaleString('ru-RU')}`).join(', ')}`);
    refresh();
  },

  // библиотека видео
  'video-new': () => { S.form = { kind: 'video', vkind: 'circuit', minutes: 30, checks: {} }; S.screen = 'videoForm'; S.overlay = null; render(); },
  'video-edit': (id) => {
    const v = S.videos.find((x) => x.id === id);
    S.form = { kind: 'video', id, url: v.url, title: v.title, vkind: v.kind, minutes: v.minutes, checks: { ...(v.checks || {}) }, skipNotes: v.skipNotes || '', exText: (v.exercises || []).map((e) => [e.name, e.dose, e.tech].filter(Boolean).join(' — ')).join('\n') };
    S.screen = 'videoForm'; S.overlay = null; render();
  },
  'v-kind': (v) => { S.form.vkind = v; render(); },
  'v-min': (v) => { S.form.minutes = Math.max(5, (S.form.minutes || 30) + Number(v)); render(); },
  'video-save': async () => {
    const f = S.form;
    const exercises = String(f.exText || '').split(/\r?\n/).map((l) => l.trim()).filter(Boolean).map((l) => { const [name, dose = '', ...tech] = l.split(/\s+—\s+|\s+-\s+/); return { name, dose, tech: tech.join(' — ') }; });
    const tgPost = String(f.url || '').match(/\/(\d+)\s*$/);
    const rec = {
      id: f.id || uid(), url: (f.url || '').trim(), title: (f.title || '').trim() || (tgPost ? `Видео ${tgPost[1]}` : 'Видео'),
      kind: f.vkind || 'circuit', minutes: f.minutes || 30, checks: f.checks || {}, skipNotes: f.skipNotes || '', exercises,
      order: (S.videos.find((x) => x.id === f.id) || {}).order, addedAt: (S.videos.find((x) => x.id === f.id) || {}).addedAt || nowISO(),
    };
    S.videos = S.videos.filter((x) => x.id !== rec.id).concat(rec);
    await saveVideos();
    S.form = {}; S.screen = 'videos'; S.overlay = { type: 'video', id: rec.id }; render();
  },
  'video-del': async (id) => { if (!confirm('Удалить видео из библиотеки?')) return; S.videos = S.videos.filter((x) => x.id !== id); await saveVideos(); S.overlay = null; render(); },
  'video-open': (id) => { S.overlay = { type: 'video', id }; render(); },
  'video-pick': (v) => { const [date, kind] = splitV(v); S.overlay = { type: 'videoPick', date, kind }; render(); },
  'video-done': async (v) => {
    const [date, id] = splitV(v);
    const vid = S.videos.find((x) => x.id === id);
    const old = S.activities.find((a) => a.date === date && ['circuit', 'yoga', 'video'].includes(a.kind));
    if (old) await removeActivity(old);
    await addActivity({ kind: vid.kind === 'yoga' ? 'yoga' : 'circuit', date, minutes: vid.minutes, videoId: id });
    S.overlay = null; refresh();
  },
  'copy-prompt': async () => {
    try { await navigator.clipboard.writeText(TABLE_PROMPT); alert('Задание скопировано.'); } catch (e) { prompt('Скопируй задание:', TABLE_PROMPT); }
  },
  'video-import': async () => {
    const items = V.parseVideoTable(S.form.text || '', (S.form.source ?? 'Модельная фигура').trim());
    if (!items.length) { alert('Не нашла строк. Формат: День;Упражнение;Подходы;Техника;Ссылка'); return; }
    const risky = items.filter((it) => V.videoRisks(it).length).length;
    if (!confirm(`Добавить ${items.length} видео (${items.reduce((t, it) => t + it.exercises.length, 0)} упражнений)? Опасные упражнения найдены в ${risky} из них — замены будут в карточках.`)) return;
    for (const it of items) {
      const same = S.videos.find((x) => x.title === it.title);
      const rec = { id: same ? same.id : uid(), kind: 'circuit', minutes: 30, checks: {}, skipNotes: same ? same.skipNotes : '', addedAt: nowISO(), ...it };
      S.videos = S.videos.filter((x) => x.id !== rec.id).concat(rec);
    }
    await saveVideos();
    S.form = {}; go('videos');
  },

  // вес
  'weight-open': () => {
    const w = ST.weights();
    S.overlay = { type: 'weight', value: w.length ? w[w.length - 1].weightKg : 68, pm: false };
    render();
  },
  wt: (v) => { S.overlay.value = Math.max(30, +(S.overlay.value + Number(v)).toFixed(1)); render(); },
  'wt-save': async () => {
    const rec = { id: uid(), cycleId: 'c1', date: cy.today(), at: nowISO(), checkpoint: null, weightKg: S.overlay.value, premenstrual: !!S.overlay.pm };
    await db.put('measurements', rec); S.measurements.push(rec); S.overlay = null; refresh();
  },
  'del-measure': async (v) => { if (!confirm('Удалить запись?')) return; await db.del('measurements', v); S.measurements = S.measurements.filter((m) => m.id !== v); refresh(); },

  'cal-mode': (v) => { S.cal.mode = v; render(); },
  'cal-nav': (v) => { if (S.cal.mode === 'week') S.cal.week += Number(v); else S.cal.month += Number(v); render(); },

  // тренировка
  walked: (v) => { snd.unlock(); const { slot, gymKind } = S.overlay; S.overlay = null; S.preferSlot = null; startSession(slot, v === 'yes', gymKind); },
  resume: () => { snd.unlock(); snd.keepAwake(true); S.overlay = null; S.screen = 'workout'; render(); },
  minimize: () => { snd.keepAwake(false); S.screen = 'home'; render(); },
  stop: () => { S.overlay = { type: 'stop', symptoms: [] }; render(); },
  'discard-run': async () => {
    if (!confirm('Удалить эту тренировку? Она не попадёт в историю и не засчитается.')) return;
    const r = S.run;
    for (const a of S.activities.filter((x) => x.sessionId === r.id)) await removeActivity(a);
    await db.del('sessions', r.id);
    S.run = null;
    snd.keepAwake(false);
    go('home');
  },
  'end-early': async () => {
    const r = S.run;
    if (!confirm('Завершить тренировку? Сделанные подходы сохранятся.')) return;
    r.rest = null; r.timer = null; r.stage = 'summary'; r.summaryStatus = null;
    await saveRun(); window.scrollTo(0, 0); render();
  },
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
    else S.run.stage = S.run.slot === 'pool' ? 'pool' : 'warmup';
    await saveRun(); render();
  },
  light: async (v) => { S.run.lightDay = v === 'yes'; S.run.stage = S.run.slot === 'pool' ? 'pool' : 'warmup'; S.overlay = null; S.ui = {}; await saveRun(); render(); },
  'abort-start': async () => { const r = S.run; r.aborted = true; r.status = 'skip'; r.finishedAt = nowISO(); r.note = 'Не начата: давление в глазах или голове'; S.overlay = null; await finalizeRun(); snd.keepAwake(false); go('home'); },

  'warmup-start': async () => { startTimer('timer', 'warmup', [{ label: 'Разминка', sec: (S.run.slot === 'cardio' ? 5 : 10) * 60, half: true }], { endSay: 'Разминка окончена' }); await saveRun(); render(); },
  'warmup-done': async () => { S.run.timer = null; S.run.stage = S.run.slot === 'cardio' ? 'cardio' : 'exercises'; await saveRun(); render(); },
  'timer-pause': async () => { const t = S.run.timer; if (!t) return; if (t.pausedAt) { t.pausedMs += Date.now() - t.pausedAt; t.pausedAt = null; } else t.pausedAt = Date.now(); await saveRun(); render(); },
  'timer-next': () => { const t = S.run.timer; if (!t) return; t.skipSec += tState(t).segRem + 0.01; tick(); render(); },

  'w-minus': () => { const step = stepFor(currentEx()); const w = S.ui.weight; S.ui.weight = w == null || w - step <= 0 ? null : roundToStep(w - step, step); render(); },
  'w-plus': () => { const step = stepFor(currentEx()); S.ui.weight = roundToStep((S.ui.weight ?? 0) + step, step); render(); },
  'r-minus': () => { S.ui.reps = Math.max(1, S.ui.reps - 1); render(); },
  'r-plus': () => { S.ui.reps += 1; render(); },
  unit: async () => { const ex = currentEx(); S.exSettings[ex.id] = { ...exSet(ex), unit: unitFor(ex) === 'plate' ? 'kg' : 'plate' }; await saveExSettings(ex.id); render(); },
  'to-dumbbells': async () => { const ex = currentEx(); S.exSettings[ex.id] = { ...exSet(ex), loadTypeOverride: 'dumbbell' }; await saveExSettings(ex.id); S.ui = {}; render(); },
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
    r.stage = 'exercises';
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
  'to-pool': async () => { S.run.rest = null; S.run.stage = hasPool(S.run) ? 'pool' : 'stretch'; await saveRun(); render(); },

  machine: (v) => { S.run.cardioMachine = v; render(); },
  'cardio-start': async () => {
    snd.unlock();
    const min = cy.PHASES[S.run.phase].cardioMin;
    S.run.cardioMachine = S.run.cardioMachine || 'elliptical';
    startTimer('timer', 'cardio', [{ label: 'Кардио, зона 2', sec: min * 60, half: true, say: `Кардио ${minutesWord(min)}. Можно говорить короткими фразами` }], { endSay: 'Кардио окончено' });
    await saveRun(); render();
  },
  'cardio-end': async () => { S.run.cardioEnded = true; await saveRun(); render(); },
  'cardio-skip': async () => { S.run.timer = null; S.run.stage = hasPool(S.run) ? 'pool' : 'stretch'; await saveRun(); render(); },
  talk: async (v) => {
    const r = S.run;
    const t = r.timer;
    const minutes = t ? Math.round(Math.min(tState(t).el, totalSec(t)) / 60) : 0;
    r.cardio = { minutes, machine: r.cardioMachine, talkTest: v };
    r.timer = null; r.cardioEnded = false; r.stage = hasPool(r) ? 'pool' : 'stretch';
    await saveRun(); render();
  },

  'pool-start': async () => {
    snd.unlock();
    const plan = poolPlan(S.run.phase, S.run.slot === 'pool' ? 'cardio' : S.run.slot);
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
    if (v === 'no' && existing) await removeActivity(existing);
    render();
  },
  finish: async () => {
    const r = S.run;
    r.status = r.summaryStatus || autoStatus(r);
    r.finishedAt = nowISO();
    delete r.summaryStatus;
    await finalizeRun();
    snd.keepAwake(false);
    go('home');
  },

  // формы
  pm: (v) => { S.form.pm = v; render(); },
  'pm-confirm': () => { S.form.pmConfirmed = true; render(); },
  'measure-save': async () => {
    const f = S.form;
    const rec = { id: uid(), cycleId: 'c1', date: f.date, at: nowISO(), checkpoint: cy.checkpointNear(f.date, S.settings.startDate), premenstrual: f.pm === 'yes' };
    for (const k of ['weightKg', 'waistCm', 'bellyNavelCm', 'hipsCm', 'thighCm']) { const n = num(f[k]); if (n != null) rec[k] = n; }
    await db.put('measurements', rec);
    S.measurements.push(rec);
    go('back');
  },
  'h-type': (v) => { S.form.type = v; S.form.minutes = null; render(); },
  'h-min': (v) => { const k = HOME_KINDS.find((x) => x.id === S.form.type); S.form.minutes = Math.max(5, (S.form.minutes ?? (S.form.type === 'walk' ? 75 : k.minutes)) + Number(v)); render(); },
  'h-km': (v) => { S.form.km = Math.max(0.5, +(S.form.km + Number(v)).toFixed(1)); render(); },
  'h-feel': (v) => { S.form.feel = v; render(); },
  'home-save': async () => {
    const f = S.form;
    const k = HOME_KINDS.find((x) => x.id === f.type);
    await addActivity({ kind: f.type, date: f.date, minutes: f.minutes ?? (f.type === 'walk' ? 75 : k.minutes), distanceKm: f.type === 'walk' ? f.km : undefined, feel: f.feel || undefined, breathHold: f.breath || undefined });
    go('back');
  },

  // настройки
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
    if (!confirm(`Загрузить копию от ${data.exportedAt ? data.exportedAt.slice(0, 10) : '?'}: ${count('sessions')} тренировок, ${count('measurements')} замеров, ${count('activities')} активностей? Текущие данные будут заменены.`)) return;
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
  if (!fn) return;
  if (el.dataset.a === 'overlay-bg') { fn(el.dataset.v, el, e); return; }
  e.preventDefault();
  fn(el.dataset.v, el, e);
});

$app.addEventListener('change', async (e) => {
  const f = e.target.dataset.f;
  if (!f) return;
  const v = e.target.value;
  if (f === 'breath') S.ui.breath = e.target.checked;
  else if (f === 'seat') { const ex = currentEx(); S.exSettings[ex.id] = { ...exSet(ex), seat: v }; await saveExSettings(ex.id); }
  else if (f === 'note') { S.run.note = v; await saveRun(); }
  else if (f.startsWith('m-')) S.form[f.slice(2)] = v;
  else if (f === 'h-date') S.form.date = v;
  else if (f === 'h-breath') S.form.breath = e.target.checked;
  else if (f === 'wt-pm') S.overlay.pm = e.target.checked;
  else if (f === 'v-check') { S.form.checks = { ...(S.form.checks || {}), [e.target.dataset.k]: e.target.checked }; }
  else if (f === 'v-ex') { S.form.exText = v; render(); }
  else if (['v-url', 'v-title', 'v-notes', 'imp-text', 'imp-source'].includes(f)) S.form[{ 'v-url': 'url', 'v-title': 'title', 'v-notes': 'skipNotes', 'imp-text': 'text', 'imp-source': 'source' }[f]] = v;
  else if (f === 'startDate' && v) { S.settings.startDate = v; await saveSettings(); render(); }
  else if (f === 'commuteKm' || f === 'goalLossKg') { const n = num(v); if (n != null) { S.settings[f] = n; await saveSettings(); } }
  else if (f === 'import' && e.target.files[0]) doImport(e.target.files[0]);
});

$app.addEventListener('input', (e) => {
  const f = e.target.dataset.f;
  if (f && f.startsWith('m-')) S.form[f.slice(2)] = e.target.value;
  if (f === 'act-minutes') { const n = parseInt(e.target.value, 10); if (Number.isFinite(n)) S.overlay.minutes = n; }
  if (f === 'act-kmval') { const n = num(e.target.value); if (n != null) S.overlay.km = n; }
  const map = { 'v-url': 'url', 'v-title': 'title', 'v-notes': 'skipNotes', 'v-ex': 'exText', 'imp-text': 'text', 'imp-source': 'source' };
  if (f && map[f]) S.form[map[f]] = e.target.value;
});

function render() {
  const scrollY = window.scrollY;
  $app.innerHTML = (S.run && S.screen === 'workout' ? renderWorkout() : renderMain()) + renderOverlay();
  if (S.run && S.screen === 'workout') {
    for (const key of ['rest', 'timer']) if (S.run[key]) updateTimerDom(key, tState(S.run[key]), S.run[key]);
  }
  if (S.overlay) window.scrollTo(0, scrollY);
}

// ---------- старт ----------
(async function init() {
  await load();
  const params = new URLSearchParams(location.search);
  const goTo = params.get('go');
  if (goTo === 'home' || goTo === 'walk') { S.form = { preset: goTo === 'walk' ? 'walk' : 'ringfit' }; S.screen = 'homeLog'; }
  else if (goTo === 'measure') S.screen = 'measure';
  render();
  db.persist();
  if ('serviceWorker' in navigator && location.hostname !== 'localhost') navigator.serviceWorker.register('./sw.js').catch(() => {});
})();

// для отладки в консоли
window.__S = S;
