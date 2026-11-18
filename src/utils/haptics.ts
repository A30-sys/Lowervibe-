export type HapticPreset = 'tap' | 'tick' | 'confirm' | 'double' | 'dismiss';

const HAPTIC_PATTERNS: Record<HapticPreset, number | number[]> = {
  tap: 10,
  tick: 6,
  confirm: 15,
  double: [10, 26, 14],
  dismiss: [8, 18, 8],
};

export function supportsHaptics(): boolean {
  return (
    typeof navigator !== 'undefined' &&
    typeof navigator.vibrate === 'function'
  );
}

export function triggerHaptic(preset: HapticPreset = 'tap'): boolean {
  if (!supportsHaptics()) return false;
  try {
    return navigator.vibrate(HAPTIC_PATTERNS[preset]);
  } catch {
    return false;
  }
}
