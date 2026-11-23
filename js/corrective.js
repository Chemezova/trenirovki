// «Зоны внимания»: корректирующие упражнения (ЛФК) для проблемной зоны. Чистая логика без доступа к состоянию.
// Зона включается в профиле: settings.focus = [{ id: 'scapula', side: 'left' | 'right' | 'both', mode: 'home' | 'inline' | 'block' }].
//   home   — дома, в комплексе «Осанка и лопатка» (по умолчанию: зал остаётся для тренажёров и весов);
//   inline — упражнения встают в начало каждой силовой тренировки как обычные (подходы, повторы, описание);
//   block  — короткий отдельный блок по таймеру после суставной разминки.
// Новая зона (шея, грудной отдел, стопа…) — это новая запись в FOCUS_AREAS, код менять не нужно.

// review: 'draft' — комплекс составлен как общий, со специалистом (ЛФК, невролог) не согласован.
// Правила отбора как для всего приложения: без задержки дыхания, без прыжков, голова не ниже сердца и не запрокинута, лёгкая нагрузка.
export const FOCUS_AREAS = {
  scapula: {
    name: 'Лопатка',
    review: 'draft',
    sided: true,
    note: 'Общий комплекс для стабилизации лопатки, не лечение. Движения лёгкие, без боли; дыши свободно, подбородок слегка к себе, голову не запрокидывай и не опускай. Жжение, онемение или прострел в руке — остановись и отметь это в заметке к тренировке.',
    exercises: [
      {
        id: 'scap-down-back', name: 'Лопатки вниз и назад', nameEn: 'scapular setting', sec: 40,
        reps: { min: 8, max: 10 },
        hint: 'Плечи подальше от ушей, медленно опусти и сведи лопатки, задержи на 3 секунды. Плечи не поднимай.',
        setup: 'Стоя или сидя, руки вдоль корпуса, взгляд прямо, подбородок слегка к себе.',
        movement: 'Плечи от ушей, медленно опустить и свести лопатки, пауза 3 с, расслабиться. Дыхание спокойное.',
        mistakes: 'Плечи поднимаются к ушам, прогиб в пояснице, задержка дыхания.',
        muscles: 'Стабилизаторы лопатки, нижняя часть трапеции', machine: 'Без оборудования.',
        meta: { pattern: 'scapular-control', primary: ['scapular-stab'], secondary: ['mid-back'], equipment: ['no-equipment'], tags: ['head_position_cue'] },
      },
      {
        id: 'wall-angels', name: 'Ангелы у стены', nameEn: 'wall angels', sec: 45,
        reps: { min: 8, max: 10 },
        hint: 'Спина и поясница у стены. Руки скользят вверх и вниз, лопатки прижаты. Амплитуда только комфортная.',
        setup: 'Спиной к стене, стопы на 10–15 см от неё, поясница и лопатки у стены, локти согнуты, тыльные стороны ладоней к стене.',
        movement: 'Медленно скользить руками вверх до комфортной высоты и вниз, лопатки остаются прижатыми. На выдохе вверх.',
        mistakes: 'Поясница прогибается, плечи вздёргиваются, голову запрокидывают. Если руки не достают до стены — это нормально, работай в своей амплитуде.',
        eyeNote: 'Подбородок слегка к себе, затылок не запрокидывать.',
        muscles: 'Стабилизаторы лопатки, нижняя трапеция, зубчатая мышца', machine: 'Свободная стена.',
        meta: { pattern: 'scapular-control', primary: ['scapular-stab'], secondary: ['rear-delts'], equipment: ['wall'], tags: ['head_position_cue'] },
      },
      {
        id: 'wall-slide', name: 'Скольжение предплечья по стене', nameEn: 'wall slide', sec: 30, perSide: true,
        reps: { min: 8, max: 10, perSide: true },
        hint: 'Предплечье на стене, лёгкий нажим. Лопатка прижата к рёбрам, плечо не вздёрнуто. Скользи вверх.',
        setup: 'Лицом к стене, предплечье и ладонь на стене, локоть на уровне плеча, лёгкий нажим в стену.',
        movement: 'Скользить предплечьем вверх по стене, не поднимая плечо к уху; лопатка «приклеена» к рёбрам. Вернуть медленно. Все повторы на одну руку, потом на другую.',
        mistakes: 'Плечо поднимается, лопатка отрывается от рёбер, корпус отклоняется назад.',
        muscles: 'Передняя зубчатая, нижняя трапеция', machine: 'Свободная стена.',
        meta: { pattern: 'scapular-control', primary: ['scapular-stab'], secondary: ['front-delts'], equipment: ['wall'], tags: [] },
      },
      {
        id: 'scap-band-row', name: 'Тяга лёгкой резинки к поясу', nameEn: 'light band row', sec: 40,
        reps: { min: 10, max: 12 },
        hint: 'Локти вдоль корпуса. Сведи лопатки, работает спина, а не шея. Без резинки: локти назад к корпусу.',
        setup: 'Резинка закреплена на уровне пояса или за стойкой, лёгкое натяжение, корпус вертикально, руки перед собой.',
        movement: 'Локти назад вдоль корпуса, свести лопатки, пауза 1 с, медленно вернуть, на выдохе. Без резинки — то же движение с пустыми руками.',
        mistakes: 'Плечи к ушам, раскачка корпусом, слишком тугая резинка.',
        muscles: 'Середина спины, стабилизаторы лопатки', machine: 'Лёгкая резинка для фитнеса или блок с минимальным весом.',
        meta: { pattern: 'horizontal-pull', primary: ['scapular-stab', 'mid-back'], secondary: ['rear-delts', 'biceps'], equipment: ['band'], tags: [] },
      },
      {
        id: 'wall-push-plus', name: 'Выталкивание от стены', nameEn: 'wall push-up plus', sec: 30,
        reps: { min: 8, max: 10 },
        hint: 'Ладони на стене, руки прямые. Слегка вытолкни корпус от стены, лопатки раздвигаются.',
        setup: 'Лицом к стене на расстоянии шага, ладони на стене на уровне плеч, руки почти прямые, корпус одной линией.',
        movement: 'Слегка вытолкнуть корпус от стены, дав лопаткам разойтись в стороны, вернуться. Локти почти не сгибаются, на выдохе.',
        mistakes: 'Прогиб в пояснице, плечи к ушам, сгибание локтей как в отжимании.',
        muscles: 'Передняя зубчатая мышца', machine: 'Свободная стена.',
        meta: { pattern: 'scapular-control', primary: ['scapular-stab'], secondary: ['chest', 'front-delts'], equipment: ['wall'], tags: ['wrist_load'] },
      },
    ],
  },
};

// Подходы и отдых для упражнений зон внимания: короче обычных, это не силовая работа
export const CORR_SETS = 2;
export const CORR_REST_SEC = 30;

export const FOCUS_SIDES = { left: 'Левая', right: 'Правая', both: 'Обе' };
export const FOCUS_MODES = { home: 'Дома, в комплексе «Осанка и лопатка»', inline: 'В зале, как упражнения тренировки', block: 'В зале, коротким блоком перед тренировкой' };
const SIDE_WORD = { left: 'левая', right: 'правая' };
const OTHER = { left: 'right', right: 'left' };

// Упражнения зон в виде записей для приложения (как в data.js) и их описание для каталога
const full = [];
export const CORRECTIVE_META = {};
for (const [zone, a] of Object.entries(FOCUS_AREAS)) {
  for (const x of a.exercises) {
    const { meta, hint, sec, ...rec } = x;
    full.push({ ...rec, fromPhase: 'p1', loadType: 'bodyweight', unit: 'kg', weightStep: 1, progression: 'repsOnly', sets: CORR_SETS, restSec: CORR_REST_SEC, zone, corrective: true });
    CORRECTIVE_META[x.id] = { ...meta, secondary: meta.secondary || [], corrective: true };
  }
}
export const CORRECTIVE_EXERCISES = full;

// Включённые зоны из настроек: только известные, без повторов; сторона и режим по умолчанию — «обе» и «в тренировках»
export function activeFocus(settings) {
  const seen = new Set();
  const out = [];
  for (const f of (settings && settings.focus) || []) {
    if (!f || !FOCUS_AREAS[f.id] || seen.has(f.id)) continue;
    seen.add(f.id);
    out.push({ id: f.id, side: FOCUS_SIDES[f.side] ? f.side : 'both', mode: FOCUS_MODES[f.mode] ? f.mode : 'home' });
  }
  return out;
}

export function toggleFocus(list, id) {
  const l = list || [];
  if (!FOCUS_AREAS[id]) return l;
  return l.some((f) => f.id === id) ? l.filter((f) => f.id !== id) : [...l, { id, side: 'both', mode: 'home' }];
}
export function setFocusSide(list, id, side) {
  return FOCUS_SIDES[side] ? (list || []).map((f) => (f.id === id ? { ...f, side } : f)) : list || [];
}
export function setFocusMode(list, id, mode) {
  return FOCUS_MODES[mode] ? (list || []).map((f) => (f.id === id ? { ...f, mode } : f)) : list || [];
}

const idsOf = (settings, mode) => activeFocus(settings).filter((f) => f.mode === mode).flatMap((f) => FOCUS_AREAS[f.id].exercises.map((x) => x.id));
// Упражнения, которые встают в начало силовых тренировок (режим «в тренировках»)
export const inlineExerciseIds = (settings) => idsOf(settings, 'inline');

// План одной зоны: плоский список шагов { areaId, id, name, hint, sec, side? }.
// Упражнение «на одну сторону» делается сначала на выбранной стороне (полное время), затем на другой (вдвое короче).
// «Обе» — поровну, левая первой.
export function areaPlan(id, side = 'both') {
  const a = FOCUS_AREAS[id];
  if (!a) return [];
  const plan = [];
  for (const it of a.exercises) {
    if (!it.perSide || !a.sided) { plan.push({ areaId: id, id: it.id, name: it.name, hint: it.hint, sec: it.sec }); continue; }
    const order = side === 'both' || !OTHER[side] ? [['left', it.sec], ['right', it.sec]] : [[side, it.sec], [OTHER[side], Math.round(it.sec / 2)]];
    for (const [sd, sec] of order) plan.push({ areaId: id, id: it.id, name: `${it.name} (${SIDE_WORD[sd]})`, hint: it.hint, sec, side: sd });
  }
  return plan;
}

// План отдельного блока в зале (режим «блоком»)
export function focusPlan(settings) {
  return activeFocus(settings).filter((f) => f.mode === 'block').flatMap((f) => areaPlan(f.id, f.side));
}

// Домашний комплекс «Осанка и лопатка»: зоны в режиме «дома»; если таких нет, берётся лопатка на обе стороны
export function homeFocusPlan(settings) {
  const home = activeFocus(settings).filter((f) => f.mode === 'home');
  return (home.length ? home : [{ id: 'scapula', side: 'both' }]).flatMap((f) => areaPlan(f.id, f.side));
}

// Один раз при переходе на v29: зоны, которые стояли «в тренировках» (так было по умолчанию в v28), переезжают домой.
// Возвращает новый список или тот же, если переносить нечего. Флаг focusV29 ставит вызывающий.
export function migrateFocus(settings) {
  if (!settings || settings.focusV29) return settings && settings.focus;
  return (settings.focus || []).map((f) => (f && f.mode === 'inline' ? { ...f, mode: 'home' } : f));
}

export const planSeconds = (plan) => plan.reduce((t, x) => t + x.sec, 0);
export const planMinutes = (plan) => Math.max(1, Math.round(planSeconds(plan) / 60));

// Подсказка про порядок сторон в упражнении «на сторону»: «Начни с левой стороны»; иначе пусто
export function sideNote(settings, ex) {
  if (!ex || !ex.corrective || !(ex.reps && ex.reps.perSide)) return '';
  const f = activeFocus(settings).find((x) => x.id === ex.zone);
  if (!f || !FOCUS_AREAS[f.id].sided) return '';
  return f.side === 'both' ? 'Начни с левой стороны.' : `Начни с ${SIDE_WORD[f.side].replace('ая', 'ой')} стороны и сделай её полностью, вторую можно короче.`;
}

// Подписи включённых зон: «Лопатка (левая)», «Лопатка»
export function focusLabel(settings) {
  return activeFocus(settings).map((f) => {
    const a = FOCUS_AREAS[f.id];
    return a.sided && f.side !== 'both' ? `${a.name} (${SIDE_WORD[f.side]})` : a.name;
  });
}
