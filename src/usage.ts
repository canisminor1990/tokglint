import i18n from './i18n';
import { type ProviderKey, PROVIDERS, type Settings } from './types';

interface UsageSection {
  available?: boolean;
  percentage?: number | null;
}

interface UsageShape {
  credits?: {
    percentage?: number | null;
    remaining?: number | null;
    total?: number | null;
  } | null;
  external_pool?: UsageShape | null;
  monthly?: UsageSection | null;
  session?: UsageSection;
  session_label?: string | null;
  stale?: boolean;
  weekly?: UsageSection;
  weekly_label?: string | null;
}

interface CachedAccount {
  error?: unknown;
  profile?: { id?: string; name?: string };
  provider?: string;
  usage?: UsageShape | null;
}

export interface UsageMeter {
  id: string;
  label: string;
  percent: number;
}

export interface UsageFact {
  detail: string;
  id: string;
  meters: UsageMeter[];
  provider: ProviderKey;
  title: string;
  tone: 'secondary' | 'danger' | 'warning';
}

const CACHE_KEY: Record<ProviderKey, string> = {
  claude: 'claude_code',
  codex: 'codex',
  antigravity: 'antigravity_gemini',
  opencode: 'opencode',
  cursor: 'cursor',
  grok: 'grok',
  copilot: 'copilot',
  grok_bot: 'grok_bot',
  aihubmix: 'aihubmix',
};

function t(key: string, options?: Record<string, unknown>) {
  return i18n.t(key, options);
}

function directionLabel(countdown: boolean) {
  return t(countdown ? 'usage.remaining' : 'usage.used');
}

function explainError(error: unknown): string {
  if (typeof error === 'string') {
    switch (error) {
      case 'auth_required': {
        return t('usage.authRejected');
      }
      case 'no_credentials': {
        return t('usage.noCredentials');
      }
      case 'token_expired': {
        return t('usage.tokenExpired');
      }
      case 'request_failed': {
        return t('usage.requestFailed');
      }
      case 'network_error': {
        return t('usage.networkError');
      }
      case 'unexpected_response': {
        return t('usage.unexpectedResponse');
      }
      default: {
        return error;
      }
    }
  }
  if (error && typeof error === 'object' && 'http_status' in error) {
    const code = Number((error as { http_status?: unknown }).http_status);
    if (Number.isFinite(code) && (code === 401 || code === 403)) {
      return t('usage.authStatus', { code });
    }
    if (Number.isFinite(code)) {
      return t('usage.httpStatus', { code });
    }
  }
  return t('usage.readFailed');
}

function shownPercent(percentage: number, countdown: boolean) {
  const used = Math.round(percentage);
  return countdown ? Math.min(100, Math.max(0, 100 - used)) : used;
}

function windowLabel(
  provider: ProviderKey | undefined,
  kind: 'session' | 'weekly' | 'monthly',
  reported?: string | null,
) {
  if (provider === 'cursor' && kind === 'session') return t('usage.auto');
  if (provider === 'cursor' && kind === 'weekly') return t('usage.api');
  if (kind === 'weekly' && !reported && (provider === 'grok' || provider === 'grok_bot')) {
    return t('usage.included');
  }
  if (reported) return reported;
  if (kind === 'session') return t('usage.session');
  if (kind === 'weekly') return t('usage.weekly');
  return t('usage.monthly');
}

function metersOf(
  usage: UsageShape,
  countdown: boolean,
  provider?: ProviderKey,
  prefix = '',
): UsageMeter[] {
  const meters: UsageMeter[] = [];
  const push = (
    id: string,
    kind: 'session' | 'weekly' | 'monthly',
    section: UsageSection | null | undefined,
    reported?: string | null,
  ) => {
    if (!section?.available || typeof section.percentage !== 'number') return;
    meters.push({
      id: `${prefix}${id}`,
      label: windowLabel(provider, kind, reported),
      percent: shownPercent(section.percentage, countdown),
    });
  };
  push('session', 'session', usage.session, usage.session_label);
  push('weekly', 'weekly', usage.weekly, usage.weekly_label);
  const credits = usage.credits;
  if (credits && typeof credits.percentage === 'number') {
    const total = typeof credits.total === 'number' ? credits.total : 0;
    const remaining = credits.remaining ?? 0;
    const capped = provider === 'aihubmix' && total > 0;
    const label = capped
      ? `$${Math.round(remaining)}/$${Math.round(total)}`
      : provider === 'aihubmix'
        ? `$${Math.round(remaining)}`
        : total > 0
          ? `$${Math.max(0, Math.round(total - remaining))}/$${Math.round(total)}`
          : t('usage.included');
    meters.push({
      id: `${prefix}credits`,
      label,
      percent: capped
        ? Math.min(100, Math.max(0, (remaining / total) * 100))
        : shownPercent(credits.percentage, countdown),
    });
  } else {
    push('monthly', 'monthly', usage.monthly);
  }
  if (usage.external_pool) {
    for (const meter of metersOf(usage.external_pool, countdown, provider, `${prefix}external-`)) {
      meters.push({ ...meter, label: t('usage.external', { part: meter.label }) });
    }
  }
  return meters;
}

function describeUsage(usage: UsageShape, countdown: boolean, provider?: ProviderKey) {
  const meters = metersOf(usage, countdown, provider);
  const body =
    meters
      .map((meter) =>
        t('usage.section', {
          name: meter.label,
          direction: directionLabel(countdown),
          shown: meter.percent,
        }),
      )
      .join(' · ') || t('usage.waiting');
  return {
    meters,
    text: usage.stale ? t('usage.stale', { body }) : body,
    waiting: meters.length === 0,
  };
}

function accountStatus(
  account: CachedAccount | undefined,
  countdown: boolean,
  provider?: ProviderKey,
): { detail: string; meters: UsageMeter[]; tone: UsageFact['tone'] } {
  if (!account) return { detail: t('usage.waiting'), meters: [], tone: 'secondary' };
  const reading = account.usage ? describeUsage(account.usage, countdown, provider) : null;
  if (account.error != null) {
    const reason = explainError(account.error);
    if (reading && !reading.waiting) {
      return {
        detail: reading.meters.length
          ? reason
          : t('usage.retained', { reason, reading: reading.text }),
        meters: reading.meters,
        tone: 'danger',
      };
    }
    return { detail: reason, meters: [], tone: 'danger' };
  }
  if (!reading) return { detail: t('usage.waiting'), meters: [], tone: 'secondary' };
  return {
    detail: reading.waiting ? reading.text : usageNote(account.usage),
    meters: reading.meters,
    tone: account.usage?.stale ? 'warning' : 'secondary',
  };
}

function usageNote(usage: UsageShape | null | undefined) {
  return usage?.stale ? t('usage.staleLabel') : '';
}

function usageRecord(cache: Record<string, unknown> | null): Record<string, unknown> | null {
  if (!cache) return null;
  // The widget writes `{ updated_unix, poll_ok, data }`. The preview fixture
  // already is the inner record.
  const nested = cache.data;
  if (nested && typeof nested === 'object' && !Array.isArray(nested)) {
    return nested as Record<string, unknown>;
  }
  return cache;
}

function cachedAccounts(cache: Record<string, unknown> | null): CachedAccount[] {
  const raw = usageRecord(cache)?.accounts;
  if (!Array.isArray(raw)) return [];
  return raw.filter((item): item is CachedAccount => Boolean(item) && typeof item === 'object');
}

function isUsage(value: unknown): value is UsageShape {
  return Boolean(value) && typeof value === 'object';
}

export function enabledProviderCount(settings: Settings) {
  return PROVIDERS.filter((provider) => Boolean(settings[provider.settingsField])).length;
}

function applyAihubmixLimit(usage: UsageShape, limit: number): UsageShape {
  const credits = usage.credits;
  if (!credits || typeof credits.remaining !== 'number') return usage;
  const total = typeof credits.total === 'number' ? credits.total : credits.remaining;
  const used = Math.max(0, total - credits.remaining);
  if (limit > 0) {
    return {
      ...usage,
      credits: {
        ...credits,
        percentage: Math.min(100, (used / limit) * 100),
        remaining: credits.remaining,
        total: limit,
      },
    };
  }
  return { ...usage, credits: { ...credits, total: 0 } };
}

export function usageFacts(
  settings: Settings,
  cache: Record<string, unknown> | null,
  countdown: boolean,
): UsageFact[] {
  const accounts = cachedAccounts(cache);
  const facts: UsageFact[] = [];

  for (const provider of PROVIDERS) {
    if (!settings[provider.settingsField]) continue;

    if (provider.hasAccounts) {
      const bundle = provider.key === 'claude' ? settings.accounts.claude : settings.accounts.codex;
      const enabled = bundle.profiles.filter((profile) => profile.enabled);
      if (enabled.length === 0) {
        facts.push({
          id: provider.key,
          provider: provider.key,
          title: provider.name,
          detail: t('usage.noEnabledAccount'),
          meters: [],
          tone: 'secondary',
        });
        continue;
      }
      for (const profile of enabled) {
        const match = accounts.find(
          (account) => account.provider === provider.key && account.profile?.id === profile.id,
        );
        const status = accountStatus(match, countdown, provider.key);
        facts.push({
          id: `${provider.key}:${profile.id}`,
          provider: provider.key,
          title: `${provider.name} · ${profile.name || profile.id}`,
          detail: status.detail,
          meters: status.meters,
          tone: status.tone,
        });
      }
      continue;
    }

    const found = accounts.find((account) => account.provider === provider.key);
    const match =
      provider.key === 'aihubmix' && found?.usage
        ? { ...found, usage: applyAihubmixLimit(found.usage, settings.aihubmixUsageLimit) }
        : found;
    if (match) {
      const status = accountStatus(match, countdown, provider.key);
      facts.push({
        id: provider.key,
        provider: provider.key,
        title: provider.name,
        detail: status.detail,
        meters: status.meters,
        tone: status.tone,
      });
      continue;
    }

    const stored = usageRecord(cache)?.[CACHE_KEY[provider.key]];
    const top =
      provider.key === 'aihubmix' && isUsage(stored)
        ? applyAihubmixLimit(stored, settings.aihubmixUsageLimit)
        : stored;
    if (isUsage(top)) {
      const reading = describeUsage(top, countdown, provider.key);
      facts.push({
        id: provider.key,
        provider: provider.key,
        title: provider.name,
        detail: reading.waiting ? reading.text : usageNote(top),
        meters: reading.meters,
        tone: top.stale ? 'warning' : 'secondary',
      });
    } else {
      facts.push({
        id: provider.key,
        provider: provider.key,
        title: provider.name,
        detail: t('usage.waiting'),
        meters: [],
        tone: 'secondary',
      });
    }
  }

  return facts;
}

export function failureCount(facts: UsageFact[]) {
  return facts.filter((fact) => fact.tone === 'danger').length;
}
