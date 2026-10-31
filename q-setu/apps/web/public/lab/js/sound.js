// Optional UI sound, off by default (prefs.sound). Short synthesized tones, no audio files. Each sound is tied to
// a real event: a file's scan result arrived, the run finished / was cancelled / failed, the chain verified or
// broke. Nothing plays on hover, idle or timers.
import { prefs } from "./prefs.js";

const TONES = {
  file: [[660, 0.05]],
  done: [
    [880, 0.07],
    [1320, 0.09],
  ],
  verified: [[990, 0.08]],
  broken: [[220, 0.16]],
  error: [[220, 0.16]],
  cancelled: [
    [440, 0.06],
    [330, 0.08],
  ],
};
let ctx = null;

/** Called from the sound toggle (a user gesture), so browsers allow the audio context to start. */
export function unlock() {
  if (!ctx && typeof AudioContext === "function") ctx = new AudioContext();
  if (ctx && ctx.state === "suspended") ctx.resume();
}

export function play(kind) {
  if (!prefs.sound || !TONES[kind]) return;
  unlock();
  if (!ctx) return;
  let t = ctx.currentTime;
  for (const [freq, dur] of TONES[kind]) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(0.06, t + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(gain).connect(ctx.destination);
    osc.start(t);
    osc.stop(t + dur + 0.02);
    t += dur * 0.9;
  }
}

export const SOUND_KINDS = Object.keys(TONES);
