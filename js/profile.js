// Общий профиль: рост, возраст, пол и сводка последних данных. Чистая логика без доступа к состоянию.
// От профиля считаются нормы (например, процент жира по возрасту), а не зашиваются в код.

export const SEX = { female: 'Женский', male: 'Мужской' };

// Ориентиры процента жира для женщин по возрасту («приемлемый» диапазон), десятилетиями.
// Источник: таблица InBody USA «Body Fat Percentage Chart» (inbodyusa.com, 22.08.2025). Это ориентир для населения, а не диагноз.
// Для мужчин таблица здесь не заведена: показываем без нормы, а не придумываем цифры.
const FEMALE_FAT = [[20, 29, [21, 31]], [30, 39, [22, 32]], [40, 49, [23, 33]], [50, 59, [24, 34]], [60, 200, [25, 35]]];
// Диапазон на бланке InBody у женщин без учёта возраста — запасной вариант, если возраст не указан
export const DEVICE_FAT_NORM = { female: [18, 28] };

const parse = (d) => [+d.slice(0, 4), +d.slice(5, 7), +d.slice(8, 10)];

// Полных лет на дату: birthDate и today в виде «ГГГГ-ММ-ДД»; нет или неверная дата → null
export function ageOn(birthDate, today) {
  if (!birthDate || !/^\d{4}-\d{2}-\d{2}$/.test(birthDate)) return null;
  const [by, bm, bd] = parse(birthDate);
  const [ty, tm, td] = parse(today);
  let age = ty - by;
  if (tm < bm || (tm === bm && td < bd)) age--;
  return age >= 0 && age < 120 ? age : null;
}

// Ориентир по проценту жира: { range: [от, до], source: 'age' | 'device', ageBand? } или null
export function fatRange(sex, age) {
  if (sex === 'female' && age != null && age >= 20) {
    const b = FEMALE_FAT.find(([lo, hi]) => age >= lo && age <= hi);
    if (b) return { range: b[2], source: 'age', ageBand: b[1] >= 100 ? `${b[0]}+` : `${b[0]}–${b[1]}` };
  }
  return DEVICE_FAT_NORM[sex] ? { range: DEVICE_FAT_NORM[sex], source: 'device' } : null;
}

export const GIRTH_LABELS = { waistCm: 'Талия', bellyNavelCm: 'Живот по пупку', hipsCm: 'Бёдра', thighCm: 'Бедро', chestCm: 'Грудь' };

// Последнее значение каждой мерки: [{ key, label, value, date }], порядок как в GIRTH_LABELS
export function latestGirths(measurements) {
  const sorted = [...measurements].sort((a, b) => (a.date + (a.at || '')).localeCompare(b.date + (b.at || '')));
  const out = [];
  for (const [key, label] of Object.entries(GIRTH_LABELS)) {
    const m = [...sorted].reverse().find((x) => x[key] != null && x.kind !== 'body');
    if (m) out.push({ key, label, value: m[key], date: m.date });
  }
  return out;
}

// Отношение талии к бёдрам по последним меркам рулеткой; нет обеих мерок → null
export function waistHipRatio(girths) {
  const w = girths.find((g) => g.key === 'waistCm');
  const h = girths.find((g) => g.key === 'hipsCm');
  return w && h && h.value > 0 ? +(w.value / h.value).toFixed(2) : null;
}

// Проверка введённых данных профиля: текст ошибки или null
export function checkProfile({ heightCm, birthDate, sex }, today) {
  if (heightCm != null && !(heightCm >= 100 && heightCm <= 230)) return 'Рост должен быть от 100 до 230 см';
  if (birthDate) {
    const a = ageOn(birthDate, today);
    if (a == null) return 'Дата рождения указана неверно';
    if (a < 14) return 'Приложение рассчитано на взрослых';
  }
  if (sex && !SEX[sex]) return 'Выбери пол';
  return null;
}
