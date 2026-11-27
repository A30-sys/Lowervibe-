import { useEffect, useState } from 'react';
import { BatterySaverMode } from '../types';

export const BATTERY_SAVER_STORAGE_KEY = 'lowervibe_battery_saver_mode_v1';
export const LOW_BATTERY_THRESHOLD = 0.2;

interface BatteryManagerLike {
  charging: boolean;
  level: number;
  addEventListener?: (type: string, listener: () => void) => void;
  removeEventListener?: (type: string, listener: () => void) => void;
}

export interface BatterySaverState {
  mode: BatterySaverMode;
  active: boolean;
  batterySupported: boolean;
  level: number | null;
  charging: boolean | null;
  isLowBattery: boolean;
}

let currentMode: BatterySaverMode = (() => {
  try {
    const saved = localStorage.getItem(BATTERY_SAVER_STORAGE_KEY);
    if (saved === 'auto' || saved === 'on' || saved === 'off') return saved;
  } catch {}
  return 'auto';
})();

let batterySupported = false;
let batteryLevel: number | null = null;
let batteryCharging: boolean | null = null;
let batteryInitStarted = false;
const listeners = new Set<() => void>();

function computeIsLowBattery(): boolean {
  if (!batterySupported || batteryLevel === null) return false;
  return batteryCharging === false && batteryLevel <= LOW_BATTERY_THRESHOLD;
}

function computeIsActive(): boolean {
  if (currentMode === 'on') return true;
  if (currentMode === 'off') return false;
  return computeIsLowBattery();
}

function syncDomClass() {
  if (typeof document === 'undefined') return;
  document.documentElement.classList.toggle('battery-saver', computeIsActive());
}

function notifyAll() {
  syncDomClass();
  listeners.forEach((fn) => {
    try {
      fn();
    } catch {}
  });
}

function initBatteryListener() {
  if (batteryInitStarted || typeof navigator === 'undefined') return;
  batteryInitStarted = true;

  const nav = navigator as Navigator & {
    getBattery?: () => Promise<BatteryManagerLike>;
  };

  if (typeof nav.getBattery !== 'function') {
    syncDomClass();
    return;
  }

  nav
    .getBattery()
    .then((battery) => {
      batterySupported = true;
      const updateFromBattery = () => {
        batteryLevel = typeof battery.level === 'number' ? battery.level : null;
        batteryCharging = typeof battery.charging === 'boolean' ? battery.charging : null;
        notifyAll();
      };
      updateFromBattery();
      battery.addEventListener?.('levelchange', updateFromBattery);
      battery.addEventListener?.('chargingchange', updateFromBattery);
    })
    .catch(() => {
      batterySupported = false;
      syncDomClass();
    });
}

initBatteryListener();

export function getBatterySaverState(): BatterySaverState {
  initBatteryListener();
  return {
    mode: currentMode,
    active: computeIsActive(),
    batterySupported,
    level: batteryLevel,
    charging: batteryCharging,
    isLowBattery: computeIsLowBattery(),
  };
}

export function getIsBatterySaverActive(): boolean {
  return computeIsActive();
}

export function setBatterySaverMode(mode: BatterySaverMode): void {
  if (currentMode === mode) {
    syncDomClass();
    return;
  }
  currentMode = mode;
  try {
    localStorage.setItem(BATTERY_SAVER_STORAGE_KEY, mode);
  } catch {}
  notifyAll();
}

export function subscribeBatterySaver(listener: () => void): () => void {
  initBatteryListener();
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function useBatterySaver(): BatterySaverState {
  const [state, setState] = useState<BatterySaverState>(() => getBatterySaverState());

  useEffect(() => {
    setState(getBatterySaverState());
    return subscribeBatterySaver(() => {
      setState(getBatterySaverState());
    });
  }, []);

  return state;
}
