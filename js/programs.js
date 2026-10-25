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
for (const e of EXTRA) {
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
    name: 'Силовая А', kind: 'gym', duration: '60–75 мин + бассейн',
    why: 'Низ тела и спина: присед, бёдра, тяга сверху, ягодицы и кор. С 5-й недели добавляется тяга гантели.',
    exercises: EXERCISES.filter((e) => e.day === 'A').map((e) => e.id),
  },
  B: {
    name: 'Силовая Б', kind: 'gym', duration: '60–75 мин + бассейн',
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

export const programName = (id) => (PROGRAMS[id] ? PROGRAMS[id].name : id === 'pool' ? 'Бассейн' : 'Клуб');
export const isStrength = (id) => !!PROGRAMS[id] && PROGRAMS[id].kind === 'gym';
export const MIX_IDS = FOLDERS.find((f) => f.id === 'mix').programs;
