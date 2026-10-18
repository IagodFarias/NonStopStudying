// Aviso sonoro (Web Audio, sem arquivos de som) e vibração no fim dos ciclos do Pomodoro.
let audioContext = null;

function getContext() {
  if (!audioContext) {
    const AudioCtor = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtor) return null;
    audioContext = new AudioCtor();
  }
  if (audioContext.state === 'suspended') audioContext.resume().catch(() => {});
  return audioContext;
}

// Navegadores só liberam áudio depois de um toque do usuário: chamar no clique do Play.
export function unlockAudio() {
  try {
    getContext();
  } catch {
    // sem Web Audio disponível
  }
}

const PATTERNS = {
  focus: [880, 1175, 1568],
  break: [784, 659, 784],
  test: [988, 1319],
};

export function playChime(kind = 'focus') {
  try {
    const ctx = getContext();
    if (ctx) {
      const start = ctx.currentTime + 0.02;
      (PATTERNS[kind] ?? PATTERNS.focus).forEach((frequency, index) => {
        const at = start + index * 0.22;
        const oscillator = ctx.createOscillator();
        const gain = ctx.createGain();
        oscillator.type = 'sine';
        oscillator.frequency.value = frequency;
        gain.gain.setValueAtTime(0.0001, at);
        gain.gain.exponentialRampToValueAtTime(0.25, at + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, at + 0.2);
        oscillator.connect(gain).connect(ctx.destination);
        oscillator.start(at);
        oscillator.stop(at + 0.21);
      });
    }
  } catch {
    // sem áudio: fica só a vibração e o aviso visual
  }
  navigator.vibrate?.([220, 120, 220]);
}
