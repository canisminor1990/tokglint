import type { Settings, SettingsPatch } from './types';
import { DEFAULT_POLL_MINUTES, POLL_1_MIN } from './types';

const settings: Settings = {
  pollIntervalMs: DEFAULT_POLL_MINUTES * POLL_1_MIN,
  showClaudeCode: true,
  showCodex: true,
  showAntigravity: false,
  showAntigravityGemini: null,
  showAntigravityExternal: null,
  showOpencode: false,
  showCursor: true,
  showGrok: false,
  showCopilot: false,
  showGrokBot: true,
  showAihubmix: false,
  aihubmixToken: '',
  aihubmixUsageLimit: 0,
  usageCountdown: true,
  lockTaskbar: false,
  showAvatar: true,
  showReset: true,
  showTrayIcons: true,
  widgetGap: 8,
  providerOrder: [
    'cursor',
    'claude',
    'codex',
    'antigravity',
    'opencode',
    'grok',
    'copilot',
    'grok_bot',
    'aihubmix',
  ],
  language: 'system',
  accounts: {
    claude: {
      selected: 'default',
      usedIds: ['default', 'account_2'],
      profiles: [
        {
          id: 'default',
          name: 'Default',
          configDir: '',
          credentialsPath: '',
          enabled: true,
        },
        {
          id: 'account_2',
          name: '账号 2',
          configDir: 'D:\\work\\claude',
          credentialsPath: '',
          enabled: true,
        },
      ],
    },
    codex: {
      selected: 'default',
      usedIds: ['default'],
      profiles: [
        {
          id: 'default',
          name: 'Default',
          configDir: '',
          credentialsPath: '',
          enabled: true,
        },
      ],
    },
  },
};

let startupEnabled = true;
let nextSerial = 2;
const logText = [
  '12:01 读取 Claude Code 成功',
  '12:02 账号 2 登录被拒绝',
  '12:06 读取 Cursor 成功',
].join('\n');

const usageCache: Record<string, unknown> = {
  accounts: [
    {
      provider: 'claude',
      profile: { id: 'default', name: 'Default' },
      usage: {
        session: { available: true, percentage: 73 },
        session_label: '5h',
        weekly: { available: true, percentage: 41 },
        stale: false,
      },
      error: null,
    },
    {
      provider: 'claude',
      profile: { id: 'account_2', name: '账号 2' },
      usage: null,
      error: 'auth_required',
    },
    {
      provider: 'codex',
      profile: { id: 'default', name: 'Default' },
      usage: {
        session: { available: true, percentage: 12 },
        weekly: { available: false, percentage: null },
        stale: true,
      },
      error: null,
    },
  ],
  cursor: {
    session: { available: true, percentage: 64 },
    weekly: { available: true, percentage: 22 },
    weekly_label: 'API',
  },
  grok_bot: {
    session: { available: false, percentage: null },
    weekly: { available: true, percentage: 80 },
    credits: { percentage: 0, remaining: 100, total: 100 },
  },
};

function cloneSettings(): Settings {
  return structuredClone(settings);
}

export function previewSettings() {
  return cloneSettings();
}

export function previewSave(patch: SettingsPatch) {
  if (patch.accounts) settings.accounts = patch.accounts;
  const { accounts: _accounts, ...rest } = patch;
  for (const [key, value] of Object.entries(rest)) {
    if (value !== undefined && value !== null) {
      Object.assign(settings, { [key]: value });
    }
  }
  return cloneSettings();
}

export function previewStartup() {
  return startupEnabled;
}

export function previewSetStartup(enabled: boolean) {
  startupEnabled = enabled;
}

export function previewCache() {
  return structuredClone(usageCache);
}

export function previewLog() {
  return logText;
}

export function previewLogPath() {
  return 'C:\\Users\\preview\\AppData\\Local\\Temp\\tokglint.log';
}

export function previewLaunch() {
  return { connected: true };
}

export function previewNextAccountId(provider: 'claude' | 'codex') {
  nextSerial += 1;
  const bundle = settings.accounts[provider];
  const id = `account_${nextSerial}`;
  if (!bundle.usedIds.includes(id)) bundle.usedIds = [...bundle.usedIds, id];
  return id;
}

export function previewRefresh() {
  const cursor = usageCache.cursor as { session?: { percentage?: number } };
  if (cursor.session && typeof cursor.session.percentage === 'number') {
    cursor.session.percentage = Math.min(99, cursor.session.percentage + 1);
  }
}
