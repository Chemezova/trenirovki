// Звук, голос, вибрация и удержание экрана (3.1, 7.5 ТЗ)
let ctx = null;
let voiceOn = true;
let ruVoice = null;
let wakeLock = null;
let wantWake = false;

export function setVoice(on) { voiceOn = on; }

// Вызывать только из обработчика тапа: iOS разблокирует звук и речь по жесту
export function unlock() {
  try { if (navigator.audioSession) navigator.audioSession.type = 'playback'; } catch (e) { /* нет API */ }
  try {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (AC) {
      ctx = ctx || new AC();
      if (ctx.state === 'suspended') ctx.resume();
      const src = ctx.createBufferSource();
      src.buffer = ctx.createBuffer(1, 1, 22050);
      src.connect(ctx.destination);
      src.start(0);
    }
  } catch (e) { /* без звука */ }
  try {
    if ('speechSynthesis' in window) {
      const u = new SpeechSynthesisUtterance(' ');
      u.volume = 0;
      speechSynthesis.speak(u);
    }
  } catch (e) { /* без голоса */ }
}

function tone(freq, start, dur, vol = 0.35) {
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = 'sine';
  o.frequency.value = freq;
  g.gain.setValueAtTime(0.0001, start);
  g.gain.exponentialRampToValueAtTime(vol, start + 0.02);
  g.gain.exponentialRampToValueAtTime(0.0001, start + dur);
  o.connect(g).connect(ctx.destination);
  o.start(start);
  o.stop(start + dur + 0.05);
}

const PATTERNS = {
  end: [[880, 0, 0.25], [880, 0.35, 0.25], [1175, 0.7, 0.5]],
  short: [[660, 0, 0.18]],
  brisk: [[988, 0, 0.18], [1319, 0.22, 0.35]],
  easy: [[523, 0, 0.4], [392, 0.5, 0.55]],
};

export function beep(kind = 'end') {
  try {
    if (ctx) {
      if (ctx.state === 'suspended') ctx.resume();
      const t = ctx.currentTime + 0.02;
      for (const [f, o, d] of PATTERNS[kind] || PATTERNS.end) tone(f, t + o, d);
    }
    if (navigator.vibrate) navigator.vibrate(kind === 'short' ? 120 : [250, 120, 250]);
  } catch (e) { /* без звука */ }
}

function pickVoice() {
  const voices = speechSynthesis.getVoices();
  ruVoice = voices.find((v) => v.lang && v.lang.toLowerCase().startsWith('ru')) || null;
}
if ('speechSynthesis' in window) {
  pickVoice();
  speechSynthesis.onvoiceschanged = pickVoice;
}
export const hasRuVoice = () => !!ruVoice;

export function speak(text) {
  if (!voiceOn || !text || !('speechSynthesis' in window)) return;
  try {
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = 'ru-RU';
    if (ruVoice) u.voice = ruVoice;
    u.rate = 0.95;
    speechSynthesis.speak(u);
  } catch (e) { /* без голоса */ }
}

export function announce(text, kind = 'end') {
  beep(kind);
  setTimeout(() => speak(text), kind === 'short' ? 350 : 1000);
}

export async function keepAwake(on) {
  wantWake = on;
  try {
    if (on && 'wakeLock' in navigator && !wakeLock) {
      wakeLock = await navigator.wakeLock.request('screen');
      wakeLock.addEventListener('release', () => { wakeLock = null; });
    }
    if (!on && wakeLock) { await wakeLock.release(); wakeLock = null; }
  } catch (e) { /* не поддерживается */ }
}

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && wantWake) keepAwake(true);
});
