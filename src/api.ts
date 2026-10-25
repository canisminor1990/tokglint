import { invoke } from '@tauri-apps/api/core';

import {
  previewCache,
  previewLaunch,
  previewLog,
  previewLogPath,
  previewNextAccountId,
  previewRefresh,
  previewSave,
  previewSetStartup,
  previewSettings,
  previewStartup,
} from './devPreview';
import type { Settings, SettingsPatch } from './types';

function inTauri() {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
}

function usePreview() {
  return import.meta.env.DEV && !inTauri();
}

export function getSettings() {
  if (usePreview()) return Promise.resolve(previewSettings());
  return invoke<Settings>('get_settings');
}

export function saveSettings(patch: SettingsPatch) {
  if (usePreview()) return Promise.resolve(previewSave(patch));
  return invoke<Settings>('save_settings', { patch });
}

export function refreshNow() {
  if (usePreview()) {
    previewRefresh();
    return Promise.resolve();
  }
  return invoke<void>('refresh_now');
}

export function setDiagnostics(enabled: boolean) {
  if (usePreview()) return Promise.resolve();
  return invoke<void>('set_diagnostics', { enabled });
}

export function checkForUpdates() {
  if (usePreview()) return Promise.resolve();
  return invoke<void>('check_for_updates');
}

export function getStartupEnabled() {
  if (usePreview()) return Promise.resolve(previewStartup());
  return invoke<boolean>('get_startup_enabled');
}

export function setStartupEnabled(enabled: boolean) {
  if (usePreview()) {
    previewSetStartup(enabled);
    return Promise.resolve();
  }
  return invoke<void>('set_startup_enabled', { enabled });
}

export function getUsageCache() {
  if (usePreview()) return Promise.resolve(previewCache());
  return invoke<Record<string, unknown> | null>('get_usage_cache');
}

export function getDiagnoseLog() {
  if (usePreview()) return Promise.resolve(previewLog());
  return invoke<string>('get_diagnose_log');
}

export function getDiagnoseLogPath() {
  if (usePreview()) return Promise.resolve(previewLogPath());
  return invoke<string>('get_diagnose_log_path');
}

export function getLaunchInfo() {
  if (usePreview()) return Promise.resolve(previewLaunch());
  return invoke<{ connected: boolean }>('get_launch_info');
}

export function setWindowChrome(
  background: [number, number, number],
  text: [number, number, number],
  dark: boolean,
) {
  if (usePreview()) return Promise.resolve();
  return invoke<void>('set_window_chrome', {
    chrome: { background, text, dark },
  });
}

export function nextAccountId(provider: 'claude' | 'codex') {
  if (usePreview()) return Promise.resolve(previewNextAccountId(provider));
  return invoke<string>('next_account_id', { provider });
}
