import { Alert, Button, Empty, Flexbox } from '@lobehub/ui';
import { MetricStrip, PageHeader, Surface } from '@lobehub/ui/dashboard';
import { useTranslation } from 'react-i18next';

import { ProviderIcon } from '../components/ProviderIcon';
import { UsageMeters } from '../components/UsageMeters';
import { styles } from '../styles';
import { PROVIDERS, type Settings } from '../types';
import { enabledProviderCount, failureCount, usageFacts } from '../usage';

// lobe-design-ignore DETAIL-DANGER-NO-CONFIRM: valueTone 的 danger 表示读取失败或未连接，不是危险写操作

export function OverviewPage({
  settings,
  usageCache,
  connected,
  onOpenProviders,
}: {
  settings: Settings;
  usageCache: Record<string, unknown> | null;
  connected: boolean;
  onOpenProviders: () => void;
}) {
  const { t } = useTranslation();
  const facts = usageFacts(settings, usageCache, settings.usageCountdown);
  const failures = usageCache == null ? null : failureCount(facts);
  const minutes = Math.max(1, Math.round(settings.pollIntervalMs / 60_000));

  return (
    <div className={styles.page}>
      <PageHeader description={t('overview.description')} title={t('overview.title')} />
      {connected ? null : (
        <Alert
          showIcon
          description={t('overview.disconnectedDescription')}
          title={t('overview.disconnectedTitle')}
          type="warning"
        />
      )}
      <MetricStrip
        items={[
          {
            label: t('overview.widget'),
            value: connected ? t('overview.connected') : t('overview.disconnected'),
            valueTone: connected ? undefined : 'danger',
            hint: connected ? t('overview.canRefresh') : t('overview.openFromTray'),
          },
          {
            label: t('overview.enabled'),
            value: `${enabledProviderCount(settings)} / ${PROVIDERS.length}`,
            hint: t('overview.providers'),
          },
          {
            label: t('overview.readFailed'),
            value: failures == null ? '--' : String(failures),
            valueTone: failures != null && failures > 0 ? 'danger' : undefined,
            hint: failures == null ? t('overview.noCache') : t('overview.currentCache'),
          },
          {
            label: t('overview.pollInterval'),
            value: String(minutes),
            hint: t('overview.minutes'),
          },
        ]}
      />
      {facts.length === 0 ? (
        <Empty
          description={t('overview.emptyDescription')}
          icon={undefined}
          title={t('overview.emptyTitle')}
          action={
            <Button htmlType="button" type="fill" onClick={onOpenProviders}>
              {t('overview.goToProviders')}
            </Button>
          }
        />
      ) : (
        <section className={styles.providerSection}>
          <div className={styles.providerGridHead}>
            <h2 className={styles.providerGridTitle}>{t('overview.enabledTitle')}</h2>
            <Button htmlType="button" type="text" onClick={onOpenProviders}>
              {t('overview.manageProviders')}
            </Button>
          </div>
          <div className={styles.providerGrid}>
            {facts.map((fact) => (
              <Surface
                key={fact.id}
                title={
                  <Flexbox horizontal align="center" className={styles.providerCardTitle} gap={8}>
                    <ProviderIcon provider={fact.provider} />
                    <span className={styles.providerCardName}>{fact.title}</span>
                  </Flexbox>
                }
              >
                <UsageMeters fact={fact} />
              </Surface>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
