import { EqPreset } from '../types';

/**
 * LOWERVIBE Dual-Deck Streaming Audio Engine
 * - Two HTMLAudioElement decks for real 0-12s equal-power crossfades and gapless transitions
 * - Working Web Audio 3-band EQ (flat | bass_boost | vocal | treble), DynamicsCompressor normalization, and Mono Audio
 * - Safe fallback to native <audio> playback if a remote stream lacks CORS headers
 */

export type SynthPreset =
  | 'rainy_rhodes'
  | 'tape_warmth'
  | 'midnight_drift'
  | 'tokyo_dawn'
  | 'ambient_dusk'
  | 'deep_chill';

class AudioEngine {
  private ctx: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private lowFilter: BiquadFilterNode | null = null;
  private midFilter: BiquadFilterNode | null = null;
  private highFilter: BiquadFilterNode | null = null;
  private compressor: DynamicsCompressorNode | null = null;
  private masterGain: GainNode | null = null;

  private connectedSources = new WeakMap<HTMLAudioElement, MediaElementAudioSourceNode>();

  private activeElement: HTMLAudioElement | null = null;
  private activeUrl: string | null = null;
  private preloadedElement: HTMLAudioElement | null = null;
  private preloadedUrl: string | null = null;

  private isPlaying: boolean = false;
  private isMuted: boolean = false;
  private volume: number = 0.85;
  private playbackRate: number = 1;
  private eqPreset: EqPreset = 'flat';
  private normalizeVolume: boolean = false;
  private monoAudio: boolean = false;

  private incomingFadeFactor: number = 1;
  private incomingFadeRaf: number | null = null;
  private sleepFadeRaf: number | null = null;
  private outgoingCleanups: Set<() => void> = new Set();

  public onTimeUpdate: ((currentTime: number, duration: number) => void) | null = null;
  public onEnded: (() => void) | null = null;
  public onError: ((message: string) => void) | null = null;
  public onExternalPlayState: ((playing: boolean) => void) | null = null;

  public init(): AudioContext | null {
    if (typeof window === 'undefined') return null;

    if (!this.ctx) {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) {
        try {
          this.ctx = new AudioCtx();
          this.lowFilter = this.ctx.createBiquadFilter();
          this.lowFilter.type = 'lowshelf';
          this.lowFilter.frequency.value = 110;

          this.midFilter = this.ctx.createBiquadFilter();
          this.midFilter.type = 'peaking';
          this.midFilter.frequency.value = 2200;
          this.midFilter.Q.value = 1.1;

          this.highFilter = this.ctx.createBiquadFilter();
          this.highFilter.type = 'highshelf';
          this.highFilter.frequency.value = 8000;

          this.compressor = this.ctx.createDynamicsCompressor();
          this.applyNormalizationParams();

          this.masterGain = this.ctx.createGain();
          this.masterGain.gain.value = 1;

          this.analyser = this.ctx.createAnalyser();
          this.analyser.fftSize = 128;
          this.analyser.smoothingTimeConstant = 0.85;

          this.lowFilter.connect(this.midFilter);
          this.midFilter.connect(this.highFilter);
          this.highFilter.connect(this.compressor);
          this.compressor.connect(this.masterGain);
          this.masterGain.connect(this.analyser);
          this.analyser.connect(this.ctx.destination);

          this.applyEqGains();
          this.applyMonoChannelCount();
        } catch {
          // AudioContext optional; HTMLAudioElement still plays directly
        }
      }
    }

    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }

    return this.ctx;
  }

  private applyEqGains() {
    if (!this.lowFilter || !this.midFilter || !this.highFilter) return;
    let low = 0;
    let mid = 0;
    let high = 0;

    switch (this.eqPreset) {
      case 'bass_boost':
      case 'deep_sub':
        low = 6;
        mid = -1;
        high = 1;
        break;
      case 'vocal':
        low = -2;
        mid = 5;
        high = 2;
        break;
      case 'treble':
      case 'air_clarity':
        low = -1;
        mid = 1;
        high = 6;
        break;
      case 'warm_tape':
        low = 2.5;
        mid = 0.5;
        high = -2;
        break;
      case 'flat':
      case 'studio_flat':
      default:
        low = 0;
        mid = 0;
        high = 0;
        break;
    }

    this.lowFilter.gain.value = low;
    this.midFilter.gain.value = mid;
    this.highFilter.gain.value = high;
  }

  private applyNormalizationParams() {
    if (!this.compressor) return;
    if (this.normalizeVolume) {
      this.compressor.threshold.value = -18;
      this.compressor.knee.value = 24;
      this.compressor.ratio.value = 6;
      this.compressor.attack.value = 0.005;
      this.compressor.release.value = 0.2;
    } else {
      this.compressor.threshold.value = 0;
      this.compressor.knee.value = 0;
      this.compressor.ratio.value = 1;
    }
  }

  private applyMonoChannelCount() {
    if (!this.masterGain || !this.ctx) return;
    try {
      this.masterGain.channelCount = this.monoAudio ? 1 : 2;
      this.masterGain.channelCountMode = this.monoAudio ? 'explicit' : 'max';
    } catch {}
  }

  private attachWebAudioGraphIfSafe(el: HTMLAudioElement, url: string) {
    if (!this.ctx || !this.lowFilter) return;
    const isBlobOrSameOrigin =
      url.startsWith('/') ||
      url.startsWith('blob:') ||
      url.startsWith('data:') ||
      (typeof window !== 'undefined' && url.startsWith(window.location.origin)) ||
      url.includes('firebasestorage.googleapis.com');

    if (!isBlobOrSameOrigin) return;

    try {
      if (url.includes('firebasestorage.googleapis.com') && !el.crossOrigin) {
        el.crossOrigin = 'anonymous';
      }
      if (!this.connectedSources.has(el)) {
        const source = this.ctx.createMediaElementSource(el);
        source.connect(this.lowFilter);
        this.connectedSources.set(el, source);
      }
    } catch {
      // Safe fallback: native HTMLAudioElement playback remains intact
    }
  }

  public getIsActive(): boolean {
    return this.isPlaying;
  }

  public getIsCustomAudio(): boolean {
    return Boolean(this.activeElement);
  }

  public setEqPreset(preset: EqPreset) {
    this.eqPreset = preset;
    this.applyEqGains();
  }

  public setNormalizeVolume(enabled: boolean) {
    this.normalizeVolume = enabled;
    this.applyNormalizationParams();
  }

  public setMonoAudio(enabled: boolean) {
    this.monoAudio = enabled;
    this.applyMonoChannelCount();
  }

  public setPlaybackRate(rate: number) {
    const safeRate = Math.max(0.5, Math.min(2, rate));
    this.playbackRate = safeRate;
    if (this.activeElement) {
      this.activeElement.playbackRate = safeRate;
      const elWithPitch = this.activeElement as HTMLAudioElement & {
        preservesPitch?: boolean;
        webkitPreservesPitch?: boolean;
      };
      if ('preservesPitch' in elWithPitch) elWithPitch.preservesPitch = true;
      if ('webkitPreservesPitch' in elWithPitch) elWithPitch.webkitPreservesPitch = true;
    }
  }

  public setVolume(val: number) {
    this.volume = Math.max(0, Math.min(1, val));
    const target = this.isMuted ? 0 : this.volume;
    if (this.activeElement) {
      this.activeElement.volume = Math.max(0, Math.min(1, target * this.incomingFadeFactor));
    }
  }

  public setMute(muted: boolean) {
    this.isMuted = muted;
    this.setVolume(this.volume);
  }

  private cancelIncomingFade() {
    if (this.incomingFadeRaf !== null) {
      cancelAnimationFrame(this.incomingFadeRaf);
      this.incomingFadeRaf = null;
    }
    this.incomingFadeFactor = 1;
  }

  private cancelSleepFade() {
    if (this.sleepFadeRaf !== null) {
      cancelAnimationFrame(this.sleepFadeRaf);
      this.sleepFadeRaf = null;
    }
  }

  private clearAllOutgoing() {
    this.outgoingCleanups.forEach((fn) => {
      try {
        fn();
      } catch {}
    });
    this.outgoingCleanups.clear();
  }

  private fadeOutCurrentSource(fadeSeconds: number) {
    if (!this.activeElement) return;
    const outgoingEl = this.activeElement;
    this.activeElement = null;
    this.activeUrl = null;

    outgoingEl.ontimeupdate = null;
    outgoingEl.onended = null;
    outgoingEl.onerror = null;

    const durationMs = Math.max(150, fadeSeconds * 1000);
    if (!outgoingEl.paused && outgoingEl.volume > 0.005) {
      const startVol = outgoingEl.volume;
      const startTime = performance.now();
      let rafId: number | null = null;
      let finished = false;

      const finishOutgoing = () => {
        if (finished) return;
        finished = true;
        if (rafId !== null) cancelAnimationFrame(rafId);
        try {
          outgoingEl.volume = 0;
          outgoingEl.pause();
          outgoingEl.removeAttribute('src');
          outgoingEl.load();
        } catch {}
        this.outgoingCleanups.delete(finishOutgoing);
      };

      this.outgoingCleanups.add(finishOutgoing);

      const step = (now: number) => {
        if (finished) return;
        const elapsed = now - startTime;
        const progress = Math.min(1, elapsed / durationMs);
        const gainFactor = Math.cos(progress * Math.PI * 0.5);
        try {
          outgoingEl.volume = Math.max(0, Math.min(1, startVol * gainFactor));
        } catch {}
        if (progress < 1) {
          rafId = requestAnimationFrame(step);
        } else {
          finishOutgoing();
        }
      };

      rafId = requestAnimationFrame(step);
    } else {
      try {
        outgoingEl.pause();
        outgoingEl.removeAttribute('src');
        outgoingEl.load();
      } catch {}
    }
  }

  private startIncomingAudioFadeIn(targetEl: HTMLAudioElement, fadeSeconds: number) {
    this.cancelIncomingFade();
    if (fadeSeconds <= 0) {
      this.incomingFadeFactor = 1;
      targetEl.volume = this.isMuted ? 0 : this.volume;
      return;
    }

    const durationMs = fadeSeconds * 1000;
    const startTime = performance.now();
    this.incomingFadeFactor = 0;
    targetEl.volume = 0;

    const step = (now: number) => {
      if (this.activeElement !== targetEl || !this.isPlaying) {
        this.incomingFadeRaf = null;
        return;
      }
      const elapsed = now - startTime;
      const progress = Math.min(1, elapsed / durationMs);
      this.incomingFadeFactor = Math.sin(progress * Math.PI * 0.5);
      const targetVol = this.isMuted ? 0 : this.volume;
      try {
        targetEl.volume = Math.max(0, Math.min(1, targetVol * this.incomingFadeFactor));
      } catch {}

      if (progress < 1) {
        this.incomingFadeRaf = requestAnimationFrame(step);
      } else {
        this.incomingFadeFactor = 1;
        this.incomingFadeRaf = null;
      }
    };

    this.incomingFadeRaf = requestAnimationFrame(step);
  }

  public preloadNext(url?: string, dataSaver: boolean = false) {
    if (!url || typeof window === 'undefined' || dataSaver) return;
    if (this.preloadedUrl === url && this.preloadedElement) return;

    if (this.preloadedElement && this.preloadedElement !== this.activeElement) {
      try {
        this.preloadedElement.removeAttribute('src');
        this.preloadedElement.load();
      } catch {}
    }

    const el = new Audio();
    el.setAttribute('playsinline', 'true');
    el.setAttribute('webkit-playsinline', 'true');
    el.preload = 'auto';
    if (url.includes('firebasestorage.googleapis.com')) {
      el.crossOrigin = 'anonymous';
    }
    el.src = url;
    try {
      el.load();
    } catch {}

    this.preloadedElement = el;
    this.preloadedUrl = url;
  }

  public playCustomAudio(url: string, crossfadeSeconds: number = 0, startAtSeconds: number = 0) {
    this.cancelSleepFade();
    const shouldCrossfade = crossfadeSeconds > 0 && this.isPlaying && Boolean(this.activeElement);

    if (shouldCrossfade) {
      this.cancelIncomingFade();
      this.fadeOutCurrentSource(crossfadeSeconds);
    } else {
      this.stop();
    }

    this.init();
    this.isPlaying = true;

    let el: HTMLAudioElement;
    if (this.preloadedElement && this.preloadedUrl === url) {
      el = this.preloadedElement;
      this.preloadedElement = null;
      this.preloadedUrl = null;
    } else {
      el = new Audio();
      el.setAttribute('playsinline', 'true');
      el.setAttribute('webkit-playsinline', 'true');
      el.preload = 'auto';
      if (url.includes('firebasestorage.googleapis.com')) {
        el.crossOrigin = 'anonymous';
      }
      el.src = url;
    }

    this.attachWebAudioGraphIfSafe(el, url);

    this.activeElement = el;
    this.activeUrl = url;
    this.setPlaybackRate(this.playbackRate);

    if (startAtSeconds > 0) {
      const applyStartSeek = () => {
        if (this.activeElement !== el) return;
        try {
          const maxDur = Number.isFinite(el.duration) && el.duration > 0 ? el.duration : startAtSeconds + 1;
          el.currentTime = Math.max(0, Math.min(startAtSeconds, maxDur - 0.5));
        } catch {}
      };
      if (el.readyState >= 1) {
        applyStartSeek();
      } else {
        el.addEventListener('loadedmetadata', applyStartSeek, { once: true });
      }
    }

    el.ontimeupdate = () => {
      if (this.activeElement === el && this.onTimeUpdate) {
        this.onTimeUpdate(el.currentTime || 0, Number.isFinite(el.duration) ? el.duration : 0);
      }
    };

    el.onended = () => {
      if (this.activeElement === el && this.onEnded) {
        this.onEnded();
      }
    };

    el.onplay = () => {
      if (this.activeElement === el && !this.isPlaying) {
        this.isPlaying = true;
        this.init();
        this.onExternalPlayState?.(true);
      }
    };

    el.onpause = () => {
      if (this.activeElement === el && this.isPlaying && !el.ended) {
        this.isPlaying = false;
        this.onExternalPlayState?.(false);
      }
    };

    el.onerror = () => {
      if (this.activeElement !== el) return;
      this.isPlaying = false;
      this.onError?.('Could not play this track. Check your connection or try another song.');
    };

    if (shouldCrossfade) {
      this.startIncomingAudioFadeIn(el, crossfadeSeconds);
    } else {
      this.incomingFadeFactor = 1;
      el.volume = this.isMuted ? 0 : this.volume;
    }

    const playPromise = el.play();
    if (playPromise !== undefined) {
      playPromise.catch((err) => {
        if (this.activeElement !== el) return;
        if (err && err.name === 'AbortError') return;
        if (err && err.name === 'NotAllowedError') {
          this.isPlaying = false;
          return;
        }
        this.isPlaying = false;
        this.onError?.('Playback interrupted. Tap Play to try again.');
      });
    }
  }

  public seek(seconds: number) {
    if (this.activeElement) {
      try {
        this.activeElement.currentTime = Math.max(0, seconds);
      } catch {}
    }
  }

  public pause() {
    this.isPlaying = false;
    this.cancelIncomingFade();
    this.cancelSleepFade();
    this.clearAllOutgoing();
    if (this.activeElement) {
      this.activeElement.volume = this.isMuted ? 0 : this.volume;
      this.activeElement.pause();
    }
  }

  public fadeOutAndPause(fadeSeconds: number = 3, onComplete?: () => void) {
    if (!this.isPlaying || !this.activeElement) {
      this.pause();
      onComplete?.();
      return;
    }

    this.cancelIncomingFade();
    this.cancelSleepFade();

    const durationMs = Math.max(300, fadeSeconds * 1000);
    const startTime = performance.now();
    const el = this.activeElement;
    const startElVol = el.volume;

    const step = (now: number) => {
      if (!this.isPlaying || this.activeElement !== el) {
        this.sleepFadeRaf = null;
        this.pause();
        onComplete?.();
        return;
      }

      const elapsed = now - startTime;
      const progress = Math.min(1, elapsed / durationMs);
      const gainFactor = Math.cos(progress * Math.PI * 0.5);

      try {
        el.volume = Math.max(0, Math.min(1, startElVol * gainFactor));
      } catch {}

      if (progress < 1) {
        this.sleepFadeRaf = requestAnimationFrame(step);
      } else {
        this.sleepFadeRaf = null;
        this.pause();
        onComplete?.();
      }
    };

    this.sleepFadeRaf = requestAnimationFrame(step);
  }

  public resume() {
    this.cancelSleepFade();
    this.init();
    if (this.activeElement && this.activeUrl) {
      this.isPlaying = true;
      this.activeElement.volume = this.isMuted ? 0 : this.volume;
      this.activeElement
        .play()
        .then(() => {
          this.isPlaying = true;
        })
        .catch(() => {
          this.isPlaying = false;
          this.onExternalPlayState?.(false);
          this.onError?.('Tap Play again to resume audio.');
        });
    }
  }

  public stop() {
    this.pause();
    if (this.activeElement) {
      this.activeElement.ontimeupdate = null;
      this.activeElement.onended = null;
      this.activeElement.onerror = null;
      this.activeElement.onplay = null;
      this.activeElement.onpause = null;
      try {
        this.activeElement.pause();
        this.activeElement.removeAttribute('src');
        this.activeElement.load();
      } catch {}
      this.activeElement = null;
      this.activeUrl = null;
    }
  }

  public getVisualizerData(): Uint8Array {
    if (!this.analyser) {
      return new Uint8Array(16);
    }
    const data = new Uint8Array(this.analyser.frequencyBinCount);
    this.analyser.getByteFrequencyData(data);
    return data;
  }

  public getWaveformData(): Uint8Array {
    if (!this.analyser) {
      return new Uint8Array(64);
    }
    const data = new Uint8Array(this.analyser.fftSize);
    this.analyser.getByteTimeDomainData(data);
    return data;
  }

  public getVolumeLevelSnapshot(bandCount: number = 10): {
    volume: number;
    isMuted: boolean;
    isPlaying: boolean;
    effectiveVolume: number;
    signalRms: number;
    hasAnalyserSignal: boolean;
    bands: number[];
  } {
    const effectiveVolume = this.isMuted ? 0 : this.volume;
    const bands = new Array<number>(bandCount).fill(0);

    if (!this.analyser || !this.isPlaying) {
      return {
        volume: this.volume,
        isMuted: this.isMuted,
        isPlaying: this.isPlaying,
        effectiveVolume,
        signalRms: 0,
        hasAnalyserSignal: false,
        bands,
      };
    }

    const freqData = new Uint8Array(this.analyser.frequencyBinCount);
    this.analyser.getByteFrequencyData(freqData);

    let sumSq = 0;
    let nonZeroCount = 0;
    const usableBins = Math.max(bandCount, Math.floor(freqData.length * 0.75));
    const binsPerBand = Math.max(1, Math.floor(usableBins / bandCount));

    for (let b = 0; b < bandCount; b++) {
      let bandSum = 0;
      const start = b * binsPerBand;
      const end = Math.min(freqData.length, start + binsPerBand);
      for (let i = start; i < end; i++) {
        const norm = freqData[i] / 255;
        bandSum += norm;
        sumSq += norm * norm;
        if (freqData[i] > 0) nonZeroCount += 1;
      }
      const avg = end > start ? bandSum / (end - start) : 0;
      bands[b] = Math.min(1, avg * (0.25 + effectiveVolume * 0.95));
    }

    const signalRms = Math.min(1, Math.sqrt(sumSq / Math.max(1, usableBins)) * (0.25 + effectiveVolume * 0.95));

    return {
      volume: this.volume,
      isMuted: this.isMuted,
      isPlaying: this.isPlaying,
      effectiveVolume,
      signalRms,
      hasAnalyserSignal: nonZeroCount > 0,
      bands,
    };
  }
}

export const audioEngine = new AudioEngine();
