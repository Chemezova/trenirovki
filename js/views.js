// Экраны: главная, план, цели, настройки, карточка дня
import { S } from './state.js';
import * as cy from './cycle.js';
import * as P from './plan.js';
import * as ST from './stats.js';
import { esc, dec, btn, chip, icon, stars, heroArt, quoteOf, barChart, lineChart } from './ui.js';
import { HOME_KINDS, SWAPS, TABLE_PROMPT, EX_BY_ID, STRETCHES, poolPlan, SPA_RULES } from './data.js';
import { FOLDERS, PROGRAMS, programName, programExercises, upcomingSwaps, aquaPlan } from './programs.js';
import { hasRuVoice } from './sound.js';

const MONTHS_GEN = ['январь', 'февраль', 'март', 'апрель', 'май', 'июнь', 'июль', 'август', 'сентябрь', 'октябрь', 'ноябрь', 'декабрь'];
const MONTHS = ['январь', 'февраль', 'март', 'апрель', 'май', 'июнь', 'июль', 'август', 'сентябрь', 'октябрь', 'ноябрь', 'декабрь'];
const WD = ['', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];
const toMin = (hm) => { const [h, m] = hm.split(':').map(Number); return h * 60 + m; };
const nowMin = () => { const d = new Date(); return d.getHours() * 60 + d.getMinutes(); };
export const clockText = () => new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
export const editable = (date) => cy.daysBetween(date, cy.today()) <= 7;
const dayNum = (d) => Number(d.slice(8));

export function weekLabel(week, phase) {
  if (week === 0) return 'Вводная неделя';
  if (phase === 'after') return 'Цикл завершён';
  return `Неделя ${week} из 13 · ${cy.PHASES[phase].name}`;
}

export function gymTitle(slot, kind, finisher = 'pool') {
  const base = slot === 'cardio' ? 'Кардио' : programName(slot);
  return kind === 'full' && slot !== 'pool' ? `${base} + бассейн` : base;
}

const homeDone = (date, kind) => ST.activitiesOn(date).find((a) => (kind === 'walk' ? a.kind === 'walk' && !a.commute : kind === 'video' ? ['circuit', 'yoga', 'video'].includes(a.kind) : a.kind === kind));

function stepsGoalPerDay(phase) {
  return { p1: 7500, p2: 8500, p3: 9500, deload: 7000, after: 8000 }[phase] || 7500;
}

// ---------- элементы дня ----------
function tick(action, v, pressed, { disabled = false, label = 'Отметить' } = {}) {
  return `<button class="tick" data-a="${action}" data-v="${esc(v)}" aria-pressed="${pressed}" aria-label="${label}" ${disabled ? 'disabled' : ''}>${icon(pressed ? 'check' : 'plus', { size: 20 })}</button>`;
}

export function dayItemsHtml(date) {
  const d = P.effective(date, S.plan);
  const today = cy.today();
  const isToday = date === today;
  const past = date < today;
  const future = date > today;
  const canEdit = editable(date);
  const rows = [];

  if (d.cancelled) {
    const reason = (P.CANCEL_REASONS.find(([id]) => id === d.cancelled) || [, 'отменено'])[1];
    rows.push(`<div class="day-item is-cancelled"><div class="di-icon">${icon('ban')}</div><div class="di-body"><div class="di-title">${d.type === 'gym' ? 'Клуб' : 'Активности'}</div><div class="di-meta">Отменено: ${esc(reason.toLowerCase())}</div></div>${canEdit ? btn('Вернуть', 'day-restore', { v: date, cls: 'btn-small btn-secondary' }) : ''}</div>`);
  } else if (d.type === 'gym') {
    const slot = P.slotFor(date, S.plan, S.settings.startDate, { sessions: S.sessions });
    const sess = ST.sessionsOn(date)[0];
    const running = S.run && S.run.date === date;
    const timePassed = isToday && nowMin() > toMin(P.GYM_WINDOW.end);
    const cls = sess ? 'is-done' : (past || timePassed) && !running ? 'is-past' : '';
    let act = '';
    if (running) act = btn(`${icon('play', { size: 16 })} Продолжить`, 'resume', { cls: 'btn-small btn-primary' });
    else if (sess) act = tick('gym-retro', date, true, { disabled: !sess.retro || !canEdit, label: 'Сделано' });
    else if (isToday) act = btn(`${icon('play', { size: 16 })} Начать`, 'gym-start', { v: date, cls: 'btn-small btn-primary' });
    else if (past) act = tick('gym-retro', date, false, { disabled: !canEdit, label: 'Отметить, что была в клубе' });
    const meta = sess ? (sess.retro ? 'Отмечено задним числом' : `Сделано · ${{ done: 'полностью', partial: 'частично' }[sess.status]}`) : `${P.GYM_WINDOW.start}–${P.GYM_WINDOW.end} · ${P.GYM_KINDS[d.gymKind].hours}${timePassed && !running ? ' · время прошло' : ''}`;    rows.push(`<div class="day-item ${cls}"><div class="di-icon">${icon(slot === 'pool' ? 'swim' : 'dumbbell')}</div>
      <div class="di-body"><div class="di-title">${esc(gymTitle(slot, d.gymKind, d.finisher))}</div><div class="di-meta">${esc(meta)}</div>
      ${PROGRAMS[slot] ? `<button class="btn-link mini-link" data-a="prog-open" data-v="${slot}">Смотреть программу</button>` : ''}</div>${act}</div>`);
    const commute = ST.activitiesOn(date).filter((a) => a.commute);
    if (commute.length) rows.push(`<div class="day-item is-done"><div class="di-icon">${icon('walk')}</div><div class="di-body"><div class="di-title">Пешком до клуба</div><div class="di-meta">${dec(commute.reduce((t, a) => t + (a.distanceKm || 0), 0))} км</div></div>${canEdit ? `<button class="icon-btn" data-a="commute-del" data-v="${date}" aria-label="Убрать дорогу до клуба">${icon('x', { size: 18 })}</button>` : ''}</div>`);
  } else {
    for (const it of P.HOME_ITEMS) {
      const done = homeDone(date, it.kind);
      const vid = done && done.videoId ? S.videos.find((v) => v.id === done.videoId) : null;
      const kindName = done ? (HOME_KINDS.find((k) => k.id === done.kind) || {}).name : '';
      const meta = done ? `${it.kind === 'video' ? `${vid ? vid.title : kindName} · ` : ''}${done.minutes ? `${done.minutes} мин` : ''}${done.distanceKm ? ` · ${dec(done.distanceKm)} км` : ''}` : it.hint;
      const choices = it.choices && !done && !future && canEdit
        ? `<div class="di-choices">${it.choices.map(([k, l]) => chip(l, S.videos.some((v) => v.kind === k) ? 'video-pick' : 'h-toggle', `${date}|${k}`, false).replace('class="chip"', 'class="chip mini"')).join('')}</div>` : '';
      const cls = done ? 'is-done' : past ? 'is-past' : '';
      const act = it.choices && !done ? '' : tick('h-toggle', `${date}|${it.kind === 'video' ? (done ? done.kind : 'circuit') : it.kind}`, !!done, { disabled: future || !canEdit, label: it.name });
      const rowAct = !future && canEdit && act ? `data-a="h-toggle" data-v="${esc(`${date}|${it.kind === 'video' ? (done ? done.kind : 'circuit') : it.kind}`)}" role="button" tabindex="0"` : '';
      rows.push(`<div class="day-item ${cls} ${rowAct ? 'is-tappable' : ''}" ${rowAct}><div class="di-icon">${icon(it.icon)}</div><div class="di-body"><div class="di-title">${esc(it.name)}</div><div class="di-meta">${esc(meta)}</div>${choices}</div>${act}</div>`);
    }
  }

  // выбранное групповое занятие
  if (d.classId && !d.cancelled) {
    const c = P.classById(date, d.classId);
    if (c) {
      const attended = ST.activitiesOn(date).some((a) => a.kind === 'class' && a.classId === c.id);
      const passed = isToday && nowMin() > toMin(c.time) + P.CLASS_MIN;
      const cls = attended ? 'is-done' : past || passed ? 'is-past' : '';
      rows.push(`<div class="day-item ${cls}"><div class="di-icon">${icon('group')}</div><div class="di-body"><div class="di-title">${esc(c.name)}${stars(c.stars)}</div><div class="di-meta">${c.time} · 55 мин</div></div>
        ${tick('cls-done', `${date}|${c.id}`, attended, { disabled: future || !canEdit, label: 'Была на занятии' })}
        ${!attended && canEdit ? `<button class="icon-btn" data-a="cls" data-v="${esc(`${date}|${c.id}`)}" aria-label="Убрать занятие">${icon('x', { size: 18 })}</button>` : ''}</div>`);
    }
  }

  // групповые занятия клуба — серым, можно выбрать одно
  const options = P.classesFor(date).filter((c) => c.id !== d.classId);
  let classesHtml = '';
  if (options.length && !past && !d.cancelled) {
    classesHtml = `<details class="classes"><summary>Групповые занятия в клубе · ${options.length}</summary><div class="day-list">${options.map((c) => {
      const passed = isToday && nowMin() > toMin(c.time);
      const badge = c.level === 'care' ? '<span class="badge badge-care">осторожно</span>' : c.level === 'no' ? '<span class="badge badge-no">не рекомендую</span>' : '';
      return `<div class="day-item is-suggest"><div class="di-icon">${icon('group')}</div><div class="di-body"><div class="di-title">${c.time} ${esc(c.name)}${stars(c.stars)}${badge}</div><div class="di-meta">${esc(c.note)}</div></div>
        ${passed ? '' : btn(d.classId ? 'Вместо' : 'Пойду', 'cls', { v: `${date}|${c.id}`, cls: 'btn-small btn-secondary' })}</div>`;
    }).join('')}</div><p class="note">Звёзды — польза для твоей цели. Одно занятие в день, в дополнение к залу или бассейну.</p></details>`;
  }
  return `<div class="day-list">${rows.join('')}</div>${classesHtml}`;
}

function dayDone(date) {
  return ST.sessionsOn(date).length > 0 || ST.activitiesOn(date).some((a) => !a.commute);
}

function hoursShort(date) {
  const d = P.effective(date, S.plan);
  if (d.cancelled) return '—';
  const h = d.type === 'gym' ? (d.gymKind === 'full' ? '3,5ч' : '2ч') : '2ч';
  return d.classId ? `${h}+1` : h;
}

export function weekStrip(ws) {
  const today = cy.today();
  return `<div class="week">${P.weekDates(ws).map((date) => {
    const d = P.effective(date, S.plan);
    const done = dayDone(date);
    const missed = date < today && !done && !d.cancelled;
    const cls = [d.type === 'gym' && !d.cancelled ? 'is-gym' : '', date === today ? 'is-today' : '', done ? 'is-done' : '', d.cancelled ? 'is-cancelled' : '', missed ? 'is-missed' : ''].join(' ');
    const ic = d.cancelled ? 'ban' : d.type === 'gym' ? (d.gymKind === 'pool' ? 'swim' : 'dumbbell') : 'walk';
    const hours = done && date < today ? `${Math.round(ST.dayMinutes(date) / 6) / 10}ч`.replace('.', ',') : missed ? '—' : hoursShort(date);
    return `<button class="wd ${cls}" data-a="day" data-v="${date}" aria-label="${esc(`${cy.fmtDate(date, true)}${missed ? ', не отмечено' : ''}`)}"><span class="wd-name">${WD[cy.weekday(date)]}</span><span class="wd-num">${dayNum(date)}</span>${icon(ic, { size: 18 })}<span class="wd-hours">${hours}</span></button>`;
  }).join('')}</div>`;
}

// ---------- главная ----------
function plannedGymDates(from, to) {
  const out = [];
  for (let d = from; d <= to; d = cy.addDays(d, 1)) {
    const e = P.effective(d, S.plan);
    if (e.type === 'gym' && !e.cancelled) out.push(d);
  }
  return out;
}

function goalRows() {
  const t = cy.today();
  const goal = S.settings.goalLossKg;
  const wl = ST.weightLoss();
  const exp = ST.expectedLoss(t);
  const lost = wl ? Math.max(0, wl.lost) : 0;
  const ws = cy.weekStart(t);
  const planned = plannedGymDates(ws, cy.addDays(ws, 6));
  const doneVisits = ST.clubVisitDates().filter((d) => d >= ws && d <= cy.addDays(ws, 6)).length;
  const phase = cy.phaseOf(cy.weekOf(t, S.settings.startDate));
  const weekKm = ST.sumRange(ST.dayKm, ws, t);
  const weekGoalKm = (stepsGoalPerDay(phase) / ST.STEPS_PER_KM) * 7;
  const pct = (v) => `${Math.max(0, Math.min(100, v * 100)).toFixed(1)}%`;
  return `
    <div class="goal-row"><div class="goal-head"><b>Вес: ${wl ? (lost > 0 ? `−${dec(lost)}` : '0') : '—'} из −${goal} кг</b><span class="sub">${exp >= 0.05 ? `по плану сейчас −${dec(exp)}` : 'старт 26.10'}</span></div>
      <div class="progress"><div class="fill" style="width:${pct(lost / goal)}"></div><div class="mark" style="left:${pct(exp / goal)}"></div></div>
      ${wl ? '' : '<p class="note">Внеси вес — и здесь появится твой путь.</p>'}</div>
    <div class="goal-row"><div class="goal-head"><b>Клуб на этой неделе: ${doneVisits} из ${planned.length || 0}</b><span class="sub">цель 3 раза</span></div>
      <div class="progress"><div class="fill" style="width:${pct(planned.length ? doneVisits / planned.length : 0)}"></div></div></div>
    <div class="goal-row"><div class="goal-head"><b>Ходьба за неделю: ${dec(weekKm)} км</b><span class="sub">цель ~${dec(weekGoalKm, 0)} км</span></div>
      <div class="progress"><div class="fill" style="width:${pct(weekKm / weekGoalKm)}"></div><div class="mark" style="left:${pct(cy.weekday(t) / 7)}"></div></div></div>
    <div class="legend-inline"><span><i style="background:var(--sage)"></i>у тебя</span><span><i style="background:var(--coral)"></i>где по плану сегодня</span></div>`;
}

export function renderHome() {
  const t = cy.today();
  const start = S.settings.startDate;
  const week = cy.weekOf(t, start, S.settings.shifts);
  const phase = cy.phaseOf(week);
  const d = P.effective(t, S.plan);
  const parts = [];
  parts.push(`<header class="app-header"><div class="titles"><div class="date">${esc(cy.capitalize(cy.fmtDate(t, true)))}</div><div class="clock"><span data-clock>${clockText()}</span> · ${esc(weekLabel(week, phase))}</div></div>
    <button class="icon-btn" data-a="go" data-v="settings" aria-label="Настройки">${icon('gear')}</button></header>`);
  parts.push(`<section class="hero">${heroArt(d.type === 'gym' && !d.cancelled ? 'water' : 'park')}<div class="hero-text"><p class="hero-quote">${esc(S.settings.name ? `${S.settings.name}, ${quoteOf(t).charAt(0).toLowerCase()}${quoteOf(t).slice(1)}` : quoteOf(t))}</p><p class="hero-sub">${d.cancelled ? 'Сегодня отдыхаем и восстанавливаемся' : d.type === 'gym' ? 'Сегодня день клуба' : 'Сегодня — движение на свежем воздухе'}</p></div></section>`);

  if (S.run) parts.push(`<section class="banner"><p><b>Тренировка не закончена.</b> Начата в ${new Date(S.run.checkInAt).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}.</p>${btn('Продолжить', 'resume', { cls: 'btn-primary btn-small' })}</section>`);
  const cp = cy.checkpointNear(t, start);
  if (cp != null && !S.measurements.some((m) => m.checkpoint === cp && m.waistCm != null)) {
    parts.push(`<section class="banner"><p><b>Контрольный замер${cp === 0 ? ' 0' : ` после недели ${cp}`}.</b> Утром, натощак.</p>${btn('Записать', 'go', { v: 'measure', cls: 'btn-small btn-secondary' })}</section>`);
  }
  const lb = S.settings.lastBackupAt;
  if (S.sessions.length + S.measurements.length >= 3 && (!lb || cy.daysBetween(lb.slice(0, 10), t) > 14)) {
    parts.push(`<section class="banner"><p><b>Сохрани копию данных</b> — всё хранится только на телефоне.</p>${btn('Сохранить', 'export', { cls: 'btn-small btn-secondary' })}</section>`);
  }

  const visits = ST.clubVisitDates();
  const wl = ST.weightLoss();
  const ws = cy.weekStart(t);
  const weekKm = ST.sumRange(ST.dayKm, ws, t);
  const monthKm = ST.sumRange(ST.dayKm, `${t.slice(0, 8)}01`, t);
  parts.push(`<section class="stats">
    <div class="stat">${icon('dumbbell')}<div class="stat-val">${visits.length}</div><div class="stat-lbl">${visits.length ? `визитов с ${cy.fmtShort(visits[0]).slice(3)}` : 'визитов — первый впереди'}</div></div>
    <div class="stat">${icon('scale')}<div class="stat-val">${wl ? `${wl.lost > 0 ? '−' : wl.lost < 0 ? '+' : ''}${dec(Math.abs(wl.lost))}` : '—'}<small> кг</small></div><div class="stat-lbl">${wl ? `из цели −${S.settings.goalLossKg}` : 'внеси вес'}</div></div>
    <div class="stat">${icon('route')}<div class="stat-val">${dec(weekKm)}<small> км</small></div><div class="stat-lbl">за неделю · ${dec(monthKm)} за месяц</div></div>
  </section>`);
  parts.push(`<section class="card"><h2>Путь к цели</h2>${goalRows()}</section>`);

  const allDone = dayDone(t);
  parts.push(`<h2 class="section-title">Сегодня <button class="btn-link" data-a="day" data-v="${t}">Изменить план</button></h2>${dayItemsHtml(t)}${allDone ? '<p class="done-note">День засчитан — так держать!</p>' : ''}`);
  parts.push(`<h2 class="section-title">Неделя <button class="btn-link" data-a="tab" data-v="calendar">План</button></h2>${weekStrip(ws)}`);
  return parts.join('');
}

// ---------- план ----------
function rangeTitle(ws) {
  const we = cy.addDays(ws, 6);
  const a = cy.fmtDate(ws).split(' ');
  const b = cy.fmtDate(we).split(' ');
  return a[1] === b[1] ? `${a[0]}–${b[0]} ${b[1]}` : `${cy.fmtDate(ws)} – ${cy.fmtDate(we)}`;
}

function planDayRow(date) {
  const d = P.effective(date, S.plan);
  const slot = P.slotFor(date, S.plan, S.settings.startDate, { sessions: S.sessions });
  const c = d.classId ? P.classById(date, d.classId) : null;
  const title = d.cancelled ? 'Отменено' : d.type === 'gym' ? gymTitle(slot, d.gymKind, d.finisher) : 'Дома: прогулка, видео или йога, Ring Fit';
  const done = dayDone(date);
  const missed = date < cy.today() && !done && !d.cancelled;
  const meta = missed ? 'не отмечено' : [d.cancelled ? '' : P.plannedHours(date, S.plan), c ? `${c.time} ${c.name}` : '', done ? '✓ сделано' : ''].filter(Boolean).join(' · ');
  return `<button class="plan-day ${d.type === 'gym' && !d.cancelled ? 'is-gym' : ''} ${date === cy.today() ? 'is-today' : ''} ${missed ? 'is-missed' : ''}" data-a="day" data-v="${date}">
    <div class="pd-date"><b>${dayNum(date)}</b><span>${WD[cy.weekday(date)]}</span></div>
    <div class="pd-body"><div class="di-title">${esc(title)}</div><div class="di-meta">${esc(meta)}</div></div>${icon(d.type === 'gym' && !d.cancelled ? 'dumbbell' : 'walk', { size: 20 })}</button>`;
}

const hm = (m) => (m >= 60 ? `${Math.floor(m / 60)} ч${m % 60 ? ` ${m % 60} мин` : ''}` : `${m} мин`);
const timesWord = (n) => `${n} ${n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 10 || n % 100 >= 20) ? 'раза' : 'раз'}`;

function typesCard(title, from, to) {
  const rows = ST.typeBreakdown(from, to);
  const shown = rows.filter((x) => x.count || x.minutes);
  if (!shown.length) return `<section class="card"><h2>${esc(title)}</h2><p class="note">Пока нет отмеченных занятий.</p></section>`;
  const max = Math.max(...shown.map((x) => x.minutes), 1);
  const total = shown.reduce((t, x) => t + x.minutes, 0);
  return `<section class="card"><h2>${esc(title)}</h2>
    <div class="types">${shown.map((x) => {
      const extra = x.id === 'walk' ? ` · ${dec(x.km)} км${x.commutes ? `, из них до клуба ${x.commutes}×` : ''}` : '';
      return `<div class="type-row" title="${esc(`${x.name}: ${timesWord(x.count)}, ${hm(x.minutes)}${extra}`)}">
        <div class="type-head"><span class="type-name">${icon(x.icon, { size: 18 })}${esc(x.name)}</span><span class="type-val"><b>${x.count ? timesWord(x.count) : '—'}</b> · ${hm(x.minutes)}</span></div>
        <div class="type-bar"><i style="width:${((x.minutes / max) * 100).toFixed(1)}%"></i></div>
        ${extra ? `<div class="sub">${esc(extra.slice(3))}</div>` : ''}</div>`;
    }).join('')}</div>
    <p class="sub">Всего: ${hm(total)} движения</p></section>`;
}

function monthView() {
  const t = cy.today();
  const base = cy.parse(`${t.slice(0, 8)}01`);
  base.setMonth(base.getMonth() + S.cal.month);
  const first = cy.isoDate(base);
  const last = cy.isoDate(new Date(base.getFullYear(), base.getMonth() + 1, 0));
  const lead = cy.weekday(first) - 1;
  const cells = [];
  for (let i = 0; i < lead; i++) cells.push('<span class="cell blank"></span>');
  for (let d = first; d <= last; d = cy.addDays(d, 1)) {
    const min = d <= t ? ST.dayMinutes(d) : 0;
    const lvl = ST.level(min);
    cells.push(`<button class="cell l${lvl} ${d === t ? 'is-today' : ''} ${d > t ? 'is-future' : ''}" data-a="day" data-v="${d}" aria-label="${esc(`${cy.fmtDate(d)}: ${min ? `${min} мин активности` : 'нет активности'}`)}">${dayNum(d)}</button>`);
  }
  const to = last < t ? last : t;
  const active = first <= t;
  const sum = (fn) => (active ? ST.sumRange(fn, first, to) : 0);
  const days = active ? cy.daysBetween(first, to) + 1 : 0;
  let activeDays = 0;
  for (let d = first; active && d <= to; d = cy.addDays(d, 1)) if (ST.dayMinutes(d) > 0) activeDays++;
  const clubDays = ST.clubVisitDates().filter((d) => d >= first && d <= last).length;
  const health = Object.keys(S.health).some((d) => d >= first && d <= last);

  // по неделям месяца
  const weeks = [];
  for (let ws = cy.weekStart(first); ws <= last; ws = cy.addDays(ws, 7)) {
    const a = ws < first ? first : ws;
    const we = cy.addDays(ws, 6);
    const end = we > last ? last : we;
    const b = end > t ? t : end;
    const has = a <= b;
    weeks.push({
      label: `${dayNum(a)}–${dayNum(end)}`,
      current: t >= ws && t <= we,
      km: has ? ST.sumRange(ST.dayKm, a, b) : 0,
      club: ST.clubVisitDates().filter((d) => d >= a && d <= end).length,
      swim: has ? ST.sumRange(ST.swimMinutesOn, a, b) : 0,
      home: has ? ST.sumRange(ST.homeMinutesOn, a, b) : 0,
    });
  }
  const monthName = `${MONTHS[base.getMonth()]} ${base.getFullYear()}`;
  return `<div class="nav-row"><button class="icon-btn" data-a="cal-nav" data-v="-1" aria-label="Предыдущий месяц">${icon('chevL')}</button><div class="nav-title">${esc(cy.capitalize(monthName))}</div><button class="icon-btn" data-a="cal-nav" data-v="1" aria-label="Следующий месяц">${icon('chevR')}</button></div>
    <section class="card"><div class="heat">${WD.slice(1).map((w) => `<span class="hd">${w}</span>`).join('')}${cells.join('')}</div>
      <div class="heat-legend">меньше ${[1, 2, 3, 4, 5].map((l) => `<i style="background:var(--heat-${l})"></i>`).join('')} больше · до 30 мин → 3+ часа</div></section>
    <section class="card"><h2>Итоги месяца</h2><div class="kpis">
      <div class="kpi"><b>${activeDays} из ${days}</b><span>активных дней</span></div>
      <div class="kpi"><b>${clubDays}</b><span>визитов в клуб</span></div>
      <div class="kpi"><b>${health ? '' : '≈'}${Math.round(sum(ST.daySteps)).toLocaleString('ru-RU')}</b><span>шагов${health ? '' : ' (оценка)'}</span></div>
      <div class="kpi"><b>${dec(sum(ST.dayKm))} км</b><span>прошла</span></div>
      <div class="kpi"><b>${sum(ST.swimMinutesOn)} мин</b><span>в бассейне</span></div>
      <div class="kpi"><b>${sum(ST.homeMinutesOn)} мин</b><span>занятий дома</span></div></div></section>
    ${typesCard(`Занятия за ${MONTHS_GEN[base.getMonth()]}`, first, last)}
    <section class="card"><h2>Визиты в клуб по неделям</h2>${barChart(weeks.map((w) => ({ label: w.label, value: w.club, current: w.current })), { goal: 3 })}</section>
    <section class="card"><h2>Бассейн по неделям, минуты</h2>${barChart(weeks.map((w) => ({ label: w.label, value: w.swim, current: w.current })), { unit: 'мин' })}</section>
    <section class="card"><h2>Километры по неделям</h2>${barChart(weeks.map((w) => ({ label: w.label, value: w.km, current: w.current })), { unit: 'км', fmt: (v) => dec(v) })}</section>`;
}

export function renderCalendar() {
  const t = cy.today();
  const parts = [`<header class="page-title"><h1>План</h1><button class="icon-btn" data-a="go" data-v="settings" aria-label="Настройки">${icon('gear')}</button></header>`,
    `<div class="seg" role="group"><button data-a="cal-mode" data-v="week" aria-pressed="${S.cal.mode === 'week'}">Неделя</button><button data-a="cal-mode" data-v="month" aria-pressed="${S.cal.mode === 'month'}">Месяц</button></div>`];
  if (S.cal.mode === 'month') return parts.join('') + monthView();

  const ws = cy.addDays(cy.weekStart(t), 7 * S.cal.week);
  const week = cy.weekOf(ws < S.settings.startDate && cy.addDays(ws, 6) >= S.settings.startDate ? S.settings.startDate : ws, S.settings.startDate);
  const phase = cy.phaseOf(week);
  const why = P.PHASE_WHY[week === 0 ? 'intro' : phase];
  parts.push(`<div class="nav-row"><button class="icon-btn" data-a="cal-nav" data-v="-1" aria-label="Предыдущая неделя">${icon('chevL')}</button><div class="nav-title">${esc(rangeTitle(ws))}</div><button class="icon-btn" data-a="cal-nav" data-v="1" aria-label="Следующая неделя">${icon('chevR')}</button></div>`);
  parts.push(`<section class="card"><h2>${esc(weekLabel(week, phase))}</h2><p><b>Что делаем:</b> ${esc(why.what)}</p><p><b>Зачем:</b> ${esc(why.why)}</p>
    <details class="classes"><summary>Как замеряем результат</summary><p>${esc(P.MEASURE_HOW)}</p></details></section>`);
  parts.push(`<p class="note">Тапни день, чтобы сделать его днём зала, выбрать групповое занятие, перенести или отменить.</p>`);
  parts.push(P.weekDates(ws).map(planDayRow).join(''));
  if (ws <= t) parts.push(typesCard('Занятия за неделю', ws, cy.addDays(ws, 6)));
  return parts.join('');
}

// ---------- цели и прогресс ----------
export function renderGoals() {
  const start = S.settings.startDate;
  const end = cy.addDays(start, 90);
  const w = ST.weights();
  const wl = ST.weightLoss();
  const from = [w[0] && w[0].date, cy.addDays(start, -3)].filter(Boolean).sort()[0];
  const total = cy.daysBetween(from, end);
  const X = (d) => cy.daysBetween(from, d) / total;
  const xLabels = [from, cy.addDays(start, 28), cy.addDays(start, 56), end].map((d) => ({ x: X(d), label: cy.fmtShort(d).slice(3) }));
  const weightChart = w.length
    ? lineChart(w.map((m) => ({ x: X(m.date), y: m.weightKg, muted: m.premenstrual, label: `${cy.fmtShort(m.date)}: ${dec(m.weightKg)} кг${m.premenstrual ? ' (непоказательно)' : ''}` })),
      { target: [{ x: X(w[0].date), y: w[0].weightKg }, { x: 1, y: w[0].weightKg - S.settings.goalLossKg }], xLabels })
    : '<p class="note">Пока нет записей веса.</p>';
  const waist = S.measurements.filter((m) => m.waistCm != null).sort((a, b) => a.date.localeCompare(b.date));
  const waistChart = waist.length
    ? lineChart(waist.map((m) => ({ x: X(m.date), y: m.waistCm, muted: m.premenstrual, label: `${cy.fmtShort(m.date)}: ${dec(m.waistCm)} см` })), { target: [{ x: X(waist[0].date), y: waist[0].waistCm }, { x: 1, y: waist[0].waistCm - 3 }], xLabels })
    : '<p class="note">Талия появится после первого замера.</p>';

  const t = cy.today();
  const weeks = [];
  for (let i = 7; i >= 0; i--) {
    const ws = cy.addDays(cy.weekStart(t), -7 * i);
    const we = cy.addDays(ws, 6);
    weeks.push({ label: `${dayNum(ws)}.${ws.slice(5, 7)}`, current: i === 0, club: ST.clubVisitDates().filter((d) => d >= ws && d <= we).length, km: ST.sumRange(ST.dayKm, ws, we > t ? t : we) });
  }
  const measures = [...S.measurements].sort((a, b) => b.date.localeCompare(a.date));
  return `<header class="page-title"><h1>Цели и прогресс</h1><button class="icon-btn" data-a="go" data-v="settings" aria-label="Настройки">${icon('gear')}</button></header>
    <section class="card"><h2>Мои цели к ${cy.fmtDate(end)}</h2>
      <ul class="list"><li>Минус ${S.settings.goalLossKg} кг жира${wl && wl.lost > 0 ? ` · уже −${dec(wl.lost)}` : ''}</li><li>Минус 2–4 см на талии</li><li>3 визита в клуб в неделю</li><li>Шаги: 7–8 тыс. → 9–10 тыс. в день</li></ul>
      ${goalRows()}</section>
    <div class="grid2">${btn(`${icon('scale', { size: 18 })} Вес`, 'weight-open')}${btn(`${icon('plus', { size: 18 })} Замер`, 'go', { v: 'measure' })}${btn(`${icon('heart', { size: 18 })} Шаги из Здоровья`, 'health-paste')}${btn(`${icon('walk', { size: 18 })} Активность`, 'go', { v: 'homeLog' })}${btn(`${icon('video', { size: 18 })} Мои видео`, 'go', { v: 'videos' })}</div>
    <section class="card"><h2>Вес, кг</h2>${weightChart}<div class="legend-inline"><span><i style="background:var(--sage)"></i>факт</span><span><i style="background:var(--coral)"></i>план к цели</span></div></section>
    <section class="card"><h2>Талия, см</h2>${waistChart}</section>
    <section class="card"><h2>Визиты в клуб по неделям</h2>${barChart(weeks.map((x) => ({ label: x.label, value: x.club, current: x.current })), { goal: 3 })}</section>
    <section class="card"><h2>Километры по неделям</h2>${barChart(weeks.map((x) => ({ label: x.label, value: x.km, current: x.current })), { fmt: (v) => dec(v, 0) })}</section>
    <section class="card"><h2>Замеры</h2>${measures.length ? measures.map((m) => `<div class="row-btn"><b>${cy.fmtShort(m.date)}${m.checkpoint != null ? ` · контрольный ${m.checkpoint}` : ''}${m.premenstrual ? ' · непоказательно' : ''}</b><span>${[['weightKg', 'вес'], ['waistCm', 'талия'], ['bellyNavelCm', 'живот'], ['hipsCm', 'бёдра'], ['thighCm', 'бедро']].filter(([k]) => m[k] != null).map(([k, l]) => `${l} ${dec(m[k])}`).join(' · ')}</span><button class="btn-link danger-link" data-a="del-measure" data-v="${m.id}">Удалить</button></div>`).join('') : '<p class="note">Пока пусто.</p>'}</section>`;
}

// ---------- настройки ----------
export function renderSettings() {
  const s = S.settings;
  return `<header class="page-title"><button class="icon-btn" data-a="go" data-v="back" aria-label="Назад">${icon('back')}</button><h1>Настройки</h1></header>
    <section class="card"><h2>Цикл и цель</h2>
      <label class="field">Старт цикла (понедельник недели 1)<input type="date" data-f="startDate" value="${esc(s.startDate)}"></label>
      <label class="field">Цель, минус кг<input type="text" inputmode="decimal" data-f="goalLossKg" value="${esc(dec(s.goalLossKg))}"></label>
      <label class="field">Как к тебе обращаться<input type="text" data-f="name" value="${esc(s.name || '')}" placeholder="Елена"></label></section>
    <section class="card"><h2>Звук и голос</h2>
      <div class="chips">${chip('Голос включён', 'voice', 'on', s.voice)}${chip('Без голоса', 'voice', 'off', !s.voice)}</div>
      ${btn('Проверить звук и голос', 'test-sound')}
      <p class="note">На iPhone выключи беззвучный режим (переключатель сбоку) — иначе сигналов таймера может не быть.${hasRuVoice() ? '' : ' Русский голос не найден: скачай в Настройки iPhone → Универсальный доступ → Устный контент → Голоса.'}</p></section>
    <section class="card"><h2>Мои видео</h2><p>Ссылки на видео-тренировки и йогу из Telegram и YouTube, с проверкой на опасные упражнения. ${S.videos.length ? `Сейчас: ${S.videos.length}.` : ''}</p>${btn('Открыть библиотеку', 'go', { v: 'videos' })}</section>
    <section class="card"><h2>Шаги из Apple Здоровья</h2>
      <p>Веб-приложение не может читать Здоровье напрямую, поэтому шаги передаёт «Команда» iPhone через буфер обмена.</p>
      <p>Здоровье хранит всю историю шагов, поэтому Команда может забрать сразу прошедшие дни — например, последние 30. Повторные загрузки просто обновят цифры.</p>
      <details class="classes"><summary>Как сделать Команду (10 минут, один раз)</summary><ol class="list">
        <li>Открой «Команды» → «+» → назови «Тренировки: шаги».</li>
        <li>«Найти образцы здоровья»: тип «Шаги», «Дата начала» — «за последние 30 дней», «Группировать по» — «День».</li>
        <li>«Повторить с каждым»: внутри — «Текст»: <code>S;</code> + «Дата начала» повторяемого объекта в формате <code>yyyy-MM-dd</code> + <code>;</code> + «Значение».</li>
        <li>Ещё раз «Найти образцы здоровья»: «Расстояние ходьбы и бега», последние 30 дней, по дням → «Повторить с каждым» → «Текст»: <code>K;</code> + дата + <code>;</code> + значение.</li>
        <li>После обоих циклов: «Объединить текст» (разделитель — новая строка) → «Скопировать в буфер обмена».</li>
        <li>По желанию: «Автоматизация» → «Время суток» 21:30 → эта Команда.</li>
        <li>Потом в приложении: «Цели» → «Шаги из Здоровья».</li></ol>
        <p class="note">Названия действий могут немного отличаться в разных версиях iOS. Подходит и старый формат одной строкой: <code>TR;2026-10-25;8123;5,4</code>. Шаги из Здоровья важнее ручной оценки, но если поправишь километры вручную — останется твоя цифра.</p></details>
      ${btn('Вставить шаги из буфера', 'health-paste')}</section>
    <section class="card"><h2>Копия данных</h2><p>Всё хранится только на этом телефоне. ${s.lastBackupAt ? `Последняя копия: ${cy.fmtDate(s.lastBackupAt.slice(0, 10))}.` : 'Копий ещё не было.'}</p>
      ${btn('Сохранить копию', 'export', { cls: 'btn-primary' })}
      <label class="btn btn-secondary file-btn">Загрузить из копии<input type="file" accept="application/json,.json" data-f="import" hidden></label></section>
    ${btn('Стереть все данные', 'reset', { cls: 'btn-link danger-link' })}
    <p class="note center">Версия 0.2 · ${S.sessions.length} тренировок · ${S.activities.length} активностей · ${S.measurements.length} замеров</p>`;
}

// ---------- карточка дня ----------
export function renderDaySheet(date) {
  const d = P.effective(date, S.plan);
  const t = cy.today();
  const canEdit = editable(date);
  const planEditable = date >= t;
  const parts = [`<div class="sheet-head"><h2>${esc(cy.capitalize(cy.fmtDate(date, true)))}</h2><button class="icon-btn" data-a="close" aria-label="Закрыть">${icon('x')}</button></div>`];
  if (planEditable && !d.cancelled) {
    parts.push(`<div class="seg" role="group"><button data-a="day-type" data-v="${date}|gym" aria-pressed="${d.type === 'gym'}">День клуба</button><button data-a="day-type" data-v="${date}|home" aria-pressed="${d.type === 'home'}">Дома</button></div>`);
    if (d.type === 'gym') {
      parts.push(`<div class="chips">${Object.entries(P.GYM_KINDS).map(([k, v]) => chip(v.name, 'gym-kind', `${date}|${k}`, d.gymKind === k)).join('')}</div>`);
      if (d.gymKind !== 'pool') {
        const cur = P.slotFor(date, S.plan, S.settings.startDate, { sessions: S.sessions });
        parts.push(`<fieldset><legend>Программа</legend><div class="chips">${chip('По плану', 'day-prog', `${date}|`, !d.program)}${FOLDERS.flatMap((f) => f.programs).map((id) => chip(PROGRAMS[id].name, 'day-prog', `${date}|${id}`, d.program === id)).join('')}</div>
          <p class="note">По плану сегодня: ${esc(programName(cur))}. Микс — вместо А или Б, не чаще раза в неделю.</p></fieldset>`);
      }
    }
  }
  parts.push(`<div style="margin-top:12px">${dayItemsHtml(date)}</div>`);
  if (date <= t) {
    parts.push(`<p class="sub" style="margin-top:12px">Ходьба: <b>${dec(ST.dayKm(date))} км</b> · ${ST.daySteps(date).toLocaleString('ru-RU')} шагов (${esc(ST.kmSource(date))}) ${canEdit ? '<button class="btn-link" data-a="km-edit" data-v="' + date + '">Изменить</button>' : ''}</p>`);
  }
  parts.push(btn('Готово', 'close', { cls: 'btn-primary btn-xl' }));
  if (planEditable && !d.cancelled) parts.push(btn(`${icon('ban', { size: 18 })} Отменить день (болею, поездка…)`, 'day-cancel', { v: date, cls: 'btn-link' }));
  if (!canEdit) parts.push('<p class="note">Отмечать можно не дальше чем на 7 дней назад.</p>');
  return parts.join('');
}

export function renderMoveSheet(from) {
  const t = cy.today();
  const options = [];
  for (let i = 0; i <= 14; i++) {
    const d = cy.addDays(t, i);
    if (d === from) continue;
    const e = P.effective(d, S.plan);
    options.push(`<button class="row-btn" data-a="move-to" data-v="${from}|${d}"><b>${esc(cy.capitalize(cy.fmtDate(d, true)))}</b><span>${e.cancelled ? 'отменено' : e.type === 'gym' ? 'день клуба' : 'дома'}</span></button>`);
  }
  return `<div class="sheet-head"><h2>Поменять местами с…</h2><button class="icon-btn" data-a="day" data-v="${from}" aria-label="Назад">${icon('x')}</button></div>
    <p class="note">Планы двух дней поменяются местами. Групповые занятия остаются в своих днях — у них своё расписание.</p>${options.join('')}`;
}

export function renderCancelSheet(date) {
  return `<div class="sheet-head"><h2>Отменить ${esc(cy.fmtDate(date))}</h2><button class="icon-btn" data-a="day" data-v="${date}" aria-label="Назад">${icon('x')}</button></div>
    <p>Почему?</p><div class="chips">${P.CANCEL_REASONS.map(([id, l]) => chip(l, 'cancel-reason', `${date}|${id}`, false)).join('')}</div>
    <p class="note">Отменённый день не считается пропуском. Если болеешь несколько дней — отмени каждый.</p>`;
}

// ---------- программы ----------
function currentPhase() {
  const week = cy.weekOf(cy.today(), S.settings.startDate, S.settings.shifts);
  return { week, phase: cy.trainingPhase(week) };
}

export function doseFor(ex, { week, phase, light = false } = currentPhase()) {
  const base = cy.setsFor(week, phase);
  const sets = light ? Math.max(2, base - 1) : base;
  const r = ex.reps || cy.PHASES[phase].reps;
  const side = (ex.reps && ex.reps.perSide) || ex.perSide;
  return `${sets} × ${r.min}–${r.max}${side ? ' на сторону' : ''}`;
}

// Папки блогеров — из «Моих видео», по названию программы до « · »
function bloggerFolders() {
  const map = new Map();
  for (const v of S.videos) {
    const i = v.title.indexOf(' · ');
    const name = i > 0 ? v.title.slice(0, i) : 'Отдельные видео';
    if (!map.has(name)) map.set(name, []);
    map.get(name).push(v);
  }
  return [...map.entries()].map(([name, list]) => ({ name, list: list.sort((a, b) => (a.order ?? 0) - (b.order ?? 0)) }));
}

export function renderPrograms() {
  const { week, phase } = currentPhase();
  const folder = (f) => `<section class="card"><h2>${icon(f.icon, { size: 20 })} ${esc(f.name)}</h2><p class="sub">${esc(f.desc)}</p>
    <div class="day-list">${f.programs.map((id) => {
      const p = PROGRAMS[id];
      const n = programExercises(id, phase).length;
      return `<button class="plan-day" data-a="prog-open" data-v="${id}"><div class="di-icon">${icon(p.kind === 'cardio' ? 'swim' : 'dumbbell')}</div>
        <div class="pd-body"><div class="di-title">${esc(p.name)}</div><div class="di-meta">${p.kind === 'cardio' ? esc(p.duration) : `${n} упражнений · ${esc(p.duration)}`}</div></div>${icon('chevR', { size: 18 })}</button>`;
    }).join('')}</div></section>`;
  const bloggers = bloggerFolders();
  return `<header class="page-title"><h1>Программы</h1><button class="icon-btn" data-a="go" data-v="settings" aria-label="Настройки">${icon('gear')}</button></header>
    <p class="sub">${esc(weekLabel(week, phase))}: подходы и повторы в программах — для текущей недели.</p>
    ${FOLDERS.map(folder).join('')}
    ${bloggers.map((b) => `<section class="card"><h2>${icon('folder', { size: 20 })} ${esc(b.name)}</h2><p class="sub">Видео-комплексы · ${b.list.length}</p>
      <div class="day-list">${b.list.map((v) => {
        const st = videoStatus(v);
        return `<button class="plan-day" data-a="video-open" data-v="${v.id}"><div class="di-icon">${thumbIcon(v, v.kind === 'yoga' ? 'yoga' : 'video')}</div><div class="pd-body"><div class="di-title">${esc(v.title.slice(b.name.length + 3) || v.title)}</div><div class="di-meta">${v.minutes} мин ${statusBadge(st)}</div></div>${icon('chevR', { size: 18 })}</button>`;
      }).join('')}</div></section>`).join('')}
    <section class="card"><h2>${icon('plus', { size: 20 })} Комплексы блогеров</h2><p class="sub">Загрузи видео или таблицу тренировок — для каждой программы появится своя папка, а опасные упражнения я помечу и предложу замену.</p>
      <div class="grid2">${btn('Добавить видео', 'video-new')}${btn('Импорт таблицы', 'go', { v: 'videoImport' })}</div></section>`;
}

export function renderProgram(id) {
  const p = PROGRAMS[id];
  if (!p) return renderPrograms();
  const cp = currentPhase();
  const ctx = { ...cp, light: !!p.light };
  const folder = FOLDERS.find((f) => f.programs.includes(id));
  const t = cy.today();
  const today = P.effective(t, S.plan);
  const todaySlot = P.slotFor(t, S.plan, S.settings.startDate, { sessions: S.sessions });
  const isToday = today.type === 'gym' && !today.cancelled && todaySlot === id;
  const doneToday = ST.sessionsOn(t).length > 0;
  const ph = cy.PHASES[cp.phase];
  const exs = programExercises(id, cp.phase);
  const swaps = upcomingSwaps(id, cp.phase);
  const swappedFrom = new Set(swaps.map((s) => s.from.id));
  const later = programExercises(id, 'p2').filter((e) => !exs.includes(e) && !swappedFrom.has(e.id));
  const p3Date = cy.addDays(S.settings.startDate, 56);
  const pool = poolPlan(cp.phase, id === 'cardio' ? 'cardio' : 'A');
  const step = (n, title, body) => `<div class="day-item"><div class="di-icon step-num">${n}</div><div class="di-body"><div class="di-title">${title}</div>${body ? `<div class="di-meta">${body}</div>` : ''}</div></div>`;
  const aqua = aquaPlan(cp.phase);
  const poolBody = `Плавание: ${esc(pool.text)}. Затем аквааэробика: ${esc(aqua.text)} — <button class="btn-link mini-link" data-a="prog-open" data-v="pool">упражнения</button>`;
  const spaBody = esc(SPA_RULES.slice(0, 3).join(' '));
  let n = 1;
  const steps = p.kind === 'pool' ? [step(n++, 'Плавание', esc(pool.text))] : [step(n++, 'Разминка', `${id === 'cardio' ? 5 : 10} мин эллипс или велотренажёр, спокойно`)];
  if (p.kind === 'cardio') steps.push(step(n++, `Кардио ${ph.cardioMin} мин`, 'Зона 2: можно говорить короткими фразами. Эллипс, велотренажёр или дорожка с наклоном 5–8%.'));
  const exRows = exs.map((e) => `<button class="day-item ex-row" data-a="ex-open" data-v="${e.id}"><div class="di-icon">${S.photos[e.id] ? `<img src="${S.photos[e.id]}" alt="">` : icon(e.loadType === 'water' ? 'swim' : 'dumbbell')}</div>
    <div class="di-body"><div class="di-title">${esc(e.name)}</div><div class="di-meta">${esc(e.loadType === 'water' ? `${aquaPlan(cp.phase).rounds} × ${aquaPlan(cp.phase).sec} с` : doseFor(e, ctx))}${e.muscles ? ` · ${esc(e.muscles)}` : ''}</div></div>${icon('chevR', { size: 18 })}</button>`).join('');
  const k = n + (exs.length ? 1 : 0);
  const after = p.kind === 'pool'
    ? [step(k, 'Гидромассаж и сауна', spaBody), step(k + 1, 'Растяжка', esc(STRETCHES.map((s) => s.name).join(', ')))]
    : [step(k, 'Бассейн', poolBody), step(k + 1, 'Гидромассаж и сауна', spaBody), step(k + 2, 'Растяжка', esc(STRETCHES.map((s) => s.name).join(', ')))];
  return `<header class="page-title"><button class="icon-btn" data-a="go" data-v="back" aria-label="Назад">${icon('back')}</button><h1>${esc(p.name)}</h1></header>
    <section class="card"><p class="sub">${esc(folder ? folder.name : '')} · ${esc(p.duration)}</p><p>${esc(p.why)}</p>
      ${p.kind === 'gym' ? `<p><b>Сейчас (${esc(weekLabel(cp.week, cp.phase).toLowerCase())}):</b> ${Math.max(2, cy.setsFor(cp.week, cp.phase) - (p.light ? 1 : 0))} подхода, отдых ${ph.rest} с, темп 2 с вверх и 2–3 с вниз, выдох на усилии.${p.light ? ' Вес на шаг ниже обычного.' : ''}</p>` : ''}
      ${S.run ? btn(`${icon('play', { size: 18 })} Продолжить начатую тренировку`, 'resume', { cls: 'btn-primary btn-xl' }) : isToday && !doneToday ? btn(`${icon('play', { size: 18 })} Начать сегодня`, 'gym-start', { v: t, cls: 'btn-primary btn-xl' }) : btn('Поставить на сегодня', 'prog-today', { v: id, cls: 'btn-secondary' })}</section>
    <h2 class="section-title">Порядок тренировки</h2>
    <div class="day-list">${steps.join('')}
      ${exs.length ? `<div class="day-item"><div class="di-icon step-num">${n}</div><div class="di-body"><div class="di-title">${p.kind === 'pool' ? `Аквааэробика · ${esc(aqua.text)}` : `Упражнения · ${exs.length}`}</div><div class="di-meta">${p.kind === 'pool' ? 'Круговая: таймер с голосом ведёт по упражнениям. Тапни — техника' : 'Тапни упражнение — техника, тренажёр, фото'}</div></div></div>${exRows}` : ''}
      ${after.join('')}</div>
    ${later.length ? `<p class="note">С 5-й недели добавятся: ${later.map((e) => esc(e.name)).join(', ')}.</p>` : ''}
    ${swaps.length ? `<section class="card"><h2>С ${esc(cy.fmtDate(p3Date))} (неделя 9) — усложнение</h2><p class="sub">В фазе «Закрепление» три упражнения меняются на варианты посложнее. Стартовый вес приложение посчитает от твоего веса в исходном упражнении.</p>
      <div class="day-list">${swaps.map((s) => `<button class="day-item ex-row" data-a="ex-open" data-v="${s.to.id}"><div class="di-icon">${icon('swap')}</div>
        <div class="di-body"><div class="di-title">${esc(s.to.name)}</div><div class="di-meta">вместо «${esc(s.from.name)}» · ${esc(s.to.why || '')}</div></div>${icon('chevR', { size: 18 })}</button>`).join('')}</div></section>` : ''}`;
}

export function renderExerciseCard(id) {
  const e = EX_BY_ID[id];
  if (!e) return '';
  const photo = S.photos[id];
  const q = encodeURIComponent(e.nameEn + (e.loadType === 'machine' || e.loadType === 'cable' ? ' machine' : ' exercise'));
  return `<div class="sheet-head"><h2>${esc(e.name)}</h2><button class="icon-btn" data-a="close" aria-label="Закрыть">${icon('x')}</button></div>
    ${photo ? `<img class="ex-photo" src="${photo}" alt="Фото тренажёра">` : ''}
    <p class="sub">${esc(e.loadType === 'water' ? `${aquaPlan(currentPhase().phase).rounds} круга × ${aquaPlan(currentPhase().phase).sec} с` : doseFor(e))}${e.muscles ? ` · ${esc(e.muscles)}` : ''}</p>
    ${e.eyeNote ? `<p class="eye-note">${esc(e.eyeNote)}</p>` : ''}
    ${e.why ? `<p><b>Зачем:</b> ${esc(e.why)}${e.progressFrom ? ` Усложнённый вариант упражнения «${esc(EX_BY_ID[e.progressFrom].name)}».` : ''}</p>` : ''}
    ${e.machine ? `<h3>Как выглядит</h3><p>${esc(e.machine)}</p>` : ''}
    <h3>Исходное положение</h3><p>${esc(e.setup)}</p>
    <h3>Движение</h3><p>${esc(e.movement)}</p>
    <h3>Частые ошибки</h3><p>${esc(e.mistakes)}</p>
    <h3>Требования</h3><p>Выдох на усилии, без задержки дыхания. Темп 2 с на усилие, 2–3 с на возврат. Взгляд прямо, шея продолжает позвоночник. Если тянет задержать дыхание или напрягается лицо — вес слишком большой.</p>
    <div class="link-row">
      <a class="btn btn-secondary btn-small" href="https://www.google.com/search?tbm=isch&q=${q}" target="_blank" rel="noopener">${icon('image', { size: 16 })} Как выглядит — фото</a>
      <a class="btn btn-secondary btn-small" href="https://www.youtube.com/results?search_query=${encodeURIComponent(`${e.nameEn} technique`)}" target="_blank" rel="noopener">${icon('play', { size: 16 })} Видео техники</a>
      <label class="btn btn-secondary btn-small file-btn">${icon('camera', { size: 16 })} ${photo ? 'Заменить своё фото' : 'Своё фото тренажёра'}<input type="file" accept="image/*" capture="environment" data-f="ex-photo" data-k="${id}" hidden></label>
    </div>
    ${photo ? btn('Удалить своё фото', 'ex-photo-del', { v: id, cls: 'btn-link danger-link' }) : '<p class="note">Сфотографируй тренажёр в своём клубе — фото будет видно здесь и в списке упражнений. Хранится только на телефоне.</p>'}`;
}

// ---------- библиотека видео ----------
const cap = (t) => t.charAt(0).toUpperCase() + t.slice(1);
const RISKS = [
  [/прыж|прыг|джампинг|jump|скакалк|бег на месте/i, 0, 'noJumps'],
  [/скалолаз|альпинист|mountain/i, 1, 'noPlank'],
  [/вакуум/i, 8, null],
  [/гиперэкстенз|доброе утро|good morning/i, 6, 'noHeadDown'],
  [/книжк|уголок|двойные скручиван|обратные скручиван|ножницы/i, 9, null],
  [/планк|plank/i, 2, 'noPlank'],
  [/мостик|ягодичный мост|подъ[её]м таза|bridge|thrust/i, 3, 'noBridge'],
  [/б[её]рпи|burpee/i, 4, 'noJumps'],
  [/собак|наклон|downward|плуг|б[её]р[её]зк/i, 6, 'noHeadDown'],
  [/отжиман|push.?up/i, 7, null],
];
export function risksOf(text) {
  return RISKS.filter(([re]) => re.test(text)).map(([, i, flag]) => ({ swap: SWAPS[i], flag }));
}
export function videoRisks(v) {
  return (v.exercises || []).map((e) => ({ ex: e, risks: risksOf(e.name) })).filter((x) => x.risks.length || (x.ex.verdict && x.ex.verdict.startsWith('нельзя')));
}
export function videoStatus(v) {
  const risky = videoRisks(v).length || risksOf(v.title).length;
  if (risky) return { level: 'no', text: `опасных упражнений: ${risky}` };
  const c = v.checks || {};
  if (c.noJumps && c.noHeadDown && c.noPlank && c.noBridge) return { level: 'ok', text: 'проверено' };
  return { level: 'care', text: 'проверь перед занятием' };
}
// Превью YouTube: картинка грузится с YouTube, само видео открывается там же — приложение не тяжелеет
export function ytId(url) {
  const m = String(url || '').match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?(?:.*&)?v=|shorts\/|embed\/|live\/))([\w-]{11})/);
  return m ? m[1] : null;
}
function videoYt(v) { return ytId(v.extUrl) || ytId(v.url); }
function thumbIcon(v, fallback) {
  const id = videoYt(v);
  return id ? `<img src="https://i.ytimg.com/vi/${id}/mqdefault.jpg" alt="" loading="lazy">` : icon(fallback);
}
function ytPreview(v) {
  const id = videoYt(v);
  if (!id) return '';
  return `<a class="yt-preview" href="https://www.youtube.com/watch?v=${id}" target="_blank" rel="noopener" aria-label="Смотреть на YouTube"><img src="https://i.ytimg.com/vi/${id}/hqdefault.jpg" alt="" loading="lazy"><span class="play">${icon('play', { size: 30, fill: true })}</span></a>`;
}

export function tgLink(url) {
  const m = String(url || '').match(/t\.me\/(?:s\/)?([A-Za-z0-9_]+)\/(\d+)/);
  return m ? `tg://resolve?domain=${m[1]}&post=${m[2]}` : null;
}
const KIND_NAMES = { circuit: 'Видео-тренировка', yoga: 'Йога', other: 'Другое' };
const statusBadge = (st) => `<span class="badge ${st.level === 'ok' ? 'badge-ok' : st.level === 'care' ? 'badge-care' : 'badge-no'}">${esc(st.text)}</span>`;

export function videoLinks(v) {
  const tg = tgLink(v.url);
  const yt = videoYt(v);
  const links = [];
  if (yt) links.push(`<a class="btn btn-primary btn-small" href="https://www.youtube.com/watch?v=${yt}" target="_blank" rel="noopener">${icon('play', { size: 16 })} YouTube</a>`);
  else if (v.extUrl) links.push(`<a class="btn btn-primary btn-small" href="${esc(v.extUrl)}" target="_blank" rel="noopener">${icon('play', { size: 16 })} Видео</a>`);
  if (tg) links.push(`<a class="btn ${yt || v.extUrl ? 'btn-secondary' : 'btn-primary'} btn-small" href="${esc(tg)}">${yt || v.extUrl ? '' : icon('play', { size: 16 })} Пост в Telegram</a>`);
  else if (v.url && !ytId(v.url)) links.push(`<a class="btn btn-secondary btn-small" href="${esc(v.url)}" target="_blank" rel="noopener">${icon('play', { size: 16 })} Открыть</a>`);
  return links.length ? `<div class="link-row">${links.join('')}</div>` : '';
}

export function renderVideos() {
  const list = [...S.videos].sort((a, b) => (a.order ?? 0) - (b.order ?? 0) || a.title.localeCompare(b.title, 'ru', { numeric: true }));
  return `<header class="page-title"><button class="icon-btn" data-a="go" data-v="back" aria-label="Назад">${icon('back')}</button><h1>Мои видео</h1></header>
    <div class="grid2">${btn(`${icon('plus', { size: 18 })} Добавить`, 'video-new', { cls: 'btn-primary' })}${btn('Импорт таблицы', 'go', { v: 'videoImport' })}</div>
    <details class="classes card"><summary>Чем заменить опасные упражнения</summary><table class="tbl">${SWAPS.map(([a, why, b]) => `<tr><td><b>${esc(a)}</b><br><span class="sub">${esc(why)}</span></td><td>${esc(b)}</td></tr>`).join('')}</table></details>
    ${list.length ? list.map((v) => `<button class="plan-day" data-a="video-open" data-v="${v.id}"><div class="di-icon">${thumbIcon(v, v.kind === 'yoga' ? 'yoga' : 'video')}</div><div class="pd-body"><div class="di-title">${esc(v.title)}</div><div class="di-meta"><span>${esc(KIND_NAMES[v.kind] || '')} · ${v.minutes} мин${v.exercises && v.exercises.length ? ` · ${v.exercises.length} упр.` : ''} ${statusBadge(videoStatus(v))}</div></div></button>`).join('')
    : '<p class="note">Пока пусто. Добавь ссылку на видео из Telegram или YouTube — по одной или таблицей.</p>'}`;
}

export function renderVideoSheet(id) {
  const v = S.videos.find((x) => x.id === id);
  if (!v) return '';
  const risky = videoRisks(v);
  return `<div class="sheet-head"><h2>${esc(v.title)}</h2><button class="icon-btn" data-a="close" aria-label="Закрыть">${icon('x')}</button></div>
    ${ytPreview(v)}
    <p class="sub">${esc(KIND_NAMES[v.kind] || '')} · ${v.minutes} мин · ${statusBadge(videoStatus(v))}</p>
    ${videoLinks(v)}
    ${v.exercises && v.exercises.length ? `<h3>Упражнения</h3><div class="day-list">${v.exercises.map((e) => {
      const r = risky.find((x) => x.ex === e);
      return `<div class="day-item"><div class="di-icon">${icon(r ? 'ban' : e.verdict ? 'clock' : 'check')}</div><div class="di-body"><div class="di-title">${e.type ? `<span class="sub">${esc(e.type)}:</span> ` : ''}${esc(e.name)}${e.dose ? ` · ${esc(e.dose)}` : ''}</div>
        ${e.tech ? `<div class="di-meta">${esc(e.tech)}</div>` : ''}
        ${e.verdict ? `<p class="eye-note">${esc(cap(e.verdict))}</p>` : r && r.risks.length ? `<p class="eye-note">Тебе нельзя: ${esc(r.risks[0].swap[1])}. Замена: ${esc(r.risks[0].swap[2])}.</p>` : ''}</div></div>`;
    }).join('')}</div>` : ''}
    ${v.skipNotes ? `<h3>Мои заметки</h3><p>${esc(v.skipNotes)}</p>` : ''}
    <div class="row2">${btn('Изменить', 'video-edit', { v: v.id })}${btn('Удалить', 'video-del', { v: v.id, cls: 'btn-link danger-link' })}</div>`;
}

export function renderVideoForm() {
  const f = S.form;
  const checks = f.checks || {};
  const ck = (key, label) => `<label class="check"><input type="checkbox" data-f="v-check" data-k="${key}" ${checks[key] ? 'checked' : ''}> ${label}</label>`;
  const preview = risksOf(`${f.exText || ''} ${f.title || ''}`);
  return `<header class="page-title"><button class="icon-btn" data-a="go" data-v="videos" aria-label="Назад">${icon('back')}</button><h1>${f.id ? 'Видео' : 'Новое видео'}</h1></header>
    <section class="card">
      <label class="field">Ссылка на пост или видео (Telegram, YouTube)<input type="url" data-f="v-url" value="${esc(f.url || '')}" placeholder="https://t.me/…/1675"></label>
      <label class="field">Видео на YouTube, RuTube или VK — если есть<input type="url" data-f="v-ext" value="${esc(f.extUrl || '')}" placeholder="https://youtu.be/…"></label>
      ${ytPreview({ url: f.url, extUrl: f.extUrl })}
      <label class="field">Название<input type="text" data-f="v-title" value="${esc(f.title || '')}" placeholder="Модельная фигура · День 1"></label>
      <fieldset><legend>Тип</legend><div class="chips">${Object.entries(KIND_NAMES).map(([k, l]) => chip(l, 'v-kind', k, (f.vkind || 'circuit') === k)).join('')}</div></fieldset>
      <div class="stepper-block"><div class="stepper-label">Минуты</div><div class="stepper"><button data-a="v-min" data-v="-5" aria-label="Меньше">−</button><div class="val">${f.minutes || 30}</div><button data-a="v-min" data-v="5" aria-label="Больше">+</button></div></div>
      <label class="field">Упражнения — по одному в строке<textarea data-f="v-ex" rows="5" placeholder="Скалолаз — 3×1 мин">${esc(f.exText || '')}</textarea></label>
      ${preview.length ? `<p class="eye-note">Нашла опасное: ${preview.map((r) => esc(r.swap[0].split(',')[0])).join(', ')}. Замены — в карточке видео.</p>` : ''}
      <fieldset><legend>Посмотрела видео — в нём нет:</legend>${ck('noJumps', 'прыжков и бега')}${ck('noHeadDown', 'положений головой вниз и глубоких наклонов')}${ck('noPlank', 'планки и упражнений, где тянет задержать дыхание')}${ck('noBridge', 'ягодичного моста')}</fieldset>
      <label class="field">Заметки: что пропускать или заменять<textarea data-f="v-notes" rows="3" placeholder="с 12:30 «собака» — пропустить">${esc(f.skipNotes || '')}</textarea></label>
      ${btn('Сохранить', 'video-save', { cls: 'btn-primary btn-xl' })}</section>`;
}

export function renderVideoImport() {
  const f = S.form;
  return `<header class="page-title"><button class="icon-btn" data-a="go" data-v="videos" aria-label="Назад">${icon('back')}</button><h1>Импорт таблицы</h1></header>
    <section class="card"><h2>1. Задание для Genspark</h2><p class="sub">Скопируй и отдай Genspark или другому ассистенту. Если не справится — таблицу можно набрать вручную в том же формате.</p>
      <pre class="prompt">${esc(TABLE_PROMPT)}</pre>${btn('Скопировать задание', 'copy-prompt')}</section>
    <section class="card"><h2>2. Вставь результат</h2>
      <label class="field">Название программы<input type="text" data-f="imp-source" value="${esc(f.source ?? 'Модельная фигура')}"></label>
      <label class="field">Таблица: День;Упражнение;Подходы;Техника;Ссылка на пост;Программа;Тип;Видео-ссылка<textarea data-f="imp-text" rows="8" placeholder="День 1;Скалолаз;3×1 мин;корпус прямой;https://t.me/babbiebuttt/1675">${esc(f.text || '')}</textarea></label>
      <label class="btn btn-secondary file-btn">${icon('folder', { size: 18 })} Выбрать файл .csv<input type="file" accept=".csv,.txt,text/csv,text/plain" data-f="imp-file" hidden></label>
      <p class="note">Подходят точка с запятой и табуляция — можно копировать прямо из Google Таблиц или выбрать файл, например trainings.csv с Яндекс Диска. Строки одного дня станут одним видео.</p>
      ${btn('Импортировать', 'video-import', { cls: 'btn-primary btn-xl' })}</section>`;
}

export function renderVideoPick(date, kind) {
  const list = S.videos.filter((v) => v.kind === kind);
  return `<div class="sheet-head"><h2>${kind === 'yoga' ? 'Какая йога?' : 'Какое видео?'}</h2><button class="icon-btn" data-a="close" aria-label="Закрыть">${icon('x')}</button></div>
    <div class="day-list">${list.map((v) => `<div class="day-item"><div class="di-icon">${thumbIcon(v, kind === 'yoga' ? 'yoga' : 'video')}</div><div class="di-body"><div class="di-title">${esc(v.title)}</div><div class="di-meta">${v.minutes} мин ${statusBadge(videoStatus(v))}</div>${videoLinks(v)}</div>
        <button class="btn btn-small btn-secondary" data-a="video-open" data-v="${v.id}">Подробнее</button>${tick('video-done', `${date}|${v.id}`, false, { label: 'Сделала' })}</div>`).join('')}</div>
    ${btn('Отметить без видео из списка', 'h-toggle', { v: `${date}|${kind}` })}${btn('Мои видео', 'go', { v: 'videos', cls: 'btn-link' })}`;
}

// Разбор таблицы «День;Упражнение;Подходы;Техника;Ссылка» в видео по дням
export function parseVideoTable(text, source) {
  const groups = new Map();
  for (const raw of String(text).split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;
    const cols = line.split(line.includes('\t') ? '\t' : ';').map((c) => c.trim());
    if (cols.length < 2 || (/^д[её]нь$/i.test(cols[0]) && /упражнени/i.test(cols[1]))) continue;
    const [day, name, dose = '', tech = '', url = '', program = '', type = '', ext = '', verdict = ''] = cols;
    const prog = program || source;
    const key = `${prog}|${day || 'Без дня'}`;
    if (!groups.has(key)) groups.set(key, { day: day || 'Без дня', prog, url: '', exercises: [] });
    const g = groups.get(key);
    if (url && !g.url) g.url = url;
    if (ext && !g.extUrl) g.extUrl = ext;
    g.exercises.push({ name, dose, tech, type: type && type !== 'основная' ? type : undefined, verdict: /^(нельзя|осторожно)/.test(verdict) ? verdict : undefined });
  }
  return [...groups.values()].map((g, i) => ({
    title: `${g.prog ? `${g.prog} · ` : ''}${g.day}`,
    url: g.url,
    extUrl: g.extUrl || '',
    exercises: g.exercises,
    order: parseInt((g.day.match(/\d+/) || [String(i + 1)])[0], 10),
  }));
}
