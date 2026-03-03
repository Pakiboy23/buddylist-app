'use client';

interface PlaySoundOptions {
  volume?: number;
  resetTime?: boolean;
  fallbackSrc?: string;
}

const audioTemplateCache = new Map<string, HTMLAudioElement>();
const activeAudio = new Set<HTMLAudioElement>();
let unlockListenersAttached = false;
let warmupCompleted = false;
let sharedAudioContext: AudioContext | null = null;

const DEFAULT_WARMUP_SOUND = '/sounds/aim.mp3';

function clampVolume(volume: number | undefined) {
  if (typeof volume !== 'number' || Number.isNaN(volume)) {
    return 1;
  }

  return Math.min(1, Math.max(0, volume));
}

function getAudioContextConstructor() {
  if (typeof window === 'undefined') {
    return null;
  }

  return (
    window.AudioContext ||
    (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
  );
}

function getAudioContext() {
  const AudioContextConstructor = getAudioContextConstructor();
  if (!AudioContextConstructor) {
    return null;
  }

  if (!sharedAudioContext) {
    sharedAudioContext = new AudioContextConstructor();
  }

  return sharedAudioContext;
}

function getAudioTemplate(src: string) {
  let audio = audioTemplateCache.get(src);
  if (!audio) {
    audio = new Audio(src);
    audio.preload = 'auto';
    audioTemplateCache.set(src, audio);
  }
  return audio;
}

function createAudioInstance(src: string) {
  const template = getAudioTemplate(src);
  const audio = template.cloneNode(true) as HTMLAudioElement;
  audio.preload = 'auto';
  return audio;
}

async function resumeAudioContext() {
  const audioContext = getAudioContext();
  if (!audioContext || audioContext.state !== 'suspended') {
    return;
  }

  try {
    await audioContext.resume();
  } catch {
    // Ignore resume failures on restricted browsers.
  }
}

function warmUpMediaElement() {
  if (typeof window === 'undefined' || warmupCompleted) {
    return;
  }

  warmupCompleted = true;

  const firstCachedSrc = audioTemplateCache.keys().next().value;
  const warmupSrc = typeof firstCachedSrc === 'string' ? firstCachedSrc : DEFAULT_WARMUP_SOUND;
  const template = getAudioTemplate(warmupSrc);
  const previousMuted = template.muted;
  const previousVolume = template.volume;
  const previousTime = template.currentTime;

  template.muted = true;
  template.volume = 0;
  template.currentTime = 0;

  const cleanup = () => {
    template.pause();
    template.currentTime = previousTime;
    template.muted = previousMuted;
    template.volume = previousVolume;
  };

  const playPromise = template.play();
  if (typeof playPromise?.then === 'function') {
    void playPromise.then(cleanup).catch(cleanup);
  } else {
    cleanup();
  }
}

function trackActiveAudio(audio: HTMLAudioElement) {
  activeAudio.add(audio);
  const cleanup = () => {
    activeAudio.delete(audio);
    audio.removeEventListener('ended', cleanup);
    audio.removeEventListener('error', cleanup);
  };

  audio.addEventListener('ended', cleanup);
  audio.addEventListener('error', cleanup);
}

function attachUnlockListeners() {
  if (typeof window === 'undefined' || unlockListenersAttached) {
    return;
  }

  const unlock = () => {
    window.removeEventListener('pointerdown', unlock, true);
    window.removeEventListener('touchstart', unlock, true);
    window.removeEventListener('keydown', unlock, true);
    window.removeEventListener('click', unlock, true);
    void resumeAudioContext();
    warmUpMediaElement();
  };

  window.addEventListener('pointerdown', unlock, { capture: true });
  window.addEventListener('touchstart', unlock, { capture: true });
  window.addEventListener('keydown', unlock, { capture: true });
  window.addEventListener('click', unlock, { capture: true });
  unlockListenersAttached = true;
}

async function playInternal(src: string, options?: Omit<PlaySoundOptions, 'fallbackSrc'>) {
  const audio = createAudioInstance(src);
  audio.volume = clampVolume(options?.volume);
  if (options?.resetTime !== false) {
    audio.currentTime = 0;
  }
  trackActiveAudio(audio);
  await audio.play();
}

export function initSoundSystem() {
  getAudioTemplate(DEFAULT_WARMUP_SOUND);
  void resumeAudioContext();
  attachUnlockListeners();
}

export async function playUiSound(src: string, options: PlaySoundOptions = {}) {
  if (typeof window === 'undefined') {
    return false;
  }

  attachUnlockListeners();

  try {
    await playInternal(src, options);
    return true;
  } catch {
    if (!options.fallbackSrc) {
      return false;
    }

    try {
      await playInternal(options.fallbackSrc, {
        volume: options.volume,
        resetTime: options.resetTime,
      });
      return true;
    } catch {
      return false;
    }
  }
}

export function playFallbackTone() {
  const audioContext = getAudioContext();
  if (!audioContext) {
    return;
  }

  void resumeAudioContext();

  const oscillator = audioContext.createOscillator();
  const gainNode = audioContext.createGain();

  oscillator.type = 'sine';
  oscillator.frequency.value = 880;
  gainNode.gain.value = 0.06;

  oscillator.connect(gainNode);
  gainNode.connect(audioContext.destination);

  oscillator.start();
  oscillator.stop(audioContext.currentTime + 0.13);
}
