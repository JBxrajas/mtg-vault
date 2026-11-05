let context: AudioContext | null = null;

function audio(): AudioContext | null {
  const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctx) return null;
  context ??= new Ctx();
  return context;
}

/** Call from a tap or click: phones only let a page make sound once the user has touched it, and the automatic capture has no tap. */
export function primeSound() {
  try {
    void audio()?.resume();
  } catch {
    // No sound is not an error.
  }
}

/** A short beep, like a barcode scanner. Silent where the browser has no audio or has not allowed it yet. */
export function beep(frequency = 880, ms = 90) {
  try {
    const context = audio();
    if (!context) return;
    void context.resume();
    const osc = context.createOscillator();
    const gain = context.createGain();
    osc.frequency.value = frequency;
    gain.gain.setValueAtTime(0.0001, context.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.25, context.currentTime + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + ms / 1000);
    osc.connect(gain).connect(context.destination);
    osc.start();
    osc.stop(context.currentTime + ms / 1000 + 0.02);
  } catch {
    // No sound is not an error.
  }
}
