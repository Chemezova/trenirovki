// Программы тренировок: установочные, комплексы-миксы и папки блогеров (из «Моих видео»)
import { EXERCISES, EX_BY_ID } from './data.js';

// Дополнительные упражнения для миксов — все проверены по ограничениям: без задержки дыхания,
// без прыжков, голова не ниже сердца, без тяжёлых базовых
const EXTRA = [
  {
    id: 'hip-adduction', name: 'Сведение бёдер в тренажёре', nameEn: 'hip adduction machine', fromPhase: 'p1',
    reps: { min: 12, max: 15 }, loadType: 'machine', unit: 'plate', weightStep: 1, progression: 'double',
    setup: 'Спина прижата к спинке, подушки с внутренней стороны колен, ноги разведены на комфортную ширину.',
    movement: 'Свести колени на выдохе, пауза 1 с, медленно развести обратно, не до касания плит.',
    mistakes: 'Рывок, слишком широкий старт — тянет пах, наклон корпуса вперёд.',
  },
  {
    id: 'standing-calf-raise', name: 'Подъём на носки стоя у опоры', nameEn: 'standing calf raise', fromPhase: 'p1',
    reps: { min: 12, max: 20 }, loadType: 'bodyweight', unit: 'kg', weightStep: 1, progression: 'repsOnly',
    setup: 'Стоя прямо, руки на опоре, носки на краю невысокой ступеньки или на полу.',
    movement: 'Подняться на носки на выдохе, пауза 1 с наверху, медленно опуститься.',
    mistakes: 'Пружинить, заваливать стопу наружу, наклоняться вперёд.',
  },
  {
    id: 'supported-reverse-lunge', name: 'Обратный выпад у опоры', nameEn: 'supported reverse lunge', fromPhase: 'p1',
    reps: { min: 10, max: 12, perSide: true }, loadType: 'bodyweight', unit: 'kg', weightStep: 1, progression: 'repsOnly',
    setup: 'Боком к опоре, рука на ней, стопы на ширине таза.',
    movement: 'Шаг назад, опуститься до комфортной глубины, вернуться, толкаясь передней ногой, на выдохе. Все повторы на одну ногу, потом на другую.',
    mistakes: 'Колено передней ноги уходит внутрь, корпус падает вперёд, слишком короткий шаг.',
  },
  {
    id: 'cable-hip-abduction', name: 'Отведение ноги в сторону в кроссовере', nameEn: 'standing cable hip abduction', fromPhase: 'p1',
    reps: { min: 12, max: 15, perSide: true }, loadType: 'cable', unit: 'plate', weightStep: 1, progression: 'double',
    setup: 'Манжета на щиколотке дальней от блока ноги, нижний блок, боком к тренажёру, рука на раме, корпус вертикально.',
    movement: 'Отвести прямую ногу в сторону силой ягодицы на выдохе, пауза, вернуть медленно.',
    mistakes: 'Наклон корпуса в сторону, мах, разворот носка вверх.',
  },
  {
    id: 'standing-cable-leg-curl', name: 'Сгибание ноги стоя в кроссовере', nameEn: 'standing cable leg curl', fromPhase: 'p1',
    reps: { min: 12, max: 15, perSide: true }, loadType: 'cable', unit: 'plate', weightStep: 1, progression: 'double',
    setup: 'Манжета на щиколотке, нижний блок, лицом к тренажёру, руки на раме, корпус почти вертикально.',
    movement: 'Согнуть ногу в колене, пятку к ягодице, на выдохе; медленно вернуть.',
    mistakes: 'Бедро уходит вперёд, прогиб в пояснице, наклон головы вниз.',
    eyeNote: 'Корпус почти вертикально, голову не опускать.',
  },
  {
    id: 'chest-supported-row', name: 'Тяга в тренажёре с упором грудью', nameEn: 'chest supported row machine', fromPhase: 'p1',
    loadType: 'machine', unit: 'plate', weightStep: 1, progression: 'double',
    setup: 'Сиденье так, чтобы грудь лежала на упоре, а рукояти были на уровне низа груди. Голова продолжает позвоночник.',
    movement: 'Потянуть рукояти к себе, сводя лопатки, локти вдоль корпуса, на выдохе; вернуть медленно.',
    mistakes: 'Грудь отрывается от упора, плечи к ушам, рывок.',
  },
  {
    id: 'face-pull', name: 'Тяга каната к лицу', nameEn: 'cable face pull', fromPhase: 'p1',
    reps: { min: 12, max: 15 }, loadType: 'cable', unit: 'plate', weightStep: 1, progression: 'double', topSessions: 2,
    setup: 'Блок на уровне лица, канатная рукоять, шаг назад до натяжения, стоя прямо.',
    movement: 'Тянуть канат к переносице, разводя концы и локти в стороны на уровне плеч, на выдохе; вернуть медленно.',
    mistakes: 'Слишком большой вес — корпус откидывается назад, плечи поднимаются к ушам.',
  },
  {
    id: 'bird-dog', name: '«Птица-собака»', nameEn: 'bird dog exercise', fromPhase: 'p1',
    reps: { min: 8, max: 10, perSide: true }, loadType: 'bodyweight', unit: 'kg', weightStep: 1, progression: 'repsOnly',
    setup: 'На четвереньках на коврике: ладони под плечами, колени под тазом, голова на линии позвоночника, взгляд в пол перед руками.',
    movement: 'На выдохе вытянуть вперёд правую руку и назад левую ногу, задержаться на 2 с, дыша свободно, вернуть. Потом другая пара.',
    mistakes: 'Опускать голову ниже линии спины, прогибаться в пояснице, заваливать таз в сторону.',
    eyeNote: 'Голова на линии спины, не опускать ниже.',
  },
  {
    id: 'pec-deck', name: 'Сведение рук в тренажёре «бабочка»', nameEn: 'pec deck machine', fromPhase: 'p1',
    loadType: 'machine', unit: 'plate', weightStep: 1, progression: 'double',
    setup: 'Сиденье так, чтобы рукояти были на уровне груди, спина прижата, локти чуть согнуты.',
    movement: 'Свести руки перед грудью на выдохе, пауза 1 с, медленно развести до лёгкого растяжения.',
    mistakes: 'Отрывать спину, разводить слишком широко, сгибать руки как в жиме.',
  },
  {
    id: 'triceps-pushdown', name: 'Разгибание рук на блоке стоя', nameEn: 'cable triceps pushdown', fromPhase: 'p1',
    reps: { min: 12, max: 15 }, loadType: 'cable', unit: 'plate', weightStep: 1, progression: 'double',
    setup: 'Верхний блок, прямая или канатная рукоять, стоя прямо, локти прижаты к корпусу.',
    movement: 'Разогнуть руки вниз до конца на выдохе, медленно вернуть до угла 90°.',
    mistakes: 'Локти уходят вперёд, корпус наклоняется и давит весом, плечи к ушам.',
  },
];
// Вариации для фазы «Закрепление» (недели 9–13): тот же паттерн движения, но сложнее.
// progressFrom + startFactor — стартовый вес считается от веса в исходном упражнении.
const VARIATIONS = [
  {
    id: 'tempo-box-squat', progressFrom: 'goblet-box-squat', startFactor: 1, name: 'Присед к скамье в медленном темпе', nameEn: 'tempo goblet box squat', fromPhase: 'p3',
    loadType: 'dumbbell', unit: 'kg', weightStep: 1, progression: 'double',
    setup: 'Как в обычном приседе к скамье: спиной к скамье, гантель вертикально у груди, стопы чуть шире плеч.',
    movement: 'Опускаться 3 с, легко коснуться скамьи и сразу встать на выдохе за 1–2 с. Дышать на каждом повторе — без пауз с задержкой.',
    mistakes: 'Плюхаться на скамью, задерживать дыхание на медленной фазе, колени внутрь.',
    why: 'Медленный спуск нагружает мышцы дольше — больше пользы без тяжёлого веса.',
  },
  {
    id: 'single-leg-extension', progressFrom: 'leg-extension', startFactor: 0.5, name: 'Разгибание ноги сидя — по одной', nameEn: 'single leg extension', fromPhase: 'p3',
    reps: { min: 10, max: 12, perSide: true }, loadType: 'machine', unit: 'plate', weightStep: 1, progression: 'double',
    setup: 'Тот же тренажёр: колено напротив оси, валик на подъёме стопы, вторая нога свободно стоит на подножке.',
    movement: 'Выпрямить одну ногу на выдохе, пауза 1 с, опустить за 2–3 с. Все повторы одной ногой, потом другой.',
    mistakes: 'Помогать второй ногой, рывок, таз съезжает с сиденья.',
    why: 'Выравнивает силу правой и левой ноги — меньше нагрузки на колени.',
  },
  {
    id: 'single-arm-pulldown', progressFrom: 'lat-pulldown', startFactor: 0.5, name: 'Тяга верхнего блока одной рукой', nameEn: 'single arm lat pulldown', fromPhase: 'p3',
    reps: { min: 10, max: 12, perSide: true }, loadType: 'cable', unit: 'plate', weightStep: 1, progression: 'double',
    setup: 'Тот же тренажёр или кроссовер, одиночная рукоять. Бёдра под валиком, корпус чуть назад, свободная рука на бедре.',
    movement: 'Опустить плечо от уха, потянуть рукоять к плечу, локоть вниз вдоль корпуса, на выдохе. Вернуть медленно до прямой руки.',
    mistakes: 'Разворот корпуса за рукой, плечо к уху, рывок.',
    why: 'Каждая сторона спины работает отдельно — лучше чувствуется мышца и выравнивается осанка.',
  },
  {
    id: 'cable-lateral-raise', progressFrom: 'lateral-raise', startFactor: null, name: 'Отведение руки в сторону на нижнем блоке', nameEn: 'cable lateral raise', fromPhase: 'p3',
    reps: { min: 10, max: 15, perSide: true }, loadType: 'cable', unit: 'plate', weightStep: 1, progression: 'repsThenWeight',
    setup: 'Боком к кроссоверу, нижний блок, рукоять в дальней руке, трос проходит перед телом. Свободная рука на раме, стоя прямо.',
    movement: 'Отвести руку в сторону до уровня плеча, ведёт локоть, на выдохе; опустить за 2–3 с.',
    mistakes: 'Выше плеч, плечо к уху, наклон корпуса от блока.',
    why: 'Блок держит напряжение по всей амплитуде — плечи работают ровнее, чем с гантелью.',
  },
  {
    id: 'paused-cable-kickback', progressFrom: 'cable-kickback', startFactor: 1, name: 'Отведение ноги назад с паузой', nameEn: 'cable kickback with pause', fromPhase: 'p3',
    reps: { min: 12, max: 15, perSide: true }, loadType: 'cable', unit: 'plate', weightStep: 1, progression: 'double',
    setup: 'Как обычно: манжета на щиколотке, нижний блок, лицом к тренажёру, руки на раме, корпус почти вертикально.',
    movement: 'Отвести ногу назад на выдохе, задержать на пике 1 с, продолжая дышать, вернуть за 2–3 с.',
    mistakes: 'Прогиб в пояснице на паузе, мах, наклон с опущенной головой.',
    eyeNote: 'Корпус почти вертикально, голову не опускать.',
    why: 'Пауза на пике сильнее включает ягодицу при том же весе.',
  },
  {
    id: 'single-arm-cable-row', progressFrom: 'seated-row', startFactor: 0.5, name: 'Тяга одной рукой в кроссовере стоя', nameEn: 'standing single arm cable row', fromPhase: 'p3',
    reps: { min: 10, max: 12, perSide: true }, loadType: 'cable', unit: 'plate', weightStep: 1, progression: 'double',
    setup: 'Блок на уровне пояса, одиночная рукоять. Стоя лицом к тренажёру, ноги в небольшом шаге, корпус вертикально, свободная рука на бедре.',
    movement: 'Тянуть рукоять к поясу, локоть назад вдоль корпуса, лопатка к позвоночнику, на выдохе; вернуть медленно.',
    mistakes: 'Разворот корпуса, наклон вперёд за весом, плечо к уху.',
    why: 'Стоя работает ещё и кор: корпус учится не поворачиваться — как в жиме Паллофа.',
  },
];
for (const e of [...EXTRA, ...VARIATIONS]) {
  e.day = null;
  EXERCISES.push(e);
  EX_BY_ID[e.id] = e;
}

// Как выглядит тренажёр и какие мышцы работают
const MACHINE = {
  cable: 'Кроссовер — рама с двумя блоками и тросами; высота блока меняется. Для ноги нужна манжета на щиколотку, для рук — рукоять или канат.',
  dumbbell: 'Гантели на стойке, берёшь пару нужного веса.',
};
const INFO = {
  'goblet-box-squat': ['Ягодицы, передняя поверхность бедра', 'Гантель и скамья или жёсткий ящик за спиной.'],
  'leg-extension': ['Передняя поверхность бедра', 'Сиденье со спинкой, спереди внизу мягкий валик, который ложится на подъём стопы; ручки по бокам.'],
  'seated-leg-curl': ['Задняя поверхность бедра', 'Сиденье со спинкой; сверху на бёдра опускается фиксирующий валик, второй валик — над пятками.'],
  'lat-pulldown': ['Широчайшие мышцы спины, бицепс', 'Высокая стойка с тросом и длинной перекладиной над головой; сиденье с валиками, которые прижимают бёдра.'],
  'hip-abduction': ['Средняя ягодичная, внешняя поверхность бедра', 'Сиденье со спинкой и подушками у коленей. Часто один тренажёр совмещает разведение и сведение — переставляется рычаг.'],
  'hip-adduction': ['Внутренняя поверхность бедра', 'Тот же тренажёр, что для разведения, подушки с внутренней стороны колен.'],
  'dead-bug': ['Глубокие мышцы живота', 'Коврик.'],
  'supported-row': ['Спина, задняя дельта', 'Гантель и скамья или стойка на уровне пояса для опоры рукой.'],
  'step-up': ['Ягодицы, бедро, баланс', 'Устойчивая платформа или степ 20–30 см рядом с опорой.'],
  'chest-press': ['Грудные, передняя дельта, трицепс', 'Сиденье со спинкой и двумя рукоятями по бокам на уровне груди; рукояти толкаются вперёд.'],
  'seated-row': ['Середина спины, ромбовидные', 'Длинная скамья на полу, упоры для стоп, трос от нижнего блока с V-рукоятью.'],
  'lateral-raise': ['Средняя дельта (плечи)', MACHINE.dumbbell],
  'cable-kickback': ['Большая ягодичная', MACHINE.cable],
  'pallof-press': ['Мышцы кора, косые мышцы живота', MACHINE.cable],
  'dumbbell-curl': ['Бицепс', MACHINE.dumbbell],
  'standing-calf-raise': ['Икры, баланс', 'Опора (стойка, станок) и при желании невысокая ступенька.'],
  'supported-reverse-lunge': ['Ягодицы, бедро', 'Опора рядом: стойка, перила, рама тренажёра.'],
  'cable-hip-abduction': ['Средняя ягодичная', MACHINE.cable],
  'standing-cable-leg-curl': ['Задняя поверхность бедра', MACHINE.cable],
  'chest-supported-row': ['Середина спины, задняя дельта', 'Сиденье с упором для груди спереди и двумя рукоятями, которые тянутся к себе.'],
  'face-pull': ['Задняя дельта, мышцы осанки', MACHINE.cable],
  'bird-dog': ['Разгибатели спины, ягодицы, баланс', 'Коврик.'],
  'pec-deck': ['Грудные', 'Сиденье со спинкой и двумя рычагами-«крыльями» по бокам, которые сводятся перед грудью.'],
  'triceps-pushdown': ['Трицепс', 'Верхний блок кроссовера или отдельная стойка с тросом сверху, прямая или канатная рукоять.'],
  'tempo-box-squat': ['Ягодицы, передняя поверхность бедра', 'Гантель и скамья или жёсткий ящик за спиной.'],
  'single-leg-extension': ['Передняя поверхность бедра', 'Тот же тренажёр, что для разгибания ног.'],
  'single-arm-pulldown': ['Широчайшие мышцы спины', 'Тренажёр тяги сверху или кроссовер с одиночной рукоятью.'],
  'cable-lateral-raise': ['Средняя дельта (плечи)', MACHINE.cable],
  'paused-cable-kickback': ['Большая ягодичная', MACHINE.cable],
  'single-arm-cable-row': ['Середина спины, кор', MACHINE.cable],
};
for (const [id, [muscles, machine]] of Object.entries(INFO)) {
  if (EX_BY_ID[id]) Object.assign(EX_BY_ID[id], { muscles, machine });
}

export const FOLDERS = [
  {
    id: 'base', name: 'Установочные тренировки', icon: 'dumbbell',
    desc: 'Основа 13-недельного цикла. Чередуются по неделе: А → кардио → Б. По ним считается прогрессия весов.',
    programs: ['A', 'cardio', 'B'],
  },
  {
    id: 'mix', name: 'Комплексы-миксы', icon: 'star',
    desc: 'Собраны тренером под твои ограничения. Ставь микс вместо А или Б не чаще раза в неделю — так основа не сбивается, а мышцы получают новый стимул.',
    programs: ['legs', 'glutes', 'back', 'upper', 'core', 'light'],
  },
];

export const PROGRAMS = {
  A: {
    name: 'Силовая А', kind: 'gym', duration: '60–75 мин + финиш',
    why: 'Низ тела и спина: присед, бёдра, тяга сверху, ягодицы и кор. С 5-й недели добавляется тяга гантели.',
    exercises: EXERCISES.filter((e) => e.day === 'A').map((e) => e.id),
  },
  B: {
    name: 'Силовая Б', kind: 'gym', duration: '60–75 мин + финиш',
    why: 'Ноги через баланс, верх тела и кор: зашагивание, жим, тяга, плечи, ягодицы, антиротация. С 5-й недели — бицепс.',
    exercises: EXERCISES.filter((e) => e.day === 'B').map((e) => e.id),
  },
  cardio: {
    name: 'Кардио + бассейн', kind: 'cardio', duration: '30–40 мин кардио + 30 мин бассейн',
    why: 'Сердце и выносливость в зоне 2, где лучше всего горит жир, плюс бассейн и растяжка.',
    exercises: [],
  },
  legs: {
    name: 'День ног', kind: 'gym', duration: '60–70 мин',
    why: 'Бёдра со всех сторон и икры. Тренажёры держат спину, поэтому можно работать без натуживания.',
    exercises: ['goblet-box-squat', 'leg-extension', 'seated-leg-curl', 'step-up', 'hip-adduction', 'standing-calf-raise', 'dead-bug'],
  },
  glutes: {
    name: 'День ягодиц', kind: 'gym', duration: '55–65 мин',
    why: 'Большая и средняя ягодичная с трёх углов: зашагивание, выпад, отведения назад и в сторону. Без мостов и наклонов.',
    exercises: ['step-up', 'supported-reverse-lunge', 'cable-kickback', 'hip-abduction', 'cable-hip-abduction', 'standing-cable-leg-curl', 'pallof-press'],
  },
  back: {
    name: 'День спины и осанки', kind: 'gym', duration: '55–65 мин',
    why: 'Спина и задние дельты — ровная осанка и меньше нагрузки на шею. Все тяги сидя или стоя, голова на линии позвоночника.',
    exercises: ['lat-pulldown', 'seated-row', 'chest-supported-row', 'face-pull', 'bird-dog', 'pallof-press'],
  },
  upper: {
    name: 'День верха: грудь, плечи, руки', kind: 'gym', duration: '55–65 мин',
    why: 'Тонус рук и плеч. Лёгкие веса и много повторов — без жима над головой и без натуживания.',
    exercises: ['chest-press', 'pec-deck', 'lateral-raise', 'face-pull', 'dumbbell-curl', 'triceps-pushdown', 'dead-bug'],
  },
  core: {
    name: 'Кор и баланс', kind: 'gym', duration: '40–50 мин',
    why: 'Пресс и спина без планок и скручиваний: всё на свободном дыхании. Хорошо в день, когда сил немного.',
    exercises: ['dead-bug', 'bird-dog', 'pallof-press', 'cable-hip-abduction', 'standing-calf-raise', 'supported-reverse-lunge'],
  },
  light: {
    name: 'Лёгкий круг на тренажёрах', kind: 'gym', light: true, duration: '40–50 мин',
    why: 'Для дней после плохого сна, болезни или перерыва: на подход меньше, вес на шаг ниже, всё тело понемногу.',
    exercises: ['leg-extension', 'seated-leg-curl', 'seated-row', 'chest-press', 'hip-abduction', 'dead-bug'],
  },
};

// Замены в установочных тренировках для фаз «Закрепление» и «Разгрузка»
const LATE = ['p3', 'deload'];
PROGRAMS.A.phaseSwaps = { 'goblet-box-squat': 'tempo-box-squat', 'leg-extension': 'single-leg-extension', 'lat-pulldown': 'single-arm-pulldown' };
PROGRAMS.B.phaseSwaps = { 'lateral-raise': 'cable-lateral-raise', 'cable-kickback': 'paused-cable-kickback', 'seated-row': 'single-arm-cable-row' };

const phaseIdx = (p) => ['p1', 'p2', 'p3', 'deload'].indexOf(p);

// Упражнения программы для фазы — с учётом «с какой фазы» и замен в поздних фазах
export function programExercises(id, phase) {
  const p = PROGRAMS[id];
  if (!p) return [];
  const swaps = LATE.includes(phase) ? p.phaseSwaps || {} : {};
  return p.exercises.map((x) => EX_BY_ID[swaps[x] || x]).filter((e) => e && phaseIdx(phase) >= phaseIdx(e.fromPhase));
}

// Какие замены ждут программу позже, чем текущая фаза
export function upcomingSwaps(id, phase) {
  const p = PROGRAMS[id];
  if (!p || !p.phaseSwaps || LATE.includes(phase)) return [];
  return Object.entries(p.phaseSwaps).map(([from, to]) => ({ from: EX_BY_ID[from], to: EX_BY_ID[to] }));
}

export const programName = (id) => (PROGRAMS[id] ? PROGRAMS[id].name : id === 'pool' ? 'Бассейн' : 'Клуб');
export const isStrength = (id) => !!PROGRAMS[id] && PROGRAMS[id].kind === 'gym';
export const MIX_IDS = FOLDERS.find((f) => f.id === 'mix').programs;
