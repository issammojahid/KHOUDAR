import { Platform } from "react-native";

let audioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  if (Platform.OS !== "web") return null;
  if (!audioCtx) {
    const AC = (window as any).AudioContext || (window as any).webkitAudioContext;
    if (!AC) return null;
    audioCtx = new AC();
  }
  return audioCtx;
}

function playTone(frequency: number, duration: number, type: OscillatorType = "sine", volume = 0.3) {
  const ctx = getAudioContext();
  if (!ctx) return;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(frequency, ctx.currentTime);
  gain.gain.setValueAtTime(volume, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(ctx.currentTime);
  osc.stop(ctx.currentTime + duration);
}

function playNotes(notes: { freq: number; start: number; dur: number; type?: OscillatorType; vol?: number }[]) {
  const ctx = getAudioContext();
  if (!ctx) return;
  for (const n of notes) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = n.type || "sine";
    osc.frequency.setValueAtTime(n.freq, ctx.currentTime + n.start);
    gain.gain.setValueAtTime(n.vol ?? 0.25, ctx.currentTime + n.start);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + n.start + n.dur);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(ctx.currentTime + n.start);
    osc.stop(ctx.currentTime + n.start + n.dur);
  }
}

export function playTickSound() {
  playTone(880, 0.08, "square", 0.15);
}

export function playSubmitSound() {
  playNotes([
    { freq: 523, start: 0, dur: 0.12, type: "sine", vol: 0.3 },
    { freq: 659, start: 0.1, dur: 0.12, type: "sine", vol: 0.3 },
    { freq: 784, start: 0.2, dur: 0.2, type: "sine", vol: 0.3 },
  ]);
}

export function playTimeUpSound() {
  playNotes([
    { freq: 440, start: 0, dur: 0.15, type: "sawtooth", vol: 0.25 },
    { freq: 440, start: 0.2, dur: 0.15, type: "sawtooth", vol: 0.25 },
    { freq: 330, start: 0.4, dur: 0.3, type: "sawtooth", vol: 0.3 },
  ]);
}

export function playWinSound() {
  playNotes([
    { freq: 523, start: 0, dur: 0.15, type: "sine", vol: 0.3 },
    { freq: 659, start: 0.15, dur: 0.15, type: "sine", vol: 0.3 },
    { freq: 784, start: 0.3, dur: 0.15, type: "sine", vol: 0.3 },
    { freq: 1047, start: 0.45, dur: 0.35, type: "sine", vol: 0.35 },
  ]);
}

export function playLoseSound() {
  playNotes([
    { freq: 494, start: 0, dur: 0.2, type: "triangle", vol: 0.25 },
    { freq: 440, start: 0.2, dur: 0.2, type: "triangle", vol: 0.25 },
    { freq: 392, start: 0.4, dur: 0.2, type: "triangle", vol: 0.2 },
    { freq: 330, start: 0.6, dur: 0.4, type: "triangle", vol: 0.15 },
  ]);
}

export function playCountdownBeep() {
  playTone(660, 0.15, "square", 0.2);
}
