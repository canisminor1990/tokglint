export interface AccountProfile {
  configDir: string;
  credentialsPath: string;
  enabled: boolean;
  id: string;
  name: string;
}

export interface ProviderAccounts {
  profiles: AccountProfile[];
  selected: string;
  usedIds: string[];
}

export interface Accounts {
  claude: ProviderAccounts;
  codex: ProviderAccounts;
}

export interface Settings {
  accounts: Accounts;
  aihubmixToken: string;
  aihubmixUsageLimit: number;
  language: string | null;
  lockTaskbar: boolean;
  pollIntervalMs: number;
  providerOrder: ProviderKey[];
  showAihubmix: boolean;
  showAntigravity: boolean;
  showAntigravityExternal: boolean | null;
  showAntigravityGemini: boolean | null;
  showAvatar: boolean;
  showClaudeCode: boolean;
  showCodex: boolean;
  showCopilot: boolean;
  showCursor: boolean;
  showGrok: boolean;
  showGrokBot: boolean;
  showOpencode: boolean;
  showReset: boolean;
  showTrayIcons: boolean;
  usageCountdown: boolean;
  widgetGap: number;
}

export type SettingsPatch = {
  [K in keyof Settings]?: Settings[K] | null;
};

export type PageId = 'overview' | 'providers' | 'widget' | 'general' | 'diagnostics';

export type ProviderKey =
  | 'claude'
  | 'codex'
  | 'antigravity'
  | 'opencode'
  | 'cursor'
  | 'grok'
  | 'copilot'
  | 'grok_bot'
  | 'aihubmix';

export interface ProviderDescriptor {
  defaultEnabled: boolean;
  hasAccounts?: boolean;
  key: ProviderKey;
  name: string;
  settingsField: keyof Settings;
}

export const DEFAULT_PROVIDER_ORDER: ProviderKey[] = [
  'cursor',
  'claude',
  'codex',
  'antigravity',
  'opencode',
  'grok',
  'copilot',
  'grok_bot',
  'aihubmix',
];

export function orderedProviders(order: readonly string[] | null | undefined): ProviderKey[] {
  const known = new Set(DEFAULT_PROVIDER_ORDER);
  const seen = new Set<ProviderKey>();
  const next: ProviderKey[] = [];
  for (const key of order ?? []) {
    if (!known.has(key as ProviderKey) || seen.has(key as ProviderKey)) continue;
    seen.add(key as ProviderKey);
    next.push(key as ProviderKey);
  }
  for (const key of DEFAULT_PROVIDER_ORDER) {
    if (!seen.has(key)) next.push(key);
  }
  return next;
}

export const PROVIDERS: ProviderDescriptor[] = [
  {
    key: 'claude',
    settingsField: 'showClaudeCode',
    name: 'Claude Code',
    hasAccounts: true,
    defaultEnabled: true,
  },
  {
    key: 'codex',
    settingsField: 'showCodex',
    name: 'Codex',
    hasAccounts: true,
    defaultEnabled: false,
  },
  {
    key: 'antigravity',
    settingsField: 'showAntigravity',
    name: 'Antigravity',
    defaultEnabled: false,
  },
  {
    key: 'opencode',
    settingsField: 'showOpencode',
    name: 'OpenCode',
    defaultEnabled: false,
  },
  {
    key: 'cursor',
    settingsField: 'showCursor',
    name: 'Cursor',
    defaultEnabled: false,
  },
  {
    key: 'grok',
    settingsField: 'showGrok',
    name: 'Grok',
    defaultEnabled: false,
  },
  {
    key: 'copilot',
    settingsField: 'showCopilot',
    name: 'Copilot',
    defaultEnabled: false,
  },
  {
    key: 'grok_bot',
    settingsField: 'showGrokBot',
    name: 'Grok Bot',
    defaultEnabled: false,
  },
  {
    key: 'aihubmix',
    settingsField: 'showAihubmix',
    name: 'AIHubMix',
    defaultEnabled: false,
  },
];

export const LANGUAGES: { label?: string; labelKey?: 'languages.system'; value: string }[] = [
  { value: 'system', labelKey: 'languages.system' },
  { value: 'en', label: 'English' },
  { value: 'zh-CN', label: '简体中文' },
];

export const POLL_1_MIN = 60_000;
export const DEFAULT_POLL_MINUTES = 15;
export const MAX_POLL_MINUTES = 35_791;
