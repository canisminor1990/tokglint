import { Button, Flexbox, InputNumber, InputPassword, Switch, Text } from '@lobehub/ui';
import { PageHeader, Surface } from '@lobehub/ui/dashboard';
import { Fragment, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { AccountEditor } from '../components/AccountEditor';
import { ProviderIcon } from '../components/ProviderIcon';
import { SettingControl, SettingRow } from '../components/SettingRow';
import { styles } from '../styles';
import { type Accounts, type ProviderKey, PROVIDERS, type Settings } from '../types';

export function ProvidersPage({
  settings,
  pending,
  onToggleProvider,
  onChangeAccounts,
  onAddAccount,
  onChangeAihubmixToken,
  onChangeAihubmixUsageLimit,
}: {
  settings: Settings;
  pending: boolean;
  onToggleProvider: (key: ProviderKey, enabled: boolean) => void;
  onChangeAccounts: (accounts: Accounts) => Promise<void>;
  onAddAccount: (provider: 'claude' | 'codex') => void;
  onChangeAihubmixToken: (token: string) => void;
  onChangeAihubmixUsageLimit: (limit: number) => void;
}) {
  const { t } = useTranslation();
  const multi = PROVIDERS.filter((provider) => provider.hasAccounts);
  const single = PROVIDERS.filter((provider) => !provider.hasAccounts);
  const saveTitle = pending ? t('app.saving') : undefined;
  const providerDescription = (key: ProviderKey) => t(`providers.items.${key}`);

  const renderSwitch = (key: ProviderKey, enabled: boolean) => (
    <SettingControl>
      <Switch
        checked={enabled}
        disabled={pending}
        title={saveTitle}
        onChange={(checked) => onToggleProvider(key, checked)}
      />
    </SettingControl>
  );

  return (
    <div className={styles.page}>
      <PageHeader description={t('providers.description')} title={t('providers.title')} />
      {multi.length === 0 ? null : (
        <Surface description={t('providers.multiDescription')} title={t('providers.multiTitle')}>
          {multi.map((provider, index) => {
            const enabled = Boolean(settings[provider.settingsField]);
            const accounts =
              provider.key === 'claude' ? settings.accounts.claude : settings.accounts.codex;
            const previous = index > 0 ? multi[index - 1] : undefined;
            const previousOpen = previous ? Boolean(settings[previous.settingsField]) : false;
            return (
              <div className={previousOpen ? styles.providerBreak : undefined} key={provider.key}>
                <SettingRow
                  description={providerDescription(provider.key)}
                  mark={<ProviderIcon provider={provider.key} />}
                  title={provider.name}
                >
                  {renderSwitch(provider.key, enabled)}
                </SettingRow>
                {enabled ? (
                  <>
                    <AccountEditor
                      accounts={accounts}
                      pending={pending}
                      provider={provider.key as 'claude' | 'codex'}
                      onChange={(next) =>
                        onChangeAccounts({ ...settings.accounts, [provider.key]: next })
                      }
                    />
                    <Button
                      className={styles.addAccount}
                      disabled={pending}
                      htmlType="button"
                      title={saveTitle}
                      type="fill"
                      onClick={() => onAddAccount(provider.key as 'claude' | 'codex')}
                    >
                      {t('providers.addAccount')}
                    </Button>
                  </>
                ) : null}
              </div>
            );
          })}
        </Surface>
      )}
      {single.length === 0 ? null : (
        <Surface description={t('providers.singleDescription')} title={t('providers.singleTitle')}>
          {single.map((provider) => {
            const enabled = Boolean(settings[provider.settingsField]);
            return (
              <Fragment key={provider.key}>
                <SettingRow
                  description={providerDescription(provider.key)}
                  mark={<ProviderIcon provider={provider.key} />}
                  title={provider.name}
                >
                  {renderSwitch(provider.key, enabled)}
                </SettingRow>
                {provider.key === 'aihubmix' && enabled ? (
                  <div className={styles.meterBlock}>
                    <AihubmixToken
                      pending={pending}
                      value={settings.aihubmixToken}
                      onCommit={onChangeAihubmixToken}
                    />
                    <AihubmixLimit
                      pending={pending}
                      value={settings.aihubmixUsageLimit}
                      onCommit={onChangeAihubmixUsageLimit}
                    />
                  </div>
                ) : null}
              </Fragment>
            );
          })}
        </Surface>
      )}
    </div>
  );
}

function AihubmixToken({
  value,
  pending,
  onCommit,
}: {
  value: string;
  pending: boolean;
  onCommit: (token: string) => void;
}) {
  const { t } = useTranslation();
  const [draft, setDraft] = useState(value);
  useEffect(() => setDraft(value), [value]);
  const commit = () => {
    const next = draft.trim();
    if (next !== value.trim()) onCommit(next);
  };

  return (
    <Flexbox gap={8}>
      <Text as="label" weight={500}>
        {t('providers.aihubmixToken')}
      </Text>
      <Text type="secondary">{t('providers.aihubmixTokenDescription')}</Text>
      <InputPassword
        disabled={pending}
        placeholder={t('providers.aihubmixTokenPlaceholder')}
        value={draft}
        visibilityToggleLabels={{
          hide: t('providers.hideToken'),
          show: t('providers.showToken'),
        }}
        onBlur={commit}
        onChange={(event) => setDraft(event.currentTarget.value)}
        onPressEnter={commit}
      />
    </Flexbox>
  );
}

function AihubmixLimit({
  value,
  pending,
  onCommit,
}: {
  value: number;
  pending: boolean;
  onCommit: (limit: number) => void;
}) {
  const { t } = useTranslation();
  const saved = value > 0 ? value : null;
  const [draft, setDraft] = useState<number | null>(saved);
  useEffect(() => setDraft(saved), [saved]);
  const commit = () => {
    const next = draft != null && Number.isFinite(draft) && draft > 0 ? draft : 0;
    if (next !== value) onCommit(next);
  };

  return (
    <Flexbox gap={8}>
      <Text as="label" weight={500}>
        {t('providers.aihubmixUsageLimit')}
      </Text>
      <Text type="secondary">{t('providers.aihubmixUsageLimitDescription')}</Text>
      <InputNumber
        disabled={pending}
        min={0}
        placeholder="100"
        style={{ width: 160 }}
        value={draft}
        onBlur={commit}
        onChange={(next) => setDraft(typeof next === 'number' ? next : null)}
        onPressEnter={commit}
      />
    </Flexbox>
  );
}
