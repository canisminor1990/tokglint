import './App.css';

import { Alert, Button, ConfigProvider, ModalHost, Text, toast, ToastHost } from '@lobehub/ui';
import { ConsoleNav, ConsoleNavSkeleton, ConsoleShell } from '@lobehub/ui/dashboard';
import { en, zhCn } from '@lobehub/ui/i18n';
import {
  Activity,
  Gauge,
  LayoutDashboard,
  MonitorSmartphone,
  RefreshCw,
  Settings2,
} from 'lucide-react';
import { motion } from 'motion/react';
import { type ReactNode, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useSWRConfig } from 'swr';

import {
  getDiagnoseLog,
  nextAccountId,
  refreshNow,
  saveSettings,
  setDiagnostics,
  setStartupEnabled,
} from './api';
import { applyAppLanguage } from './i18n';
import { DiagnosticsPage } from './pages/DiagnosticsPage';
import { GeneralPage } from './pages/GeneralPage';
import { OverviewPage } from './pages/OverviewPage';
import { ProvidersPage } from './pages/ProvidersPage';
import { WidgetPage } from './pages/WidgetPage';
import {
  queryKeys,
  useLaunchQuery,
  useLogPathQuery,
  useLogQuery,
  useSettingsQuery,
  useStartupQuery,
  useUsageQuery,
} from './queries';
import { useConsoleStore } from './store';
import { styles } from './styles';
import {
  type Accounts,
  type PageId,
  POLL_1_MIN,
  type ProviderKey,
  PROVIDERS,
  type SettingsPatch,
} from './types';

// lobe-design-ignore DETAIL-NO-EMPTY: 侧栏是固定的五页导航，不是会空掉的数据列表
// lobe-design-ignore DETAIL-DANGER-NO-CONFIRM: 文件里的 danger 是保存失败的文字色，没有删除或重置动作

const NAV: { href: string; icon: typeof Gauge; id: PageId; labelKey: string }[] = [
  { id: 'overview', href: '/overview', labelKey: 'nav.overview', icon: LayoutDashboard },
  { id: 'providers', href: '/providers', labelKey: 'nav.providers', icon: Gauge },
  { id: 'widget', href: '/widget', labelKey: 'nav.widget', icon: MonitorSmartphone },
  { id: 'general', href: '/general', labelKey: 'nav.general', icon: Settings2 },
  { id: 'diagnostics', href: '/diagnostics', labelKey: 'nav.diagnostics', icon: Activity },
];

function failureText(
  translate: (key: string, options?: Record<string, unknown>) => string,
  error: unknown,
  action: string,
) {
  const message = error instanceof Error ? error.message : String(error);
  return translate('app.failure', { action, message });
}

function App() {
  const { t, i18n } = useTranslation();
  const { mutate } = useSWRConfig();
  const page = useConsoleStore((state) => state.page);
  const pending = useConsoleStore((state) => state.pending);
  const recording = useConsoleStore((state) => state.recording);
  const refreshing = useConsoleStore((state) => state.refreshing);
  const saveState = useConsoleStore((state) => state.saveState);
  const setPage = useConsoleStore((state) => state.setPage);
  const settingsQuery = useSettingsQuery();
  const usageQuery = useUsageQuery();
  const launchQuery = useLaunchQuery();
  const startupQuery = useStartupQuery();
  const logPathQuery = useLogPathQuery();
  const logQuery = useLogQuery(recording);
  const settings = settingsQuery.data ?? null;
  const usageCache = usageQuery.data ?? null;
  const connected = launchQuery.data?.connected ?? true;
  const startupEnabled = startupQuery.data ?? false;
  const logPath = logPathQuery.data ?? '';
  const logContent = logQuery.data ?? '';
  const language = settings?.language;
  const loadError = settingsQuery.error
    ? failureText(t, settingsQuery.error, t('app.loadSettingsFailed'))
    : null;

  useEffect(() => {
    applyAppLanguage(language);
  }, [language]);

  useEffect(() => {
    if (saveState !== 'saved') return;
    const timer = window.setTimeout(() => useConsoleStore.getState().clearSave(), 2000);
    return () => window.clearTimeout(timer);
  }, [saveState]);

  const handlePersist = async (patch: SettingsPatch) => {
    if (!settings) return;
    const store = useConsoleStore.getState();
    store.beginPending();
    try {
      const next = await saveSettings(patch);
      await mutate(queryKeys.settings, next, { revalidate: false });
      store.markSaved();
      try {
        await mutate(queryKeys.usage);
      } catch (error) {
        toast.error(failureText(t, error, t('app.savedCacheFailed')));
      }
    } catch (error) {
      store.markError();
      toast.error(failureText(t, error, t('app.saveSettingsFailed')));
      throw error;
    }
  };

  const handleRefresh = async () => {
    if (!connected) return;
    const store = useConsoleStore.getState();
    store.setRefreshing(true);
    try {
      await refreshNow();
      await mutate(queryKeys.usage);
      toast.success(t('app.refreshSent'));
    } catch (error) {
      toast.error(failureText(t, error, t('app.refreshFailed')));
    } finally {
      store.setRefreshing(false);
    }
  };

  const handleToggleStartup = async (enabled: boolean) => {
    const store = useConsoleStore.getState();
    store.beginPending();
    try {
      await setStartupEnabled(enabled);
      await mutate(queryKeys.startup, enabled, { revalidate: false });
      store.markSaved();
    } catch (error) {
      store.markError();
      toast.error(failureText(t, error, t('app.startupFailed')));
      throw error;
    }
  };

  const handleToggleRecording = async (enabled: boolean) => {
    const store = useConsoleStore.getState();
    store.beginPending();
    try {
      await setDiagnostics(enabled);
      store.setRecording(enabled);
      if (enabled) await mutate(queryKeys.log, getDiagnoseLog());
      store.markSaved();
    } catch (error) {
      store.markError();
      toast.error(failureText(t, error, t('app.recordingFailed')));
    }
  };

  const handleReloadLog = async () => {
    const store = useConsoleStore.getState();
    store.setRefreshing(true);
    try {
      await mutate(queryKeys.log);
      toast.success(t('app.logReloaded'));
    } catch (error) {
      toast.error(failureText(t, error, t('app.logReloadFailed')));
    } finally {
      store.setRefreshing(false);
    }
  };

  const handleCopyLog = async () => {
    try {
      await navigator.clipboard.writeText(logContent);
      toast.success(t('app.logCopied'));
    } catch (error) {
      toast.error(failureText(t, error, t('app.logCopyFailed')));
    }
  };

  const handleAddAccount = async (provider: 'claude' | 'codex') => {
    if (!settings) return;
    let id: string;
    try {
      id = await nextAccountId(provider);
    } catch (error) {
      toast.error(failureText(t, error, t('app.accountIdFailed')));
      return;
    }
    const current = provider === 'claude' ? settings.accounts.claude : settings.accounts.codex;
    const number = id.replace('account_', '');
    const nextAccounts: Accounts = {
      ...settings.accounts,
      [provider]: {
        ...current,
        profiles: [
          ...current.profiles,
          {
            id,
            name: t('accounts.defaultName', { number }),
            configDir: '',
            credentialsPath: '',
            enabled: false,
          },
        ],
        usedIds: current.usedIds.includes(id) ? current.usedIds : [...current.usedIds, id],
      },
    };
    await handlePersist({ accounts: nextAccounts });
  };

  const handleToggleProvider = (key: ProviderKey, enabled: boolean) => {
    const provider = PROVIDERS.find((item) => item.key === key);
    if (!provider) return;
    void handlePersist({ [provider.settingsField]: enabled }).catch(() => undefined);
  };

  const reloadSettings = () => {
    void Promise.all([
      mutate(queryKeys.settings),
      mutate(queryKeys.startup),
      mutate(queryKeys.usage),
      mutate(queryKeys.logPath),
      mutate(queryKeys.launch),
    ]);
  };

  const saveLabel = pending
    ? t('app.saving')
    : saveState === 'saved'
      ? t('app.saved')
      : saveState === 'error'
        ? t('app.saveFailed')
        : '';
  const pathname = NAV.find((item) => item.id === page)?.href ?? '/overview';

  const navigation = (
    <ConsoleNav
      className={styles.nav}
      label={t('nav.settings')}
      pathname={pathname}
      items={NAV.map((item) => ({
        href: item.href,
        label: t(item.labelKey),
        icon: item.icon,
        end: true,
      }))}
      onNavigate={(href) => {
        const next = NAV.find((item) => item.href === href);
        if (next) setPage(next.id);
      }}
    />
  );

  const tools = (
    <div className={styles.tools}>
      <span aria-live="polite" className={styles.status}>
        {saveLabel ? (
          <Text as="span" type={saveState === 'error' ? 'danger' : 'secondary'}>
            {saveLabel}
          </Text>
        ) : null}
      </span>
      <Button
        disabled={pending || !connected}
        htmlType="button"
        icon={RefreshCw}
        loading={refreshing}
        type="fill"
        title={
          connected
            ? pending
              ? t('app.saving')
              : t('app.refreshNow')
            : t('app.refreshDisconnected')
        }
        onClick={() => void handleRefresh()}
      >
        {t('app.refreshNow')}
      </Button>
    </div>
  );

  const shell = (children: ReactNode, loading = false) => (
    <ConsoleShell
      className={styles.shell}
      closeNavigationLabel={t('app.closeNav')}
      collapseLabel={t('app.collapseNav')}
      expandLabel={t('app.expandNav')}
      loading={loading}
      loadingNavigation={<ConsoleNavSkeleton className={styles.nav} items={NAV.length} />}
      navigation={navigation}
      openNavigationLabel={t('app.openNav')}
      skipToContentLabel={t('app.skipToContent')}
      storageKey="tokglint-nav"
      tools={loading ? undefined : tools}
    >
      {children}
    </ConsoleShell>
  );

  let body: ReactNode;
  if (!settings && !loadError) {
    body = shell(null, true);
  } else if (!settings && loadError) {
    body = shell(
      <div className={styles.page}>
        <Alert
          showIcon
          description={loadError}
          title={t('app.loadSettingsFailed')}
          type="error"
          action={
            <Button htmlType="button" type="fill" onClick={reloadSettings}>
              {t('app.reloadSettings')}
            </Button>
          }
        />
      </div>,
    );
  } else if (settings) {
    body = shell(
      <>
        {page === 'overview' ? (
          <OverviewPage
            connected={connected}
            settings={settings}
            usageCache={usageCache}
            onOpenProviders={() => setPage('providers')}
          />
        ) : null}
        {page === 'providers' ? (
          <ProvidersPage
            pending={pending}
            settings={settings}
            onChangeAccounts={(accounts) => handlePersist({ accounts })}
            onToggleProvider={handleToggleProvider}
            onAddAccount={(provider) => {
              void handleAddAccount(provider).catch(() => undefined);
            }}
            onChangeAihubmixToken={(token) => {
              void handlePersist({ aihubmixToken: token }).catch(() => undefined);
            }}
            onChangeAihubmixUsageLimit={(limit) => {
              void handlePersist({ aihubmixUsageLimit: limit }).catch(() => undefined);
            }}
          />
        ) : null}
        {page === 'widget' ? (
          <WidgetPage
            pending={pending}
            settings={settings}
            onChange={(patch) => {
              void handlePersist(patch).catch(() => undefined);
            }}
          />
        ) : null}
        {page === 'general' ? (
          <GeneralPage
            pending={pending}
            settings={settings}
            startupEnabled={startupEnabled}
            onChange={(patch) => {
              void handlePersist(patch).catch(() => undefined);
            }}
            onChangePollMinutes={(minutes) => {
              void handlePersist({ pollIntervalMs: minutes * POLL_1_MIN }).catch(() => undefined);
            }}
            onToggleStartup={(enabled) => {
              void handleToggleStartup(enabled).catch(() => undefined);
            }}
          />
        ) : null}
        {page === 'diagnostics' ? (
          <DiagnosticsPage
            logContent={logContent}
            logPath={logPath}
            pending={pending || refreshing}
            recording={recording}
            onCopyLog={() => void handleCopyLog()}
            onReloadLog={() => void handleReloadLog()}
            onToggleRecording={(enabled) => void handleToggleRecording(enabled)}
          />
        ) : null}
      </>,
    );
  }

  return (
    <ConfigProvider
      locale={i18n.resolvedLanguage === 'zh-CN' ? 'zh-CN' : 'en-US'}
      motion={motion}
      resources={i18n.resolvedLanguage === 'zh-CN' ? zhCn : en}
    >
      <ToastHost />
      <ModalHost />
      {body}
    </ConfigProvider>
  );
}

export default App;
