// Общее состояние приложения
import * as cy from './cycle.js';

export const DEFAULT_SETTINGS = { startDate: cy.DEFAULT_START, shifts: [], voice: true, commuteKm: 4, lastBackupAt: null, goalLossKg: 7, name: 'Елена' };

export const S = {
  screen: 'home',
  settings: { ...DEFAULT_SETTINGS },
  exSettings: {},
  sessions: [],
  measurements: [],
  activities: [],
  symptoms: [],
  plan: { days: {} },   // переопределения плана по датам
  health: {},           // date → { steps, km, source }
  videos: [],           // библиотека видео-тренировок со ссылками
  photos: {},           // exerciseId → objectURL своего фото тренажёра
  progId: null,         // открытая программа
  run: null,            // тренировка в процессе
  overlay: null,
  ui: {},
  form: {},
  cal: { mode: 'week', week: 0, month: 0 },
  preferSlot: null,
};
