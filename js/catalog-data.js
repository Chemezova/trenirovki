// Каталог упражнений: только данные, без логики (логика — в catalog.js).
// Формат сделан так, чтобы целиком переехать в JSON и таблицы базы данных:
// всё ссылается друг на друга по постоянным id, тексты на русском лежат в поле name.
// Подробности и план — CATALOG.md в проекте.

export const SCHEMA_VERSION = 1;

// Группы мышц (для подписей и будущих фильтров)
export const MUSCLE_GROUPS = {
  legs: 'Ноги', glutes: 'Ягодицы', back: 'Спина', shoulders: 'Плечи', chest: 'Грудь', arms: 'Руки', core: 'Кор',
};

export const MUSCLES = {
  quads: { name: 'Передняя поверхность бедра', group: 'legs' },
  hamstrings: { name: 'Задняя поверхность бедра', group: 'legs' },
  adductors: { name: 'Внутренняя поверхность бедра', group: 'legs' },
  calves: { name: 'Икры', group: 'legs' },
  'hip-flexors': { name: 'Сгибатели бедра', group: 'legs' },
  'glutes-max': { name: 'Большая ягодичная', group: 'glutes' },
  'glutes-med': { name: 'Средняя ягодичная', group: 'glutes' },
  lats: { name: 'Широчайшие', group: 'back' },
  'mid-back': { name: 'Середина спины', group: 'back' },
  'spinal-extensors': { name: 'Разгибатели спины', group: 'back' },
  'rear-delts': { name: 'Задняя дельта', group: 'shoulders' },
  'side-delts': { name: 'Средняя дельта', group: 'shoulders' },
  'front-delts': { name: 'Передняя дельта', group: 'shoulders' },
  chest: { name: 'Грудные', group: 'chest' },
  biceps: { name: 'Бицепс', group: 'arms' },
  triceps: { name: 'Трицепс', group: 'arms' },
  'core-deep': { name: 'Глубокие мышцы живота', group: 'core' },
  obliques: { name: 'Косые мышцы живота', group: 'core' },
  abs: { name: 'Прямая мышца живота (пресс)', group: 'core' },
};

// Тренажёры и инвентарь. У упражнения первым в списке стоит главный.
export const EQUIPMENT = {
  dumbbells: { name: 'Гантели' },
  bench: { name: 'Скамья или ящик' },
  platform: { name: 'Платформа 20–30 см' },
  support: { name: 'Опора (стойка, перила)' },
  mat: { name: 'Коврик' },
  'leg-extension-machine': { name: 'Тренажёр разгибания ног' },
  'leg-curl-machine': { name: 'Тренажёр сгибания ног' },
  'lat-pulldown-machine': { name: 'Тренажёр тяги сверху' },
  'hip-abduction-machine': { name: 'Тренажёр разведения и сведения бёдер' },
  'cable-machine': { name: 'Кроссовер' },
  'ankle-cuff': { name: 'Манжета на щиколотку' },
  'chest-press-machine': { name: 'Тренажёр жима от груди' },
  'pec-deck-machine': { name: 'Тренажёр «бабочка»' },
  'row-station': { name: 'Горизонтальная тяга (скамья и блок)' },
  'chest-supported-row-machine': { name: 'Тренажёр тяги с упором грудью' },
  'glute-machine': { name: 'Ягодичный тренажёр' },
  'lying-leg-curl-machine': { name: 'Тренажёр сгибания ног лёжа' },
  'seated-calf-machine': { name: 'Тренажёр для икр сидя' },
  'assisted-pullup-machine': { name: 'Гравитрон' },
  'incline-press-machine': { name: 'Наклонный жимовой тренажёр' },
  'lateral-raise-machine': { name: 'Тренажёр махов в стороны' },
  'biceps-curl-machine': { name: 'Тренажёр сгибания рук' },
  'triceps-machine': { name: 'Тренажёр разгибания рук' },
  wall: { name: 'Стена' },
  'captain-chair': { name: 'Римский стул (упор на локтях)' },
  'ab-crunch-machine': { name: 'Тренажёр для пресса' },
};

// Метки риска — свойства самого упражнения (не человека).
// Ограничения (ниже) говорят, какие метки для них «нельзя» или «осторожно».
export const RISK_TAGS = {
  head_below_heart: { name: 'Голова ниже сердца' },
  inverted: { name: 'Перевёрнутая поза' },
  hip_above_head: { name: 'Таз выше головы' },
  impact: { name: 'Ударная нагрузка (прыжки)' },
  heavy_axial_load: { name: 'Тяжёлая нагрузка на позвоночник' },
  breath_hold_risk: { name: 'Тянет задержать дыхание' },
  head_position_cue: { name: 'Нужно следить за положением головы' },
  deep_knee_flexion: { name: 'Глубокое сгибание колен' },
  intra_abdominal_pressure: { name: 'Давление на пресс и тазовое дно' },
  lying_supine: { name: 'Лёжа на спине' },
  lying_prone: { name: 'Лёжа на животе' },
  twist: { name: 'Скручивание корпуса' },
  overhead_press: { name: 'Жим над головой' },
  wrist_load: { name: 'Нагрузка на запястья' },
  neck_load: { name: 'Нагрузка на шею' },
  balance_demand: { name: 'Нужен баланс' },
  shoulder_load: { name: 'Нагрузка на плечевые суставы' },
};

// Ограничения. kind: 'condition' — постоянное (живёт в настройках),
// 'state' — на сегодня (отмечается в «Как ты сегодня?»).
// review: 'draft' — правило написано как черновик и ждёт проверки врачом или реабилитологом.
export const CONDITIONS = {
  eyes: {
    kind: 'condition', name: 'Глаза', review: 'draft',
    source: 'Правила Елены из SAFETY, STOP_MAIN и SWAPS в data.js',
    rules: [
      { tag: 'head_below_heart', level: 'avoid', why: 'голова ниже сердца' },
      { tag: 'inverted', level: 'avoid', why: 'перевёрнутая поза' },
      { tag: 'hip_above_head', level: 'avoid', why: 'таз выше головы' },
      { tag: 'impact', level: 'avoid', why: 'ударная нагрузка' },
      { tag: 'heavy_axial_load', level: 'avoid', why: 'тяжёлая нагрузка на позвоночник' },
      { tag: 'breath_hold_risk', level: 'caution', why: 'тянет задержать дыхание: вес лёгкий, дыши свободно' },
      { tag: 'head_position_cue', level: 'caution', why: 'следи, чтобы голова не опускалась' },
    ],
  },
  'critical-days': {
    kind: 'state', name: 'Критические дни', review: 'draft',
    source: 'Правило Елены: без перевёрнутых поз. Остальное — черновик, нужна проверка специалистом',
    rules: [
      { tag: 'inverted', level: 'avoid', why: 'перевёрнутые позы в эти дни лучше не делать' },
      { tag: 'hip_above_head', level: 'caution', why: 'таз выше головы: в эти дни осторожно' },
      { tag: 'head_below_heart', level: 'caution', why: 'голова ниже сердца: в эти дни осторожно' },
    ],
  },
};

// Группа мышц в винительном падеже («нагрузка на …») — для подсказок
export const GROUP_ACC = { legs: 'ноги', glutes: 'ягодицы', back: 'спину', shoulders: 'плечи', chest: 'грудь', arms: 'руки', core: 'кор' };

// Роль движения: низ тела, тяга, жим (верх тела) или кор. Нужна, чтобы понять, какие упражнения хорошо идут парой.
export const PATTERN_ROLE = {
  squat: 'lower', step: 'lower', lunge: 'lower', 'hip-extension': 'lower', 'hip-abduction': 'lower', 'hip-adduction': 'lower',
  'knee-extension': 'lower', 'knee-flexion': 'lower', 'calf-raise': 'lower', 'hip-flexion': 'lower',
  'vertical-pull': 'pull', 'horizontal-pull': 'pull', 'rear-delt-pull': 'pull', 'lat-isolation': 'pull', 'elbow-flexion': 'pull',
  'horizontal-push': 'push', 'incline-push': 'push', 'chest-fly': 'push', 'lateral-raise': 'push', 'elbow-extension': 'push',
  'core-stability': 'core', 'anti-rotation': 'core', rotation: 'core', 'lateral-flexion': 'core', carry: 'core', 'leg-raise': 'core', 'trunk-flexion': 'core', 'upright-row': 'pull',
};

// Пары движений-«противников»: одна мышца работает, пока другая отдыхает
export const ANTAGONIST_PATTERNS = [
  ['knee-extension', 'knee-flexion'], ['hip-abduction', 'hip-adduction'], ['elbow-flexion', 'elbow-extension'],
  ['horizontal-push', 'horizontal-pull'], ['chest-fly', 'rear-delt-pull'], ['incline-push', 'vertical-pull'], ['horizontal-push', 'vertical-pull'],
];

// Какие движения считаются «родственными» (для оценки похожести при замене)
export const PATTERN_FAMILY = {
  squat: 'legs-compound', step: 'legs-compound', lunge: 'legs-compound',
  'horizontal-push': 'push', 'incline-push': 'push', 'chest-fly': 'push-fly',
  'vertical-pull': 'pull', 'horizontal-pull': 'pull',
  'core-stability': 'core', 'anti-rotation': 'core', rotation: 'core', 'lateral-flexion': 'core', carry: 'core', 'leg-raise': 'core', 'trunk-flexion': 'core',
};

// Свойства упражнений по их id из data.js / programs.js (аквааэробика сюда не входит).
// primary — основные мышцы, secondary — помогающие; equipment[0] — главный тренажёр.
export const EXERCISE_META = {
  'goblet-box-squat': { pattern: 'squat', primary: ['quads', 'glutes-max'], secondary: [], equipment: ['dumbbells', 'bench'], tags: [] },
  'tempo-box-squat': { pattern: 'squat', primary: ['quads', 'glutes-max'], secondary: [], equipment: ['dumbbells', 'bench'], tags: [] },
  'leg-extension': { pattern: 'knee-extension', primary: ['quads'], secondary: [], equipment: ['leg-extension-machine'], tags: [] },
  'single-leg-extension': { pattern: 'knee-extension', primary: ['quads'], secondary: [], equipment: ['leg-extension-machine'], tags: [] },
  'seated-leg-curl': { pattern: 'knee-flexion', primary: ['hamstrings'], secondary: [], equipment: ['leg-curl-machine'], tags: [] },
  'standing-cable-leg-curl': { pattern: 'knee-flexion', primary: ['hamstrings'], secondary: [], equipment: ['cable-machine', 'ankle-cuff'], tags: ['balance_demand', 'head_position_cue'] },
  'lat-pulldown': { pattern: 'vertical-pull', primary: ['lats'], secondary: ['biceps'], equipment: ['lat-pulldown-machine'], tags: [] },
  'single-arm-pulldown': { pattern: 'vertical-pull', primary: ['lats'], secondary: ['biceps'], equipment: ['lat-pulldown-machine'], tags: [] },
  'hip-abduction': { pattern: 'hip-abduction', primary: ['glutes-med'], secondary: [], equipment: ['hip-abduction-machine'], tags: [] },
  'cable-hip-abduction': { pattern: 'hip-abduction', primary: ['glutes-med'], secondary: [], equipment: ['cable-machine', 'ankle-cuff'], tags: ['balance_demand'] },
  'hip-adduction': { pattern: 'hip-adduction', primary: ['adductors'], secondary: [], equipment: ['hip-abduction-machine'], tags: [] },
  'dead-bug': { pattern: 'core-stability', primary: ['core-deep'], secondary: [], equipment: ['mat'], tags: ['lying_supine'] },
  'bird-dog': { pattern: 'core-stability', primary: ['spinal-extensors', 'core-deep'], secondary: ['glutes-max'], equipment: ['mat'], tags: ['head_position_cue'] },
  'pallof-press': { pattern: 'anti-rotation', primary: ['core-deep', 'obliques'], secondary: [], equipment: ['cable-machine'], tags: ['breath_hold_risk'] },
  'supported-row': { pattern: 'horizontal-pull', primary: ['lats', 'mid-back'], secondary: ['rear-delts', 'biceps'], equipment: ['dumbbells', 'support'], tags: ['head_position_cue'] },
  'seated-row': { pattern: 'horizontal-pull', primary: ['mid-back'], secondary: ['lats', 'rear-delts', 'biceps'], equipment: ['row-station'], tags: [] },
  'chest-supported-row': { pattern: 'horizontal-pull', primary: ['mid-back'], secondary: ['rear-delts', 'lats'], equipment: ['chest-supported-row-machine'], tags: [] },
  'single-arm-cable-row': { pattern: 'horizontal-pull', primary: ['mid-back'], secondary: ['lats', 'core-deep'], equipment: ['cable-machine'], tags: [] },
  'face-pull': { pattern: 'rear-delt-pull', primary: ['rear-delts'], secondary: ['mid-back'], equipment: ['cable-machine'], tags: [] },
  'step-up': { pattern: 'step', primary: ['glutes-max', 'quads'], secondary: [], equipment: ['platform', 'support'], tags: ['balance_demand'] },
  'supported-reverse-lunge': { pattern: 'lunge', primary: ['glutes-max', 'quads'], secondary: [], equipment: ['support'], tags: ['balance_demand'] },
  'cable-kickback': { pattern: 'hip-extension', primary: ['glutes-max'], secondary: ['hamstrings'], equipment: ['cable-machine', 'ankle-cuff'], tags: ['balance_demand', 'head_position_cue'] },
  'paused-cable-kickback': { pattern: 'hip-extension', primary: ['glutes-max'], secondary: ['hamstrings'], equipment: ['cable-machine', 'ankle-cuff'], tags: ['balance_demand', 'head_position_cue'] },
  'chest-press': { pattern: 'horizontal-push', primary: ['chest'], secondary: ['front-delts', 'triceps'], equipment: ['chest-press-machine'], tags: [] },
  'pec-deck': { pattern: 'chest-fly', primary: ['chest'], secondary: ['front-delts'], equipment: ['pec-deck-machine'], tags: [] },
  'lateral-raise': { pattern: 'lateral-raise', primary: ['side-delts'], secondary: [], equipment: ['dumbbells'], tags: [] },
  'cable-lateral-raise': { pattern: 'lateral-raise', primary: ['side-delts'], secondary: [], equipment: ['cable-machine'], tags: [] },
  'dumbbell-curl': { pattern: 'elbow-flexion', primary: ['biceps'], secondary: [], equipment: ['dumbbells'], tags: [] },
  'triceps-pushdown': { pattern: 'elbow-extension', primary: ['triceps'], secondary: [], equipment: ['cable-machine'], tags: [] },
  'standing-calf-raise': { pattern: 'calf-raise', primary: ['calves'], secondary: [], equipment: ['support'], tags: [] },

  // Типовые упражнения универсального зала (описания — в exercises-extra.js)
  'lying-leg-curl': { pattern: 'knee-flexion', primary: ['hamstrings'], secondary: [], equipment: ['lying-leg-curl-machine'], tags: ['lying_prone', 'head_position_cue'] },
  'glute-kickback-machine': { pattern: 'hip-extension', primary: ['glutes-max'], secondary: ['hamstrings'], equipment: ['glute-machine'], tags: [] },
  'cable-hip-adduction': { pattern: 'hip-adduction', primary: ['adductors'], secondary: [], equipment: ['cable-machine', 'ankle-cuff'], tags: ['balance_demand'] },
  'seated-calf-raise': { pattern: 'calf-raise', primary: ['calves'], secondary: [], equipment: ['seated-calf-machine'], tags: [] },
  'assisted-pullup': { pattern: 'vertical-pull', primary: ['lats'], secondary: ['biceps'], equipment: ['assisted-pullup-machine'], tags: ['breath_hold_risk'] },
  'straight-arm-pulldown': { pattern: 'lat-isolation', primary: ['lats'], secondary: [], equipment: ['cable-machine'], tags: ['head_position_cue'] },
  'reverse-pec-deck': { pattern: 'rear-delt-pull', primary: ['rear-delts'], secondary: ['mid-back'], equipment: ['pec-deck-machine'], tags: [] },
  'cable-chest-fly': { pattern: 'chest-fly', primary: ['chest'], secondary: ['front-delts'], equipment: ['cable-machine'], tags: ['balance_demand'] },
  'incline-chest-press': { pattern: 'incline-push', primary: ['chest'], secondary: ['front-delts', 'triceps'], equipment: ['incline-press-machine'], tags: ['breath_hold_risk'] },
  'wall-pushup': { pattern: 'horizontal-push', primary: ['chest'], secondary: ['front-delts', 'triceps'], equipment: ['wall'], tags: [] },
  'machine-lateral-raise': { pattern: 'lateral-raise', primary: ['side-delts'], secondary: [], equipment: ['lateral-raise-machine'], tags: [] },
  'cable-curl': { pattern: 'elbow-flexion', primary: ['biceps'], secondary: [], equipment: ['cable-machine'], tags: [] },
  'machine-biceps-curl': { pattern: 'elbow-flexion', primary: ['biceps'], secondary: [], equipment: ['biceps-curl-machine'], tags: [] },
  'triceps-extension-machine': { pattern: 'elbow-extension', primary: ['triceps'], secondary: [], equipment: ['triceps-machine'], tags: [] },
  'supported-march': { pattern: 'hip-flexion', primary: ['hip-flexors', 'core-deep'], secondary: [], equipment: ['support'], tags: ['balance_demand'] },

  // Гантели, обратные отжимания, пресс без коврика (v25)
  'dumbbell-forward-lunge': { pattern: 'lunge', primary: ['quads', 'glutes-max'], secondary: ['hamstrings'], equipment: ['dumbbells', 'support'], tags: ['balance_demand'] },
  'dumbbell-reverse-lunge': { pattern: 'lunge', primary: ['glutes-max', 'quads'], secondary: ['hamstrings'], equipment: ['dumbbells', 'support'], tags: ['balance_demand'] },
  'dumbbell-cross-lunge': { pattern: 'lunge', primary: ['glutes-max', 'glutes-med'], secondary: ['quads', 'adductors'], equipment: ['dumbbells', 'support'], tags: ['balance_demand'] },
  'dumbbell-sumo-squat': { pattern: 'squat', primary: ['quads', 'glutes-max', 'adductors'], secondary: [], equipment: ['dumbbells', 'bench'], tags: [] },
  'dumbbell-upright-row': { pattern: 'upright-row', primary: ['side-delts', 'mid-back'], secondary: ['biceps'], equipment: ['dumbbells'], tags: ['shoulder_load'] },
  'reverse-bench-dip': { pattern: 'elbow-extension', primary: ['triceps'], secondary: ['chest', 'front-delts'], equipment: ['bench'], tags: ['shoulder_load', 'wrist_load', 'breath_hold_risk'] },
  'cable-woodchop': { pattern: 'rotation', primary: ['obliques', 'core-deep'], secondary: [], equipment: ['cable-machine'], tags: ['twist'] },
  'dumbbell-side-bend': { pattern: 'lateral-flexion', primary: ['obliques', 'core-deep'], secondary: [], equipment: ['dumbbells'], tags: [] },
  'farmer-carry': { pattern: 'carry', primary: ['core-deep', 'obliques'], secondary: ['mid-back'], equipment: ['dumbbells'], tags: ['breath_hold_risk'] },
  'seated-knee-tuck': { pattern: 'leg-raise', primary: ['abs', 'core-deep'], secondary: ['hip-flexors'], equipment: ['bench'], tags: ['breath_hold_risk', 'intra_abdominal_pressure'] },
  'captain-chair-knee-raise': { pattern: 'leg-raise', primary: ['abs', 'core-deep'], secondary: ['hip-flexors'], equipment: ['captain-chair'], tags: ['breath_hold_risk', 'intra_abdominal_pressure'] },
  'machine-ab-crunch': { pattern: 'trunk-flexion', primary: ['abs'], secondary: ['obliques', 'core-deep'], equipment: ['ab-crunch-machine'], tags: ['breath_hold_risk', 'intra_abdominal_pressure'] },
};
