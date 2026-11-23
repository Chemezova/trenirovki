// Порядок занятий в дне клуба: что за чем делать и во сколько. Чистая логика без доступа к состоянию.
// Групповое занятие стоит в расписании жёстко, бассейн можно только в свободные окна, зал гибкий.
// Результат — подсказка, а не запрет: общих правил «что после чего» мало, поэтому спорные порядки помечаются.

export const DEFAULT_GAPS = { changeMin: 10, poolPrepMin: 15 };
// settings.schedule = { changeMin, poolPrepMin }: время между занятиями и душ перед бассейном (минуты)
export function scheduleGaps(settings) {
  const s = (settings && settings.schedule) || {};
  const pick = (k) => (s[k] >= 0 && s[k] <= 60 ? Math.round(s[k]) : DEFAULT_GAPS[k]);
  return { changeMin: pick('changeMin'), poolPrepMin: Math.max(pick('poolPrepMin'), pick('changeMin')) };
}

export const toMin = (t) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));
export const fmtMin = (m) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;

const permutations = (a) => (a.length <= 1 ? [a] : a.flatMap((x, i) => permutations([...a.slice(0, i), ...a.slice(i + 1)]).map((p) => [x, ...p])));

// Расставить занятия по времени в одном порядке; null — не помещается.
// items: [{ kind: 'gym' | 'pool' | 'class', min, start? (у группового), optional? }]
// Зал перед групповым ставится как можно позже (сразу перед занятием), остальное — как можно раньше.
function place(order, ctx) {
  const { win, windows, allDay, gaps } = ctx;
  const placed = [];
  let t = win.start;
  for (let i = 0; i < order.length; i++) {
    const it = order[i];
    const prev = placed[placed.length - 1];
    const gap = prev ? (it.kind === 'pool' ? gaps.poolPrepMin : gaps.changeMin) : 0;
    const earliest = prev ? prev.end + gap : t;
    let start;
    if (it.kind === 'class') {
      start = it.start;
      if (start < earliest) return null;
    } else if (it.kind === 'gym') {
      const next = order[i + 1];
      if (next && next.kind === 'class') {
        start = Math.max(earliest, next.start - gaps.changeMin - it.min);
        if (start + it.min + gaps.changeMin > next.start) return null;
      } else start = earliest;
    } else {
      // бассейн: первое свободное окно, где хватает времени
      start = null;
      if (allDay) start = earliest;
      else {
        for (const w of windows) {
          const s = Math.max(earliest, w.start);
          if (s + it.min <= w.end) { start = s; break; }
        }
      }
      if (start == null) return null;
      const next = order[i + 1];
      if (next && next.kind === 'class' && start + it.min + gaps.changeMin > next.start) return null;
    }
    placed.push({ kind: it.kind, start, end: start + it.min, optional: !!it.optional, fixed: it.kind === 'class' });
  }
  return placed;
}

function score(placed, win) {
  const idx = (k) => placed.findIndex((p) => p.kind === k);
  const g = idx('gym'), c = idx('class'), p = idx('pool');
  let s = 0;
  if (g >= 0 && c >= 0 && g < c) s += 5;     // силовая раньше занятия: пока есть силы
  if (g >= 0 && p >= 0 && g < p) s += 3;     // силовая раньше бассейна
  if (p >= 0 && p === placed.length - 1) s += 4;  // бассейн в конце
  if (placed[placed.length - 1].end > win.end) s -= 3;  // выходит за время, которое выделено на клуб
  return s;
}

// Порядок дня. ctx: { items, win: { start, end } в минутах, windows: [{ start, end }] бассейна в минутах, allDay, gaps }
// Возвращает { steps: [{ kind, start, end, optional, fixed, why }], notes: [текст], problems: [текст], uncertain }
export function dayOrder({ items, win, windows = [], allDay = false, gaps = DEFAULT_GAPS }) {
  const present = (items || []).filter((x) => x && x.min > 0);
  if (!present.length) return { steps: [], notes: [], problems: [], uncertain: false };
  const ctx = { win, windows, allDay, gaps };
  let best = null;
  for (const order of permutations(present)) {
    const placed = place(order, ctx);
    if (!placed) continue;
    const sc = score(placed, win);
    const end = placed[placed.length - 1].end;
    if (!best || sc > best.sc || (sc === best.sc && end < best.end)) best = { placed, sc, end };
  }
  const problems = [];
  const notes = [];
  let uncertain = false;
  if (!best) {
    // вместе не помещается: ставим без бассейна и говорим об этом
    const pool = present.find((x) => x.kind === 'pool');
    if (pool && present.length > 1) {
      const rest = dayOrder({ items: present.filter((x) => x !== pool), win, windows, allDay, gaps });
      const w = allDay ? 'весь день' : windows.map((x) => `${fmtMin(x.start)}–${fmtMin(x.end)}`).join(', ') || 'нет';
      return { ...rest, problems: [`Бассейн не помещается между остальным. Свободные окна: ${w}. Можно в другой день или вместо чего-то.`, ...rest.problems] };
    }
    return { steps: [], notes: [], problems: ['Занятия не помещаются в один день: убери одно или выбери другой день.'], uncertain: false };
  }
  const steps = best.placed.map((p) => ({ ...p, why: '' }));
  const g = steps.findIndex((s) => s.kind === 'gym');
  const c = steps.findIndex((s) => s.kind === 'class');
  const p = steps.findIndex((s) => s.kind === 'pool');
  if (g >= 0 && c >= 0) {
    if (g < c) { steps[g].why = 'Сначала силовая, пока есть силы, и закончить за 10 минут до занятия.'; notes.push('Силовую лучше делать раньше спокойного занятия.'); }
    else { steps[g].why = 'Силовая после занятия: до него не хватало времени. Делай без рекордов.'; notes.push('Силовая вышла после группового занятия: если сил мало, сделай её легче.'); }
  }
  if (c >= 0) steps[c].why = 'Время занятия по расписанию клуба.';
  if (p >= 0) {
    const prev = steps[p - 1];
    steps[p].why = p === steps.length - 1 ? 'Бассейн в конце: душ и спокойное плавание после нагрузки.' : 'В свободное окно бассейна.';
    if (c >= 0 && c > p) { uncertain = true; notes.push('Бассейн вышел перед групповым занятием. Общего правила, как это влияет, нет: если после бассейна вялость, поменяй местами или пропусти бассейн.'); }
    if (prev && prev.kind === 'class') notes.push(`После занятия до бассейна ${gaps.poolPrepMin} минут на душ.`);
  }
  if (steps[steps.length - 1].end > win.end) notes.push(`День выходит за ${fmtMin(win.end)}: если нужно уложиться, убери бассейн или занятие.`);
  return { steps, notes, problems, uncertain };
}
