// Общие кусочки интерфейса: экранирование, кнопки, иконки, иллюстрации, графики

export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const dec = (n, digits = 1) => (n == null ? '—' : String(+n.toFixed(digits)).replace('.', ','));

export const btn = (label, action, { v = '', cls = 'btn-secondary', attrs = '' } = {}) => `<button class="btn ${cls}" data-a="${action}" data-v="${esc(v)}" ${attrs}>${label}</button>`;
export const chip = (label, action, v, pressed) => `<button class="chip" data-a="${action}" data-v="${esc(v)}" aria-pressed="${pressed ? 'true' : 'false'}">${label}</button>`;

const PATHS = {
  home: '<path d="M3.5 11 12 4l8.5 7"/><path d="M5.5 9.5V20h13V9.5"/><path d="M10 20v-5.5h4V20"/>',
  calendar: '<rect x="3.5" y="5" width="17" height="15.5" rx="3"/><path d="M3.5 10h17M8 3v4M16 3v4"/>',
  chart: '<path d="M3.5 20.5h17"/><rect x="5.5" y="11" width="3" height="7" rx="1"/><rect x="10.5" y="6" width="3" height="12" rx="1"/><rect x="15.5" y="9" width="3" height="9" rx="1"/>',
  gear: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>',
  check: '<path d="M5 12.5 9.5 17 19 7"/>',
  dumbbell: '<path d="M6.5 6.5v11M17.5 6.5v11M3.5 9v6M20.5 9v6M6.5 12h11"/>',
  swim: '<path d="M2 18c2 0 2-1.5 4-1.5S8 18 10 18s2-1.5 4-1.5 2 1.5 4 1.5 2-1.5 4-1.5"/><path d="M2 14c2 0 2-1.5 4-1.5S8 14 10 14s2-1.5 4-1.5 2 1.5 4 1.5"/><circle cx="16.5" cy="5.5" r="2"/><path d="M6 11l4-4 3 3"/>',
  walk: '<circle cx="13" cy="4" r="2"/><path d="M10 21l2-6-3-3 1-5 4 3 3 1"/><path d="M14 15l2 6"/>',
  yoga: '<circle cx="12" cy="4.5" r="2"/><path d="M12 7v6M5 10l7 3 7-3M8 20l4-7 4 7"/>',
  video: '<rect x="3" y="5.5" width="13" height="13" rx="2.5"/><path d="M16 10l5-3v10l-5-3"/>',
  ring: '<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="4"/>',
  group: '<circle cx="8" cy="7" r="2.2"/><circle cx="16" cy="7" r="2.2"/><path d="M3.5 20v-4a4.5 4.5 0 0 1 9 0M11.5 16a4.5 4.5 0 0 1 9 0v4"/>',
  star: '<path d="M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.9l-5.2 2.7 1-5.8-4.3-4.1 5.9-.9z"/>',
  swap: '<path d="M7 4 3 8l4 4M3 8h13M17 20l4-4-4-4M21 16H8"/>',
  x: '<path d="M6 6l12 12M18 6 6 18"/>',
  play: '<path d="M8 5.5 19 12 8 18.5z"/>',
  chevL: '<path d="M15 5l-7 7 7 7"/>',
  chevR: '<path d="M9 5l7 7-7 7"/>',
  back: '<path d="M15 5l-7 7 7 7"/>',
  more: '<circle cx="5" cy="12" r="1.3"/><circle cx="12" cy="12" r="1.3"/><circle cx="19" cy="12" r="1.3"/>',
  clock: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>',
  scale: '<rect x="3.5" y="4" width="17" height="16" rx="4"/><path d="M8 11a4 4 0 0 1 8 0"/><path d="M12 11l1.6-2.2"/>',
  route: '<circle cx="6" cy="18" r="2"/><circle cx="18" cy="6" r="2"/><path d="M8 18h6a3 3 0 0 0 0-6h-4a3 3 0 0 1 0-6h6"/>',
  heart: '<path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  ban: '<circle cx="12" cy="12" r="8.5"/><path d="M6 6l12 12"/>',
  folder: '<path d="M3.5 7.5a2 2 0 0 1 2-2h4l2 2h7a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2z"/>',
  camera: '<path d="M4 8.5a2 2 0 0 1 2-2h2l1.5-2h5L16 6.5h2a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2z"/><circle cx="12" cy="13" r="3.5"/>',
  image: '<rect x="3.5" y="4.5" width="17" height="15" rx="2.5"/><circle cx="9" cy="10" r="1.8"/><path d="M20.5 16l-5-5-8 8.5"/>',
};
export function icon(name, { size = 22, fill = false, cls = '' } = {}) {
  return `<svg class="ic ${cls}" width="${size}" height="${size}" viewBox="0 0 24 24" aria-hidden="true" fill="${fill ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${PATHS[name] || ''}</svg>`;
}
export function stars(n) {
  if (!n) return '';
  return `<span class="stars" aria-label="${n} из 3 по важности">${Array.from({ length: 3 }, (_, i) => icon('star', { size: 14, fill: i < n, cls: i < n ? 'on' : 'off' })).join('')}</span>`;
}

export const QUOTES = [
  'Каждый визит — вклад в себя',
  'Не идеально, а регулярно',
  'Маленькие шаги складываются в километры',
  'Сегодняшняя тренировка — подарок себе через месяц',
  'Сильнее, чем вчера',
  'Результат любит постоянство',
  'Дыши ровно, двигайся с удовольствием',
  'Тело любит ритм и заботу',
  'Вода смывает усталость',
  'Шаг за шагом — к лёгкости',
  'Ты делаешь это для себя',
  'Лучшее время начать — сейчас',
  'Сила — это красиво',
  'Энергия появляется в движении',
];
export function quoteOf(date) {
  const n = date.split('-').reduce((a, x) => a * 31 + Number(x), 7);
  return QUOTES[n % QUOTES.length];
}

// Иллюстрации для шапки: вода (день клуба) и парк (домашний день)
export function heroArt(kind) {
  if (kind === 'park') {
    return `<svg class="hero-art" viewBox="0 0 400 200" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      <defs><linearGradient id="skyP" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="var(--hero-sky-1)"/><stop offset="1" stop-color="var(--hero-sky-2)"/></linearGradient></defs>
      <rect width="400" height="200" fill="url(#skyP)"/>
      <circle cx="318" cy="58" r="30" fill="var(--hero-sun)" opacity=".9"/>
      <path d="M0 130 Q80 92 170 122 T400 108 V200 H0Z" fill="var(--hero-hill-1)"/>
      <path d="M0 158 Q110 124 220 150 T400 140 V200 H0Z" fill="var(--hero-hill-2)"/>
      <path d="M196 200 C210 176 232 162 268 150" stroke="var(--hero-path)" stroke-width="10" fill="none" stroke-linecap="round"/>
      <g fill="var(--hero-tree)"><circle cx="70" cy="112" r="16"/><rect x="67" y="118" width="6" height="22" rx="2"/><circle cx="110" cy="120" r="11"/><rect x="108" y="124" width="4" height="16" rx="2"/><circle cx="352" cy="118" r="13"/><rect x="350" y="122" width="4" height="18" rx="2"/></g>
    </svg>`;
  }
  return `<svg class="hero-art" viewBox="0 0 400 200" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
    <defs><linearGradient id="skyW" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="var(--hero-sky-1)"/><stop offset="1" stop-color="var(--hero-sky-2)"/></linearGradient></defs>
    <rect width="400" height="200" fill="url(#skyW)"/>
    <circle cx="310" cy="62" r="34" fill="var(--hero-sun)" opacity=".9"/>
    <path d="M0 120 Q50 108 100 120 T200 120 T300 120 T400 120 V200 H0Z" fill="var(--hero-wave-1)"/>
    <path d="M0 142 Q50 130 100 142 T200 142 T300 142 T400 142 V200 H0Z" fill="var(--hero-wave-2)"/>
    <path d="M0 166 Q50 154 100 166 T200 166 T300 166 T400 166 V200 H0Z" fill="var(--hero-wave-3)"/>
    <path d="M40 132 q14 -8 28 0 M240 154 q14 -8 28 0" stroke="#fff" stroke-width="3" fill="none" opacity=".7" stroke-linecap="round"/>
  </svg>`;
}

// Столбики: [{ label, value, title }]
export function barChart(items, { unit = '', goal = null, height = 150, fmt = (v) => dec(v, 0) } = {}) {
  const W = 320;
  const H = height;
  const top = 18;
  const bottom = 24;
  const max = Math.max(goal || 0, ...items.map((i) => i.value), 1);
  const bw = W / items.length;
  const y = (v) => top + (H - top - bottom) * (1 - v / max);
  const bars = items.map((it, i) => {
    const x = i * bw + bw * 0.18;
    const w = bw * 0.64;
    const yy = y(it.value);
    return `<g><title>${esc(it.title || `${it.label}: ${fmt(it.value)} ${unit}`)}</title>
      <rect x="${x}" y="${yy}" width="${w}" height="${Math.max(0, H - bottom - yy)}" rx="5" class="bar${it.current ? ' bar-current' : ''}"/>
      ${it.value ? `<text x="${x + w / 2}" y="${yy - 5}" text-anchor="middle" class="bar-val">${fmt(it.value)}</text>` : ''}
      <text x="${x + w / 2}" y="${H - 7}" text-anchor="middle" class="bar-lbl">${esc(it.label)}</text></g>`;
  }).join('');
  const goalLine = goal ? `<line x1="0" x2="${W}" y1="${y(goal)}" y2="${y(goal)}" class="goal-line"/><text x="${W - 2}" y="${y(goal) - 4}" text-anchor="end" class="goal-lbl">цель ${fmt(goal)}</text>` : '';
  return `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img">${goalLine}${bars}</svg>`;
}

// Линия: points [{ x: 0..1, y, label? }], target [{ x, y }]
export function lineChart(points, { target = [], height = 170, fmt = (v) => dec(v), xLabels = [] } = {}) {
  const W = 320;
  const H = height;
  const pad = { l: 34, r: 10, t: 14, b: 22 };
  const ys = [...points.map((p) => p.y), ...target.map((p) => p.y)];
  if (!ys.length) return '';
  let min = Math.min(...ys);
  let max = Math.max(...ys);
  if (max - min < 2) { min -= 1; max += 1; }
  const X = (x) => pad.l + (W - pad.l - pad.r) * x;
  const Y = (v) => pad.t + (H - pad.t - pad.b) * (1 - (v - min) / (max - min));
  const path = (pts) => pts.map((p, i) => `${i ? 'L' : 'M'}${X(p.x).toFixed(1)} ${Y(p.y).toFixed(1)}`).join(' ');
  const grid = [min, (min + max) / 2, max].map((v) => `<line x1="${pad.l}" x2="${W - pad.r}" y1="${Y(v)}" y2="${Y(v)}" class="grid"/><text x="${pad.l - 5}" y="${Y(v) + 4}" text-anchor="end" class="axis">${fmt(v)}</text>`).join('');
  const xl = xLabels.map((l) => `<text x="${X(l.x)}" y="${H - 5}" text-anchor="middle" class="axis">${esc(l.label)}</text>`).join('');
  const dots = points.map((p) => `<circle cx="${X(p.x)}" cy="${Y(p.y)}" r="4" class="${p.muted ? 'dot-muted' : 'dot'}"><title>${esc(p.label || fmt(p.y))}</title></circle>`).join('');
  return `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img">${grid}${xl}
    ${target.length ? `<path d="${path(target)}" class="target-line"/>` : ''}
    ${points.length > 1 ? `<path d="${path(points)}" class="data-line"/>` : ''}${dots}</svg>`;
}
