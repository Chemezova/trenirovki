// «Зоны внимания»: короткие корректирующие блоки (ЛФК) перед разминкой. Чистая логика без доступа к состоянию.
// Зона включается в настройках: settings.focus = [{ id: 'scapula', side: 'left' | 'right' | 'both' }].
// Новая зона (шея, грудной отдел, стопа…) — это новая запись в FOCUS_AREAS, код менять не нужно.

// review: 'draft' — комплекс составлен как общий, со специалистом (ЛФК, невролог) не согласован.
export const FOCUS_AREAS = {
  scapula: {
    name: 'Лопатка',
    title: 'Блок для лопатки',
    review: 'draft',
    sided: true,
    note: 'Общий комплекс для стабилизации лопатки, не лечение. Движения лёгкие, без боли; дыши свободно, подбородок слегка к себе, голову не запрокидывай и не опускай. Жжение, онемение или прострел в руке — остановись и отметь это в заметке к тренировке.',
    items: [
      { id: 'down-back', name: 'Лопатки вниз и назад', hint: 'Стоя или сидя. Плечи подальше от ушей, медленно опусти и сведи лопатки, задержи на 3 секунды. 8 раз. Плечи не поднимай.', sec: 40 },
      { id: 'wall-angels', name: 'Ангелы у стены', hint: 'Спина и поясница у стены. Руки скользят вверх и вниз по стене, лопатки прижаты. Амплитуда только комфортная. 8 раз.', sec: 45 },
      { id: 'wall-slide', name: 'Скольжение предплечья по стене', hint: 'Предплечье на стене, лёгкий нажим. Лопатка прижата к рёбрам, плечо не вздёрнуто. Скользи вверх 8 раз.', sec: 30, perSide: true },
      { id: 'band-row', name: 'Тяга резинки к поясу', hint: 'Лёгкая резинка, локти вдоль корпуса. Сведи лопатки, работает спина, а не шея. 10 раз. Без резинки — локти назад к корпусу.', sec: 40 },
      { id: 'wall-push', name: 'Выталкивание от стены', hint: 'Ладони на стене, руки прямые. Слегка вытолкни корпус от стены, лопатки раздвигаются. 8 раз.', sec: 30 },
    ],
  },
};

export const FOCUS_SIDES = { left: 'Левая', right: 'Правая', both: 'Обе' };
const SIDE_WORD = { left: 'левая', right: 'правая' };
const OTHER = { left: 'right', right: 'left' };

// Включённые зоны из настроек: только известные, без повторов
export function activeFocus(settings) {
  const seen = new Set();
  const out = [];
  for (const f of (settings && settings.focus) || []) {
    if (!f || !FOCUS_AREAS[f.id] || seen.has(f.id)) continue;
    seen.add(f.id);
    out.push({ id: f.id, side: FOCUS_SIDES[f.side] ? f.side : 'both' });
  }
  return out;
}

// Включить или выключить зону
export function toggleFocus(list, id) {
  const l = list || [];
  return l.some((f) => f.id === id) ? l.filter((f) => f.id !== id) : [...l, { id, side: 'both' }];
}

// Сменить сторону у включённой зоны
export function setFocusSide(list, id, side) {
  if (!FOCUS_SIDES[side]) return list || [];
  return (list || []).map((f) => (f.id === id ? { ...f, side } : f));
}

// План блока по всем включённым зонам: плоский список шагов { areaId, id, name, hint, sec, side? }.
// Упражнение «на одну сторону» делается сначала на выбранной стороне (полное время), затем на другой (вдвое короче).
// «Обе» — поровну, левая первой.
export function focusPlan(settings) {
  const plan = [];
  for (const { id, side } of activeFocus(settings)) {
    for (const it of FOCUS_AREAS[id].items) {
      if (!it.perSide || !FOCUS_AREAS[id].sided) { plan.push({ areaId: id, id: it.id, name: it.name, hint: it.hint, sec: it.sec }); continue; }
      const order = side === 'both' ? [['left', it.sec], ['right', it.sec]] : [[side, it.sec], [OTHER[side], Math.round(it.sec / 2)]];
      for (const [sd, sec] of order) plan.push({ areaId: id, id: it.id, name: `${it.name} (${SIDE_WORD[sd]})`, hint: it.hint, sec, side: sd });
    }
  }
  return plan;
}

export const planSeconds = (plan) => plan.reduce((t, x) => t + x.sec, 0);
export const planMinutes = (plan) => Math.max(1, Math.round(planSeconds(plan) / 60));

// Названия включённых зон: «Лопатка (левая)», «Лопатка»
export function focusLabel(settings) {
  return activeFocus(settings).map((f) => {
    const a = FOCUS_AREAS[f.id];
    return a.sided && f.side !== 'both' ? `${a.name} (${SIDE_WORD[f.side]})` : a.name;
  });
}
