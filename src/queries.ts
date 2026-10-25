import useSWR from 'swr';

import {
  getDiagnoseLog,
  getDiagnoseLogPath,
  getLaunchInfo,
  getSettings,
  getStartupEnabled,
  getUsageCache,
} from './api';

export const queryKeys = {
  launch: 'launch',
  log: 'diagnose-log',
  logPath: 'log-path',
  settings: 'settings',
  startup: 'startup',
  usage: 'usage-cache',
} as const;

export function useSettingsQuery() {
  return useSWR(queryKeys.settings, getSettings);
}

export function useUsageQuery() {
  return useSWR(queryKeys.usage, getUsageCache, { refreshInterval: 2000 });
}

export function useLaunchQuery() {
  return useSWR(queryKeys.launch, getLaunchInfo, { refreshInterval: 5000 });
}

export function useStartupQuery() {
  return useSWR(queryKeys.startup, getStartupEnabled);
}

export function useLogPathQuery() {
  return useSWR(queryKeys.logPath, getDiagnoseLogPath);
}

export function useLogQuery(recording: boolean) {
  return useSWR(recording ? queryKeys.log : null, getDiagnoseLog);
}
