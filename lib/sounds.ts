import { Platform } from "react-native";

let audioCtx: AudioContext | null = null;
let nativeAudioModule: any = null;

function getAudioContext(): AudioContext | null {
  if (Platform.OS !== "web") return null;
  if (!audioCtx) {
    const AC = (window as any).AudioContext || (window as any).webkitAudioContext;
    if (!AC) return null;
    audioCtx = new AC();
  }
  if (audioCtx && audioCtx.state === "suspended") {
    audioCtx.resume().catch(() => {});
  }
  return audioCtx;
}

async function getNativeAudio() {
  if (nativeAudioModule) return nativeAudioModule;
  try {
    nativeAudioModule = await import("expo-av");
    return nativeAudioModule;
  } catch {
    return null;
  }
}

const SAMPLE_RATE = 22050;

function generateWavBase64(frequency: number, durationSec: number, volume = 0.3): string {
  const numSamples = Math.floor(SAMPLE_RATE * durationSec);
  const dataSize = numSamples * 2;
  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);

  const writeStr = (off: number, s: string) => {
    for (let i = 0; i < s.length; i++) view.setUint8(off + i, s.charCodeAt(i));
  };

  writeStr(0, "RIFF");
  view.setUint32(4, 36 + dataSize, true);
  writeStr(8, "WAVE");
  writeStr(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, SAMPLE_RATE, true);
  view.setUint32(28, SAMPLE_RATE * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeStr(36, "data");
  view.setUint32(40, dataSize, true);

  for (let i = 0; i < numSamples; i++) {
    const t = i / SAMPLE_RATE;
    const env = Math.max(0, 1 - t / durationSec);
    const sample = Math.sin(2 * Math.PI * frequency * t) * volume * env;
    view.setInt16(44 + i * 2, Math.max(-1, Math.min(1, sample)) * 32767, true);
  }

  const bytes = new Uint8Array(buffer);
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
  let b64 = "";
  for (let i = 0; i < bytes.length; i += 3) {
    const b0 = bytes[i], b1 = bytes[i + 1] || 0, b2 = bytes[i + 2] || 0;
    b64 += chars[b0 >> 2] + chars[((b0 & 3) << 4) | (b1 >> 4)] +
      (i + 1 < bytes.length ? chars[((b1 & 15) << 2) | (b2 >> 6)] : "=") +
      (i + 2 < bytes.length ? chars[b2 & 63] : "=");
  }
  return b64;
}

async function playNativeBeep(frequency: number, duration: number, volume = 0.3) {
  try {
    const av = await getNativeAudio();
    if (!av) return;
    await av.Audio.setAudioModeAsync({ playsInSilentModeIOS: true });
    const b64 = generateWavBase64(frequency, duration, volume);
    const { sound } = await av.Audio.Sound.createAsync(
      { uri: `data:audio/wav;base64,${b64}` },
      { shouldPlay: true }
    );
    setTimeout(() => { sound.unloadAsync().catch(() => {}); }, (duration + 1) * 1000);
  } catch (e) {
    if (__DEV__) console.warn("[sounds] native audio failed:", e);
  }
}

async function playNativeSequence(notes: { freq: number; start: number; dur: number; vol?: number }[]) {
  for (const n of notes) {
    setTimeout(() => playNativeBeep(n.freq, n.dur, n.vol ?? 0.25), n.start * 1000);
  }
}

function playTone(frequency: number, duration: number, type: OscillatorType = "sine", volume = 0.3) {
  if (Platform.OS === "web") {
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
  } else {
    playNativeBeep(frequency, duration, volume);
  }
}

function playNotes(notes: { freq: number; start: number; dur: number; type?: OscillatorType; vol?: number }[]) {
  if (Platform.OS === "web") {
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
  } else {
    playNativeSequence(notes);
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
