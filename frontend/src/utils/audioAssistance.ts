/**
 * Audio Assistance & Sound Design Engine
 * CVV SMS Institutional Attendance System
 *
 * Provides:
 * 1. Web Audio API synthesized chimes (success chime, warning tone, shutter click, micro-tick)
 * 2. Natural Voice Guidance HUD using Web Speech API (speechSynthesis) with smart debouncing
 */

// Global AudioContext singleton
let audioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!audioCtx) {
    const AudioContextClass =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (AudioContextClass) {
      audioCtx = new AudioContextClass();
    }
  }
  if (audioCtx && audioCtx.state === 'suspended') {
    audioCtx.resume().catch(() => {});
  }
  return audioCtx;
}

/**
 * Plays a pleasant high-resolution camera shutter sound
 */
export function playShutterSound() {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(880, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(140, ctx.currentTime + 0.09);

    gain.gain.setValueAtTime(0.35, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.005, ctx.currentTime + 0.09);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start();
    osc.stop(ctx.currentTime + 0.1);
  } catch {
    // Ignore in audio-blocked environments
  }
}

/**
 * Plays an ascending harmonic chime for successful verification or enrollment
 */
export function playSuccessChime() {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const notes = [523.25, 659.25, 783.99, 1046.5]; // C5, E5, G5, C6

    notes.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, now + idx * 0.07);

      gain.gain.setValueAtTime(0.2, now + idx * 0.07);
      gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.07 + 0.25);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now + idx * 0.07);
      osc.stop(now + idx * 0.07 + 0.28);
    });
  } catch {
    // Ignore audio error
  }
}

/**
 * Plays a soft dual-tone warning sound for alignment or light adjustment
 */
export function playWarningTone() {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(330, now);
    osc.frequency.setValueAtTime(293.66, now + 0.12);

    gain.gain.setValueAtTime(0.25, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.24);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.25);
  } catch {
    // Ignore
  }
}

/**
 * Plays a subtle micro-tick sound for scanning progress
 */
export function playMicroTick() {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(1200, now);

    gain.gain.setValueAtTime(0.08, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.03);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.035);
  } catch {
    // Ignore
  }
}

// Voice Guidance State & Debounce
let lastSpokenText = '';
let lastSpokenTime = 0;

/**
 * Speaks short guidance cues to the student using Web Speech API (English).
 * Automatically throttles identical phrases to avoid audio spam.
 */
export function speakGuidance(phrase: string, isEnabled = true) {
  if (!isEnabled) return;
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;

  const now = Date.now();
  // Throttle repeats within 3.5 seconds
  if (phrase === lastSpokenText && now - lastSpokenTime < 3500) {
    return;
  }
  // Throttle distinct phrases within 1.8 seconds to avoid cutting off speech
  if (now - lastSpokenTime < 1800) {
    return;
  }

  try {
    window.speechSynthesis.cancel(); // Stop pending speech
    const utterance = new SpeechSynthesisUtterance(phrase);
    utterance.rate = 1.05;
    utterance.pitch = 1.0;
    utterance.volume = 0.85;
    utterance.lang = 'en-US';

    lastSpokenText = phrase;
    lastSpokenTime = now;

    window.speechSynthesis.speak(utterance);
  } catch {
    // Speech synthesis unsupported or blocked
  }
}

export function cancelVoiceGuidance() {
  if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
    try {
      window.speechSynthesis.cancel();
    } catch {
      // Ignore
    }
  }
}
